import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron, withCronBoundary } from "@/lib/cron";
import { executePublish } from "@/lib/publish";
import { getConnection } from "@/lib/connections";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Scheduled publishing worker. Picks up queued jobs whose scheduled time has
// arrived and publishes them via the platform connector. Idempotent per run.
async function handle(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const nowIso = new Date().toISOString();
  // Only auto-publish platforms the connector can post via API. Others
  // (X/YouTube/Lemon8/Shopee) stay in manual copy-to-post mode and must not be
  // auto-failed by the worker.
  //
  // Pre-load the set of (workspace, platform) pairs that actually have a
  // connected account, then hand the DB an IN-list — jobs without a connection
  // are never returned. Without this, a manual copy-to-post job with a past
  // scheduled_at would occupy the .limit(25) window on every tick and starve
  // other workspaces (Head-of-Line blocking).
  const { data: conns } = await admin
    .from("channel_connections")
    .select("workspace_id, platform")
    .eq("status", "connected")
    .in("platform", ["facebook", "instagram", "tiktok"]);

  const wsSet: Record<string, Set<string>> = {};
  for (const c of conns ?? []) {
    const p = c.platform as string;
    (wsSet[p] ??= new Set<string>()).add(c.workspace_id as string);
  }

  const publishablePlatforms = Object.keys(wsSet);
  if (publishablePlatforms.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, published: 0, failed: 0 });
  }

  // Build one OR clause: (platform=fb AND workspace_id IN (…)) OR (platform=ig …)
  const platformScope = publishablePlatforms
    .map((p) => `and(platform.eq.${p},workspace_id.in.(${Array.from(wsSet[p]).join(",")}))`)
    .join(",");

  const { data: jobs } = await admin
    .from("publish_queue")
    .select("id, workspace_id, platform, content_variant_id, retry_count, scheduled_at")
    .eq("status", "queued")
    .or(platformScope)
    .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
    .order("scheduled_at", { ascending: true, nullsFirst: true })
    .limit(25);

  let published = 0;
  let failed = 0;

  for (const job of jobs ?? []) {
    // Re-check the connection at claim time (it could have been disconnected
    // between the pre-load and now). Skip is safe because the query already
    // filtered on connected workspaces — this is a race-window belt-and-braces.
    const conn = await getConnection(
      job.workspace_id as string,
      job.platform as string
    );
    if (!conn) continue;

    // Atomically claim the job (only if still queued) to prevent overlapping
    // cron runs or a concurrent manual publish from double-posting.
    const { data: claimed } = await admin
      .from("publish_queue")
      .update({ status: "publishing" })
      .eq("id", job.id)
      .eq("status", "queued")
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    // Scope the variant fetch to the job's workspace so a crafted queue row
    // cannot pair a job with a variant from another workspace.
    const { data: variant } = await admin
      .from("content_variants")
      .select(
        "variant_body, hashtags, cta, media_url, status, content_items(campaigns(products(url)))"
      )
      .eq("id", job.content_variant_id)
      .eq("workspace_id", job.workspace_id)
      .maybeSingle();

    // Human approval is mandatory before any publish (Brief invariant). The
    // autonomous worker only posts variants that reached 'approved'.
    if (!variant || variant.status !== "approved") {
      await admin
        .from("publish_queue")
        .update({
          status: "failed",
          error_message:
            !variant
              ? "variant missing"
              : "variant not approved (human approval required before publish)",
        })
        .eq("id", job.id);
      failed++;
      continue;
    }

    // Affiliate URL flows product → campaign → content_item → variant; any
    // missing link along the chain resolves to null (no placement).
    const vItem = variant.content_items as unknown as {
      campaigns?: { products?: { url?: string | null } | null } | null;
    } | null;
    const affiliateUrl = vItem?.campaigns?.products?.url ?? null;

    const outcome = await executePublish(
      { workspace_id: job.workspace_id as string, platform: job.platform as string },
      {
        variant_body: variant.variant_body as string,
        hashtags: (variant.hashtags as string[]) ?? null,
        cta: (variant.cta as string) ?? null,
        media_url: (variant.media_url as string) ?? null,
        affiliate_url: affiliateUrl,
      }
    );

    if (outcome.error) {
      await admin
        .from("publish_queue")
        .update({
          status: "failed",
          error_message: outcome.error,
          retry_count: (job.retry_count ?? 0) + 1,
        })
        .eq("id", job.id);
      failed++;
    } else {
      await admin
        .from("publish_queue")
        .update({
          status: "published",
          published_url: outcome.publishedUrl,
          published_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", job.id);
      published++;
    }

    await logAudit(admin, {
      workspaceId: job.workspace_id as string,
      action: outcome.error ? "publish.failed" : "publish.published",
      entityType: "publish_queue",
      entityId: job.id as string,
      metadata: { platform: job.platform, via: "cron", error: outcome.error },
    });
  }

  return NextResponse.json({
    ok: true,
    processed: jobs?.length ?? 0,
    published,
    failed,
  });
}

const wrapped = withCronBoundary("publish", handle);
export const GET = wrapped;
export const POST = wrapped;
