import { NextResponse } from "next/server";
import { isSupabaseConfigured, isAiConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// Health endpoint — reports status of core dependencies. Always 200 so it can
// be used as a liveness probe; `ok` reflects readiness (Supabase reachable
// when configured). Cron scheduling, Sentry, and Resend show up as feature
// flags so operators can spot missing config at a glance.
const START_TIME = Date.now();

export async function GET() {
  const checks: Record<string, unknown> = {
    supabase_configured: isSupabaseConfigured(),
    ai_configured: isAiConfigured(),
    render_worker_configured: Boolean(process.env.RENDER_WORKER_URL),
    cron_secret_configured: Boolean(process.env.CRON_SECRET),
    sentry_configured: Boolean(process.env.SENTRY_DSN),
    resend_configured: Boolean(process.env.RESEND_API_KEY),
    meta_connector_configured: Boolean(
      process.env.META_APP_ID && process.env.META_APP_SECRET
    ),
    tiktok_connector_configured: Boolean(
      process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET
    ),
  };

  let ok = true;

  // Supabase connectivity (best-effort). Only counted against `ok` when
  // Supabase is expected to be configured — an unconfigured deploy is a
  // valid "demo mode" state, not a failure.
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { error } = await supabase!.from("workspaces").select("id").limit(1);
      checks.supabase_reachable = !error;
      if (error) ok = false;
    } catch {
      checks.supabase_reachable = false;
      ok = false;
    }
  }

  return NextResponse.json({
    ok,
    service: "creatoros-ai",
    time: new Date().toISOString(),
    uptime_seconds: Math.round((Date.now() - START_TIME) / 1000),
    checks,
  });
}
