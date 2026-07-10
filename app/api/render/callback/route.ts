import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCallbackAuth } from "@/lib/render";

// Callback from the external Render Worker. The worker signs an HMAC over
// (jobId + nonce + timestamp) using RENDER_WORKER_SECRET. This route:
//   1) verifies the signature + timestamp drift (±5min)
//   2) verifies the nonce still matches the stored render_jobs row
//   3) updates render_jobs status + media_url + duration
//   4) mirrors media_url onto the source content_variant so the publish
//      flow can pick it up
//
// Serverless-safe: no filesystem or media transcoding in this route — CI's
// grep guard enforces that; heavy lifting happens in the external worker.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    jobId?: string;
    nonce?: string;
    ts?: number;
    signature?: string;
    mediaUrl?: string;
    thumbnailUrl?: string;
    durationMs?: number;
    error?: unknown;
  } | null;

  // Number.isInteger — not `typeof === 'number'` — so NaN/Infinity/floats
  // are rejected before they can propagate into the drift calc.
  if (!body?.jobId || !body.nonce || !Number.isInteger(body.ts) || !body.signature) {
    return NextResponse.json({ error: "malformed" }, { status: 400 });
  }

  const auth = verifyCallbackAuth({
    jobId: body.jobId,
    nonce: body.nonce,
    ts: body.ts as number,
    signature: body.signature,
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });

  // Match the nonce stored at enqueue time. Signature alone would be enough
  // for authenticity, but this ties the callback to exactly one enqueue —
  // a leaked signature can't hijack a different job later.
  const { data: job } = await admin
    .from("render_jobs")
    .select("id, content_variant_id, callback_nonce, status")
    .eq("id", body.jobId)
    .maybeSingle();
  if (!job || job.callback_nonce !== body.nonce) {
    return NextResponse.json({ error: "unknown job" }, { status: 404 });
  }
  // Idempotency: repeat callbacks for a job already terminal are a no-op.
  if (job.status === "succeeded" || job.status === "failed") {
    return NextResponse.json({ ok: true, status: "already_terminal" });
  }

  const nowIso = new Date().toISOString();

  if (body.error) {
    // Workers may send `error` as a plain string OR a serialized object —
    // `String()` covers both without a TypeError.
    await admin
      .from("render_jobs")
      .update({
        status: "failed",
        error_message: String(body.error).slice(0, 2000),
        completed_at: nowIso,
      })
      .eq("id", body.jobId);
    return NextResponse.json({ ok: true, status: "failed" });
  }

  if (!body.mediaUrl) {
    return NextResponse.json({ error: "mediaUrl or error required" }, { status: 400 });
  }

  await admin
    .from("render_jobs")
    .update({
      status: "succeeded",
      media_url: body.mediaUrl,
      thumbnail_url: body.thumbnailUrl ?? null,
      duration_ms: body.durationMs ?? null,
      completed_at: nowIso,
    })
    .eq("id", body.jobId);

  // Mirror onto the source variant so downstream publish picks it up.
  await admin
    .from("content_variants")
    .update({ media_url: body.mediaUrl })
    .eq("id", job.content_variant_id);

  return NextResponse.json({ ok: true, status: "succeeded" });
}
