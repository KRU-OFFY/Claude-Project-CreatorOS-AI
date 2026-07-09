import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron";
import { getMetaConnection } from "@/lib/connections";
import { facebookPostInsights, instagramMediaInsights, type MetaInsight } from "@/lib/meta";
import { normalize } from "@/lib/analytics/normalize";
import type { PlatformKey } from "@/lib/platforms";

export const dynamic = "force-dynamic";

// Pull the platform-native id from a stored published_url.
function extractId(platform: string, url: string): string | null {
  if (platform === "facebook") return url.split("facebook.com/")[1] ?? null;
  if (platform === "instagram") return url.split("/p/")[1] ?? null;
  return null;
}

// Analytics ingestion worker. For recently-published Meta jobs, fetch insights
// and upsert a daily snapshot into analytics_metrics (source='api').
async function handle(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const sinceIso = new Date(Date.now() - 14 * 864e5).toISOString();
  const { data: jobs } = await admin
    .from("publish_queue")
    .select("id, workspace_id, platform, published_url, campaign_id")
    .eq("status", "published")
    .in("platform", ["facebook", "instagram"])
    .not("published_url", "is", null)
    .gte("published_at", sinceIso)
    .limit(100);

  const today = new Date().toISOString().slice(0, 10);
  let ingested = 0;

  for (const job of jobs ?? []) {
    const platform = job.platform as "facebook" | "instagram";
    const nativeId = extractId(platform, job.published_url as string);
    if (!nativeId) continue;

    const conn = await getMetaConnection(job.workspace_id as string, platform);
    if (!conn) continue;

    const insight: MetaInsight =
      platform === "facebook"
        ? await facebookPostInsights(nativeId, conn.token)
        : await instagramMediaInsights(nativeId, conn.token);

    const unified = normalize(platform as PlatformKey, {
      views: insight.impressions ?? 0,
      reach: insight.reach ?? 0,
      engagement: insight.engagement ?? 0,
      clicks: insight.clicks ?? 0,
    });

    // One snapshot per job per day: update if today's row exists, else insert.
    const { data: existing } = await admin
      .from("analytics_metrics")
      .select("id")
      .eq("workspace_id", job.workspace_id)
      .eq("publish_queue_id", job.id)
      .eq("metric_date", today)
      .eq("source", "api")
      .maybeSingle();

    const row = {
      workspace_id: job.workspace_id,
      platform,
      publish_queue_id: job.id,
      campaign_id: job.campaign_id,
      metric_date: today,
      views: unified.views,
      reach: unified.reach,
      engagement: unified.engagement,
      clicks: unified.clicks,
      source: "api",
    };

    if (existing) {
      await admin.from("analytics_metrics").update(row).eq("id", existing.id);
    } else {
      await admin.from("analytics_metrics").insert(row);
    }
    ingested++;
  }

  return NextResponse.json({ ok: true, jobs: jobs?.length ?? 0, ingested });
}

export const GET = handle;
export const POST = handle;
