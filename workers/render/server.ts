// Sample render worker skeleton — DO NOT deploy from this repo.
// Copy to your worker host (Fly.io / Railway / Cloud Run), install the runtime
// (this file is framework-agnostic and uses only Node stdlib for signing),
// wire in your real ffmpeg render pipeline in `renderMp4`, and expose
// `handleRender` behind an HTTPS endpoint that matches `RENDER_WORKER_URL`.
//
// See ../../docs/render-worker.md for the HTTP contract this satisfies.

import crypto from "node:crypto";

const SECRET = process.env.RENDER_WORKER_SECRET;
if (!SECRET) {
  throw new Error("RENDER_WORKER_SECRET env var is required");
}

interface RenderJobPayload {
  jobId: string;
  workspaceId: string;
  contentVariantId: string;
  callbackNonce: string;
  callbackUrl: string;
  template: "square" | "vertical" | "story";
  caption: string;
  hashtags: string[];
  cta: string | null;
  sourceMediaUrl: string | null;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

// Verify the app-side HMAC signature. The app signs the raw request body;
// mirror that exact byte-for-byte comparison here.
function verifyEnqueue(rawBody: string, signatureHeader: string): boolean {
  const computed = crypto.createHmac("sha256", SECRET!).update(rawBody).digest("hex");
  return timingSafeEqualHex(computed, signatureHeader);
}

// Sign the callback: HMAC of `<jobId>.<nonce>.<ts>`. Fresh `ts` (unix seconds)
// per callback so replays outside the app's ±5min window are rejected.
function signCallback(jobId: string, nonce: string, ts: number): string {
  return crypto.createHmac("sha256", SECRET!).update(`${jobId}.${nonce}.${ts}`).digest("hex");
}

// TODO: swap this stub for your real render pipeline. Expected to return the
// final media URL (e.g. a signed CDN URL or your object-storage public URL)
// plus optional thumbnail + duration. Throw on failure — callers map thrown
// errors to the failure-callback path.
async function renderMp4(_job: RenderJobPayload): Promise<{
  mediaUrl: string;
  thumbnailUrl?: string;
  durationMs?: number;
}> {
  return { mediaUrl: "https://example.invalid/placeholder.mp4" };
}

async function postCallback(
  callbackUrl: string,
  body: Record<string, unknown>
): Promise<void> {
  // Errors (network / timeout / non-2xx) bubble to the caller so the
  // outer `try/catch` in handleRender can flip to the failure-callback
  // path or add retry logic. A previous version .catch()'d here and
  // hid failures.
  const res = await fetch(callbackUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    // The app's callback handler is idempotent; if it 5xxs, the worker MAY
    // retry with a fresh `ts` + signature.
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`callback ${res.status}`);
  }
}

// Framework-agnostic handler. Wire into Express: `app.post("/render", ...)`.
// Wire into Cloud Run functions: adapt the (rawBody, signatureHeader) inputs.
export async function handleRender(
  rawBody: string,
  signatureHeader: string
): Promise<{ status: number }> {
  if (!verifyEnqueue(rawBody, signatureHeader)) {
    return { status: 401 };
  }
  const job = JSON.parse(rawBody) as RenderJobPayload;

  // Kick the render off in the background so we can 202-return within the
  // 15s window the app allows. Errors funnel to the failure callback.
  //
  // ⚠️  SERVERLESS NOTE. If you deploy this to Google Cloud Run, AWS Lambda,
  // or any platform that freezes / throttles the container CPU after the
  // HTTP response is sent, this floating promise will pause mid-render and
  // the callback will never fire. Two options that both work:
  //   1) enable "CPU always allocated" (Cloud Run) / equivalent, OR
  //   2) push the render into a real job queue (Cloud Tasks, BullMQ,
  //      SQS+worker) and let the queue worker call the app back.
  // A dedicated container host (Fly.io, Railway, your own VM) doesn't have
  // this problem — the container keeps running until the render finishes.
  void (async () => {
    try {
      const result = await renderMp4(job);
      const ts = Math.floor(Date.now() / 1000);
      await postCallback(job.callbackUrl, {
        jobId: job.jobId,
        nonce: job.callbackNonce,
        ts,
        signature: signCallback(job.jobId, job.callbackNonce, ts),
        mediaUrl: result.mediaUrl,
        thumbnailUrl: result.thumbnailUrl,
        durationMs: result.durationMs,
      });
    } catch (e) {
      const ts = Math.floor(Date.now() / 1000);
      await postCallback(job.callbackUrl, {
        jobId: job.jobId,
        nonce: job.callbackNonce,
        ts,
        signature: signCallback(job.jobId, job.callbackNonce, ts),
        error: e instanceof Error ? e.message : "render failed",
      });
    }
  })();

  return { status: 202 };
}
