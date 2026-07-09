import { NextResponse } from "next/server";
import { isSupabaseConfigured, isAiConfigured, env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// Health endpoint — reports status of core dependencies. Always 200 so it can
// be used as a liveness probe; `ok` reflects readiness.
export async function GET() {
  const checks: Record<string, unknown> = {
    supabase_configured: isSupabaseConfigured(),
    ai_configured: isAiConfigured(),
    render_worker_configured: Boolean(process.env.RENDER_WORKER_URL),
  };

  // Supabase connectivity (best-effort, non-blocking on failure).
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { error } = await supabase!.from("workspaces").select("id").limit(1);
      checks.supabase_reachable = !error;
    } catch {
      checks.supabase_reachable = false;
    }
  }

  // Render worker reachability (optional).
  if (env && process.env.RENDER_WORKER_URL) {
    checks.render_worker_url = process.env.RENDER_WORKER_URL;
  }

  return NextResponse.json({
    ok: true,
    service: "creatoros-ai",
    time: new Date().toISOString(),
    checks,
  });
}
