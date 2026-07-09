import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron";
import { getMetaConnection } from "@/lib/connections";
import { facebookPostInsights, instagramMediaInsights, type MetaInsight } from "@/lib/meta";
import { normalize } from "@/lib/analytics/normalize";
import type { PlatformKey } from "@/lib/platforms";

export const dynamic = "force-dynamic";

// Pull the platform-native id from a stored published_url. Strips any query
// string / trailing slash so the id stays valid for the Graph API call.
function extractId(platform: string, url: string): string | null {
  if (!url) return null;
  const clean = url.split("?")[0].split("#")[0];
  if (platform === "facebook") {
    const rest = clean.split("facebook.com/")[1];
    return rest ? rest.replace(/\/+$/, "") || null : null;
  }
  if (platform === "instagram") {
    const rest = clean.split("/p/")[1];
    return rest ? rest.replace(/\/+$/, "") || null : null;
  }
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
  // Note: publish_queue has no campaign_id column (campaign links through
  // content_variants -> content_items), so it is not selected here.
  const { data: jobs, error: jobsError } = await admin
    .from("publish_queue")
    .select("id, workspace_id, platform, published_url")
    .eq("status", "published")
    .in("platform", ["facebook", "instagram"])
    .not("published_url", "is", null)
    .gte("published_at", sinceIso)
    .limit(100);

  if (jobsError) {
    return NextResponse.json({ error: jobsError.message }, { status: 500 });
  }

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

    // Insights fetch failed (rate limit / downtime) → skip so we don't
    // overwrite a previously-good snapshot with zeros.
    if (Object.keys(insight).length === 0) continue;

    const unified = normalize(platform as PlatformKey, {
      views: insight.impressions ?? 0,
      reach: insight.reach ?? 0,
      engagement: insight.engagement ?? 0,
      clicks: insight.clicks ?? 0,
    });

    // One snapshot per job per day. Atomic upsert on the unique key
    // (workspace_id, publish_queue_id, metric_date, source) — see migration
    // 0014 — so overlapping runs cannot create duplicate double-counted rows.
    const row = {
      workspace_id: job.workspace_id,
      platform,
      publish_queue_id: job.id,
      metric_date: today,
      views: unified.views,
      reach: unified.reach,
      engagement: unified.engagement,
      clicks: unified.clicks,
      source: "api",
    };

    await admin
      .from("analytics_metrics")
      .upsert(row, { onConflict: "workspace_id,publish_queue_id,metric_date,source" });
    ingested++;
  }

  return NextResponse.json({ ok: true, jobs: jobs?.length ?? 0, ingested });
}

export const GET = handle;
export const POST = handle;
