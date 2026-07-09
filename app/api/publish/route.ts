import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/workspace";
import { logAudit } from "@/lib/audit";
import { getAdapter } from "@/lib/adapters";
import type { PlatformKey } from "@/lib/platforms";

// Enqueue a content variant for publishing.
// - verifies ownership (variant.workspace_id === user's workspace)
// - the DB trigger (0006) blocks compliance-failed variants at insert time
// - writes an audit_logs record
export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const ctx = await getActiveContext();
  if (!ctx || !ctx.workspaceId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const variantId: string | undefined = body?.variantId;
  const scheduledAt: string | null = body?.scheduledAt ?? null;
  if (!variantId) {
    return NextResponse.json({ error: "variantId required" }, { status: 400 });
  }

  // Verify ownership + fetch platform/status.
  const { data: variant } = await supabase
    .from("content_variants")
    .select("id, workspace_id, platform, status")
    .eq("id", variantId)
    .maybeSingle();

  if (!variant || variant.workspace_id !== ctx.workspaceId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (variant.status === "fail") {
    return NextResponse.json(
      { error: "variant is compliance-failed and cannot be published" },
      { status: 422 }
    );
  }

  // Insert into queue (DB trigger enforces the fail guard as well).
  const { data: job, error } = await supabase
    .from("publish_queue")
    .insert({
      workspace_id: ctx.workspaceId,
      content_variant_id: variant.id,
      platform: variant.platform,
      scheduled_at: scheduledAt,
      status: "queued",
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logAudit(supabase, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "publish.enqueue",
    entityType: "publish_queue",
    entityId: job.id,
    metadata: { platform: variant.platform, variantId },
  });

  // Determine publish mode (api vs manual copy-to-post) from the adapter.
  const adapter = getAdapter(variant.platform as PlatformKey);
  return NextResponse.json({
    ok: true,
    jobId: job.id,
    mode: adapter.isConfigured() ? "api" : "manual",
  });
}
