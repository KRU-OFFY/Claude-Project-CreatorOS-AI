import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron";
import { executePublish } from "@/lib/publish";
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
  const { data: jobs } = await admin
    .from("publish_queue")
    .select("id, workspace_id, platform, content_variant_id, retry_count, scheduled_at")
    .eq("status", "queued")
    .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
    .order("scheduled_at", { ascending: true, nullsFirst: true })
    .limit(25);

  let published = 0;
  let failed = 0;

  for (const job of jobs ?? []) {
    // Atomically claim the job (only if still queued) to prevent overlapping
    // cron runs or a concurrent manual publish from double-posting.
    const { data: claimed } = await admin
      .from("publish_queue")
      .update({ status: "publishing" })
      .eq("id", job.id)
      .eq("status", "queued")
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const { data: variant } = await admin
      .from("content_variants")
      .select("variant_body, hashtags, cta, media_url, status")
      .eq("id", job.content_variant_id)
      .maybeSingle();

    if (!variant || variant.status === "fail") {
      await admin
        .from("publish_queue")
        .update({ status: "failed", error_message: "variant missing or compliance-failed" })
        .eq("id", job.id);
      failed++;
      continue;
    }

    const outcome = await executePublish(
      { workspace_id: job.workspace_id as string, platform: job.platform as string },
      {
        variant_body: variant.variant_body as string,
        hashtags: (variant.hashtags as string[]) ?? null,
        cta: (variant.cta as string) ?? null,
        media_url: (variant.media_url as string) ?? null,
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

  return NextResponse.json({ ok: true, processed: jobs?.length ?? 0, published, failed });
}

export const GET = handle;
export const POST = handle;
