"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/workspace";
import { logAudit } from "@/lib/audit";
import { scoreProduct, generateBrief, generateVariant, rewriteForCompliance } from "@/lib/ai";
import { computeScore } from "@/lib/scoring/product-score";
import { checkCompliance } from "@/lib/compliance";
import { PLATFORM_KEYS, type PlatformKey } from "@/lib/platforms";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateInviteToken,
  isInvitableRole,
  normalizeEmail,
  sendInviteEmail,
  inviteUrl,
  TEAM_ACTIONS,
} from "@/lib/team";
import { headers, cookies } from "next/headers";

async function ctxAndClient() {
  const supabase = await createClient();
  const ctx = await getActiveContext();
  if (!supabase || !ctx?.workspaceId) throw new Error("ไม่ได้เชื่อมต่อ Supabase หรือยังไม่ได้เข้าสู่ระบบ");
  return { supabase, ctx };
}

export async function createProduct(formData: FormData) {
  const { supabase, ctx } = await ctxAndClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const price = Number(formData.get("price")) || null;
  const commission_rate = Number(formData.get("commission_rate")) || null;
  const source_platform = String(formData.get("source_platform") ?? "manual");
  // Category drives Thai regulatory rule packs (health / cosmetics /
  // financial). Stored in raw_data so no schema change is required — the
  // Compliance Gate reads it back at variant-generation time.
  const rawCategory = String(formData.get("product_category") ?? "general");
  const validCategories = ["general", "health", "cosmetics", "financial"];
  const product_category = validCategories.includes(rawCategory) ? rawCategory : "general";

  // Deterministic score first, then let AI refine (falls back if no API key).
  const base = computeScore({ price, commission_rate });
  const ai = await scoreProduct({ name, price, commission_rate, source: source_platform });

  await supabase.from("products").insert({
    workspace_id: ctx.workspaceId,
    name,
    price,
    commission_rate,
    source_platform,
    score: ai.score ?? base.score,
    tier: ai.tier ?? base.tier,
    raw_data: { rationale: ai.rationale, category: product_category },
    created_by: ctx.userId,
  });

  await logAudit(supabase, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "product.create",
    entityType: "products",
    metadata: { name },
  });
  revalidatePath("/products");
}

export async function createCampaign(formData: FormData) {
  const { supabase, ctx } = await ctxAndClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const product_id = String(formData.get("product_id") ?? "") || null;
  const goal = String(formData.get("goal") ?? "conversion");
  const target_platforms = PLATFORM_KEYS.filter((p) => formData.get(`platform_${p}`));

  await supabase.from("campaigns").insert({
    workspace_id: ctx.workspaceId,
    name,
    product_id,
    goal,
    target_platforms,
    status: "active",
    created_by: ctx.userId,
  });

  await logAudit(supabase, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "campaign.create",
    entityType: "campaigns",
    metadata: { name, goal },
  });
  revalidatePath("/campaigns");
}

// Generate a brief + one content_item + a variant per target platform, then run
// compliance on each variant and store the resulting status.
export async function generateContentForCampaign(formData: FormData) {
  const { supabase, ctx } = await ctxAndClient();
  const campaignId = String(formData.get("campaign_id") ?? "");
  if (!campaignId) return;

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name, goal, target_platforms, products(name, raw_data)")
    .eq("id", campaignId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!campaign) return;

  const product = campaign.products as unknown as {
    name: string;
    raw_data?: { category?: string };
  } | null;
  const productName = product?.name ?? campaign.name;
  const validCategories = ["general", "health", "cosmetics", "financial"] as const;
  const rawCat = product?.raw_data?.category ?? "general";
  const productCategory: (typeof validCategories)[number] = (
    validCategories as readonly string[]
  ).includes(rawCat)
    ? (rawCat as (typeof validCategories)[number])
    : "general";
  const platforms = ((campaign.target_platforms as string[]) ?? []).filter((p) =>
    PLATFORM_KEYS.includes(p as PlatformKey)
  ) as PlatformKey[];
  const targets = platforms.length ? platforms : (["facebook", "tiktok"] as PlatformKey[]);

  const brief = await generateBrief({
    productName,
    goal: campaign.goal as string,
    platforms: targets,
  });

  const { data: item } = await supabase
    .from("content_items")
    .insert({
      workspace_id: ctx.workspaceId,
      campaign_id: campaignId,
      type: "brief",
      title: brief.title,
      body: brief.body,
      ai_generated: true,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (!item) return;

  for (const platform of targets) {
    const variant = await generateVariant({ productName, brief: brief.body, platform });
    const compliance = checkCompliance({
      platform,
      caption: variant.caption,
      hashtags: variant.hashtags,
      aiGenerated: true,
      productCategory,
    });

    const { data: cv } = await supabase
      .from("content_variants")
      .insert({
        workspace_id: ctx.workspaceId,
        content_item_id: item.id,
        platform,
        variant_body: variant.caption,
        hashtags: variant.hashtags,
        cta: variant.cta,
        status: compliance.status === "pass" ? "pass" : compliance.status,
      })
      .select("id")
      .single();

    if (cv) {
      await supabase.from("compliance_checks").insert({
        workspace_id: ctx.workspaceId,
        content_variant_id: cv.id,
        platform,
        disclosure_ok: compliance.disclosureOk,
        ai_label_ok: compliance.aiLabelOk,
        claim_risk_score: compliance.claimRiskScore,
        issues: compliance.results.filter((r) => !r.passed),
        status: compliance.status,
      });
    }
  }

  await logAudit(supabase, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "content.generate",
    entityType: "content_items",
    entityId: item.id,
    metadata: { platforms: targets },
  });
  revalidatePath("/content-studio");
  revalidatePath("/compliance");
}

// AI-rewrite a failed/needs-review variant and re-run compliance.
export async function rewriteVariant(formData: FormData) {
  const { supabase, ctx } = await ctxAndClient();
  const variantId = String(formData.get("variant_id") ?? "");
  const { data: v } = await supabase
    .from("content_variants")
    .select(
      "id, platform, variant_body, hashtags, content_items(campaign_id, campaigns(products(raw_data)))"
    )
    .eq("id", variantId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!v) return;

  // Category flows product → campaign → content_item → variant. Fall back to
  // 'general' if the join comes back empty (older data, or campaigns without
  // a product link).
  const validCategories = ["general", "health", "cosmetics", "financial"] as const;
  const item = v.content_items as unknown as {
    campaigns?: { products?: { raw_data?: { category?: string } } | null } | null;
  } | null;
  const rawCat = item?.campaigns?.products?.raw_data?.category ?? "general";
  const productCategory: (typeof validCategories)[number] = (
    validCategories as readonly string[]
  ).includes(rawCat)
    ? (rawCat as (typeof validCategories)[number])
    : "general";

  const platform = v.platform as PlatformKey;
  const before = checkCompliance({
    platform,
    caption: (v.variant_body as string | null) ?? "",
    hashtags: (v.hashtags as string[]) ?? [],
    aiGenerated: true,
    productCategory,
  });
  const rewritten = await rewriteForCompliance({
    caption: (v.variant_body as string | null) ?? "",
    platform,
    issues: before.results.filter((r) => !r.passed).map((r) => r.message),
  });
  const after = checkCompliance({
    platform,
    caption: rewritten,
    hashtags: (v.hashtags as string[]) ?? [],
    aiGenerated: true,
    productCategory,
  });

  await supabase
    .from("content_variants")
    .update({ variant_body: rewritten, status: after.status })
    .eq("id", variantId);

  await supabase.from("compliance_checks").insert({
    workspace_id: ctx.workspaceId,
    content_variant_id: variantId,
    platform,
    disclosure_ok: after.disclosureOk,
    ai_label_ok: after.aiLabelOk,
    claim_risk_score: after.claimRiskScore,
    issues: after.results.filter((r) => !r.passed),
    status: after.status,
  });
  revalidatePath("/compliance");
}

// Human approval — only owner/approver roles may approve; sets variant approved.
export async function approveVariant(formData: FormData) {
  const { supabase, ctx } = await ctxAndClient();
  const { canApprove } = await import("@/lib/roles");
  if (!canApprove(ctx.role)) {
    throw new Error("เฉพาะบทบาท owner หรือ approver เท่านั้นที่อนุมัติ Compliance ได้");
  }
  const variantId = String(formData.get("variant_id") ?? "");
  const { data: v } = await supabase
    .from("content_variants")
    .select("id, status")
    .eq("id", variantId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!v || v.status === "fail") return; // cannot approve a failed variant

  await supabase.from("content_variants").update({ status: "approved" }).eq("id", variantId);
  await supabase
    .from("compliance_checks")
    .update({ human_approved_by: ctx.userId, human_approved_at: new Date().toISOString() })
    .eq("content_variant_id", variantId);

  await logAudit(supabase, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "compliance.approve",
    entityType: "content_variants",
    entityId: variantId,
  });
  revalidatePath("/compliance");
  revalidatePath("/publish-center");
}

// Enqueue an approved variant. DB trigger blocks fail variants.
export async function enqueueVariant(formData: FormData) {
  const { supabase, ctx } = await ctxAndClient();
  const variantId = String(formData.get("variant_id") ?? "");
  const scheduledAt = String(formData.get("scheduled_at") ?? "") || null;
  const { data: v } = await supabase
    .from("content_variants")
    .select("id, platform, status")
    .eq("id", variantId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  // Only human-approved variants may enter the queue (approval gate).
  if (!v || v.status !== "approved") return;

  const { data: job } = await supabase
    .from("publish_queue")
    .insert({
      workspace_id: ctx.workspaceId,
      content_variant_id: variantId,
      platform: v.platform,
      scheduled_at: scheduledAt,
      status: "queued",
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  await logAudit(supabase, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "publish.enqueue",
    entityType: "publish_queue",
    entityId: job?.id,
    metadata: { platform: v.platform },
  });
  revalidatePath("/publish-center");
  revalidatePath("/calendar");
}

// Mark a queued job as published (manual copy-to-post confirmation).
export async function markPublished(formData: FormData) {
  const { supabase, ctx } = await ctxAndClient();
  const jobId = String(formData.get("job_id") ?? "");
  const publishedUrl = String(formData.get("published_url") ?? "") || null;
  await supabase
    .from("publish_queue")
    .update({ status: "published", published_url: publishedUrl, published_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("workspace_id", ctx.workspaceId);
  await logAudit(supabase, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "publish.published",
    entityType: "publish_queue",
    entityId: jobId,
  });
  revalidatePath("/publish-center");
  revalidatePath("/calendar");
}

export async function retryJob(formData: FormData) {
  const { supabase, ctx } = await ctxAndClient();
  const jobId = String(formData.get("job_id") ?? "");
  const { data: job } = await supabase
    .from("publish_queue")
    .select("retry_count")
    .eq("id", jobId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  await supabase
    .from("publish_queue")
    .update({ status: "queued", retry_count: (job?.retry_count ?? 0) + 1, error_message: null })
    .eq("id", jobId)
    .eq("workspace_id", ctx.workspaceId);
  revalidatePath("/publish-center");
}

// Publish a queued job for real via the platform connector (Meta FB/IG).
// Verifies ownership, calls the Graph API with the workspace's stored token,
// updates status + published_url, and records insights + an audit log.
export async function publishNow(formData: FormData) {
  const { supabase, ctx } = await ctxAndClient();
  const jobId = String(formData.get("job_id") ?? "");

  const { data: job } = await supabase
    .from("publish_queue")
    .select("id, platform, content_variant_id, retry_count")
    .eq("id", jobId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!job) return;

  const { data: variant } = await supabase
    .from("content_variants")
    .select("variant_body, hashtags, cta, media_url, status")
    .eq("id", job.content_variant_id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!variant || variant.status === "fail") return;

  // Atomically claim the job (only if still queued) so a double-click or a
  // concurrent cron run cannot publish the same job twice.
  const { data: claimed } = await supabase
    .from("publish_queue")
    .update({ status: "publishing" })
    .eq("id", jobId)
    .in("status", ["queued", "retry"])
    .select("id");
  if (!claimed || claimed.length === 0) return;

  const { executePublish } = await import("@/lib/publish");
  const outcome = await executePublish(
    { workspace_id: ctx.workspaceId, platform: job.platform as string },
    {
      variant_body: variant.variant_body as string,
      hashtags: (variant.hashtags as string[]) ?? null,
      cta: (variant.cta as string) ?? null,
      media_url: (variant.media_url as string) ?? null,
    }
  );
  const publishedUrl = outcome.publishedUrl ?? null;
  const errorMessage = outcome.error ?? null;

  if (errorMessage) {
    await supabase
      .from("publish_queue")
      .update({ status: "failed", error_message: errorMessage, retry_count: (job.retry_count ?? 0) })
      .eq("id", jobId);
  } else {
    await supabase
      .from("publish_queue")
      .update({
        status: "published",
        published_url: publishedUrl,
        published_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", jobId);
  }

  await logAudit(supabase, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: errorMessage ? "publish.failed" : "publish.published",
    entityType: "publish_queue",
    entityId: jobId,
    metadata: { platform: job.platform, via: "api", error: errorMessage },
  });
  revalidatePath("/publish-center");
  revalidatePath("/calendar");
}

// Manual analytics entry (until real connectors are wired).
export async function recordMetrics(formData: FormData) {
  const { supabase, ctx } = await ctxAndClient();
  const platform = String(formData.get("platform") ?? "facebook");
  const num = (k: string) => Number(formData.get(k)) || 0;
  const revenue = num("revenue");
  const commission = num("commission");
  await supabase.from("analytics_metrics").insert({
    workspace_id: ctx.workspaceId,
    platform,
    views: num("views"),
    reach: num("reach"),
    engagement: num("engagement"),
    clicks: num("clicks"),
    orders: num("orders"),
    revenue,
    commission,
    source: "manual",
  });
  revalidatePath("/analytics");
  revalidatePath("/revenue-forecast");
}

// ===== Track F — Team management =====

// Every team mutation must be initiated by the workspace owner. RLS also
// blocks non-owner writes; checking here gives a clean error message.
async function ownerCtx() {
  const { supabase, ctx } = await ctxAndClient();
  if (ctx.role !== "owner") throw new Error("เฉพาะ owner เท่านั้นที่จัดการทีมได้");
  return { supabase, ctx };
}

export async function inviteMember(formData: FormData) {
  const { supabase, ctx } = await ownerCtx();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const role = String(formData.get("role") ?? "editor");
  if (!email || !email.includes("@")) throw new Error("อีเมลไม่ถูกต้อง");
  if (!isInvitableRole(role)) throw new Error("บทบาทไม่ถูกต้อง");

  const token = generateInviteToken();
  const { error } = await supabase.from("workspace_invitations").insert({
    workspace_id: ctx.workspaceId,
    email,
    role,
    token,
    invited_by: ctx.userId,
  });
  if (error) throw new Error(error.message);

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const url = inviteUrl({ origin, token });
  const sent = await sendInviteEmail({
    to: email,
    inviterName: ctx.email,
    workspaceName: ctx.workspaceName,
    url,
  });

  await logAudit(supabase, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: TEAM_ACTIONS.invite,
    entityType: "workspace_invitations",
    metadata: { email, role, delivered: sent.delivered, via: sent.via },
  });
  revalidatePath("/settings/team");
}

export async function revokeInvite(formData: FormData) {
  const { supabase, ctx } = await ownerCtx();
  const id = String(formData.get("invite_id") ?? "");
  if (!id) return;
  const { error } = await supabase
    .from("workspace_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);
  if (error) throw new Error(error.message);
  await logAudit(supabase, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: TEAM_ACTIONS.inviteRevoke,
    entityType: "workspace_invitations",
    entityId: id,
  });
  revalidatePath("/settings/team");
}

export async function changeMemberRole(formData: FormData) {
  const { supabase, ctx } = await ownerCtx();
  const memberId = String(formData.get("member_id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!memberId || !isInvitableRole(role)) throw new Error("ข้อมูลไม่ถูกต้อง");

  const { data: target } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("id", memberId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!target) throw new Error("ไม่พบสมาชิก");
  // Enforce the "always at least one owner" invariant. Owner cannot demote
  // themselves via this action — must use transferOwnership (atomic swap).
  if (target.user_id === ctx.userId && role !== "owner") {
    throw new Error("owner ไม่สามารถลดบทบาทตัวเองได้ — ใช้ 'โอนความเป็นเจ้าของ' แทน");
  }
  // Refuse to create a second owner via this path: transferOwnership is the
  // audited swap. Keeps a single accountable party per workspace.
  if (role === "owner" && target.user_id !== ctx.userId) {
    throw new Error("ต้องใช้ 'โอนความเป็นเจ้าของ' เพื่อตั้ง owner ใหม่");
  }

  const { error: updateError } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("id", memberId)
    .eq("workspace_id", ctx.workspaceId);
  if (updateError) throw new Error(updateError.message);

  await logAudit(supabase, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: TEAM_ACTIONS.roleChange,
    entityType: "workspace_members",
    entityId: memberId,
    metadata: { role, target_user: target.user_id },
  });
  revalidatePath("/settings/team");
}

export async function removeMember(formData: FormData) {
  const { supabase, ctx } = await ownerCtx();
  const memberId = String(formData.get("member_id") ?? "");
  if (!memberId) return;

  const { data: target } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("id", memberId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!target) return;
  if (target.user_id === ctx.userId) throw new Error("owner ลบตัวเองไม่ได้");

  const { error: delError } = await supabase
    .from("workspace_members")
    .delete()
    .eq("id", memberId)
    .eq("workspace_id", ctx.workspaceId);
  if (delError) throw new Error(delError.message);

  await logAudit(supabase, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: TEAM_ACTIONS.memberRemove,
    entityType: "workspace_members",
    entityId: memberId,
    metadata: { target_user: target.user_id, prior_role: target.role },
  });
  revalidatePath("/settings/team");
}

export async function transferOwnership(formData: FormData) {
  const { supabase, ctx } = await ownerCtx();
  const memberId = String(formData.get("member_id") ?? "");
  if (!memberId) return;

  const { data: target } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("id", memberId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!target) throw new Error("ไม่พบสมาชิก");
  if (target.user_id === ctx.userId) throw new Error("คุณคือ owner อยู่แล้ว");

  // Owner swap is 3 writes: demote current owner, promote new owner, flip
  // workspaces.owner_id. If they ran as separate HTTP calls, a failure
  // between them would leave the workspace ownerless. Migration 0016
  // wraps them in a Postgres function so they land as one transaction.
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase admin client ยังไม่ตั้งค่า");

  const { error: rpcError } = await admin.rpc("transfer_workspace_ownership", {
    p_workspace_id: ctx.workspaceId,
    p_current_owner_id: ctx.userId,
    p_new_owner_id: target.user_id,
  });
  if (rpcError) throw new Error(rpcError.message);

  await logAudit(admin, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: TEAM_ACTIONS.ownerTransfer,
    entityType: "workspaces",
    entityId: ctx.workspaceId,
    metadata: { new_owner: target.user_id, previous_owner: ctx.userId },
  });
  revalidatePath("/settings/team");
  revalidatePath("/settings");
}

// Set the active workspace for the caller. Stored in a cookie because Server
// Components read cookies with no round trip; workspace.ts falls back to the
// first membership if the cookie is missing or points to a workspace the
// caller no longer belongs to.
export async function switchWorkspace(formData: FormData) {
  const wsId = String(formData.get("workspace_id") ?? "");
  if (!wsId) return;
  const { supabase } = await ctxAndClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: member } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .eq("workspace_id", wsId)
    .maybeSingle();
  if (!member) throw new Error("คุณไม่ได้เป็นสมาชิกของเวิร์กสเปซนี้");

  const c = await cookies();
  c.set("active_workspace_id", wsId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
