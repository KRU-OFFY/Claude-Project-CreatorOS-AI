"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/workspace";
import { logAudit } from "@/lib/audit";
import { scoreProduct, generateBrief, generateVariant, rewriteForCompliance } from "@/lib/ai";
import { computeScore } from "@/lib/scoring/product-score";
import { checkCompliance } from "@/lib/compliance";
import { PLATFORM_KEYS, type PlatformKey } from "@/lib/platforms";

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
    raw_data: { rationale: ai.rationale },
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
    .select("id, name, goal, target_platforms, products(name)")
    .eq("id", campaignId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!campaign) return;

  const productName =
    (campaign.products as unknown as { name: string } | null)?.name ?? campaign.name;
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
    .select("id, platform, variant_body, hashtags")
    .eq("id", variantId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!v) return;

  const platform = v.platform as PlatformKey;
  const before = checkCompliance({
    platform,
    caption: v.variant_body as string,
    hashtags: (v.hashtags as string[]) ?? [],
    aiGenerated: true,
  });
  const rewritten = await rewriteForCompliance({
    caption: v.variant_body as string,
    platform,
    issues: before.results.filter((r) => !r.passed).map((r) => r.message),
  });
  const after = checkCompliance({
    platform,
    caption: rewritten,
    hashtags: (v.hashtags as string[]) ?? [],
    aiGenerated: true,
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

// Human approval — only writers can approve; sets variant to approved.
export async function approveVariant(formData: FormData) {
  const { supabase, ctx } = await ctxAndClient();
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
