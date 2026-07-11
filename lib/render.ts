import "server-only";

import crypto from "node:crypto";

// External render worker client. The worker runs off Vercel (Fly / Railway /
// Cloud Run — anywhere with ffmpeg + disk) and satisfies the contract in
// docs/render-worker.md. The app never renders on its own runtime — the CI
// grep guard blocks fs/ffmpeg from `app/api/**`.
//
// Auth model: every enqueue POST carries an HMAC over the job body so the
// worker can verify it's really us. Every callback carries an HMAC over
// the job id + nonce + timestamp so we can verify the callback is really
// from a worker that knows the shared secret. The nonce is persisted on
// the render_jobs row (see migration 0017) so a replay outside the ±5min
// window we tolerate is rejected.

// Worker URL + HMAC secret may come from env or the in-app settings center
// (workspace_settings, Track L) — callers that know the workspace pass cfg.
export interface RenderConfig {
  url: string;
  secret: string;
}

function resolveConfig(cfg?: Partial<RenderConfig> | null): RenderConfig {
  return {
    url: cfg?.url || process.env.RENDER_WORKER_URL || "",
    secret: cfg?.secret || process.env.RENDER_WORKER_SECRET || "",
  };
}

export function renderConfigured(cfg?: Partial<RenderConfig> | null): boolean {
  const c = resolveConfig(cfg);
  return Boolean(c.url && c.secret);
}

// Return the shared HMAC secret. **Throws** when unset — falling back to an
// empty string would let a request signed with the empty key satisfy
// verifyCallbackAuth (auth bypass). Callers gate on `renderConfigured()`
// before invoking sign/verify, so throwing here is a defensive backstop.
function secret(cfg?: Partial<RenderConfig> | null): string {
  const key = resolveConfig(cfg).secret;
  if (!key) throw new Error("RENDER_WORKER_SECRET is not configured");
  return key;
}

function sign(payload: string, cfg?: Partial<RenderConfig> | null): string {
  return crypto.createHmac("sha256", secret(cfg)).update(payload).digest("hex");
}

// Constant-time compare so a wrong signature doesn't leak byte offsets
// through timing. Falsy on length mismatch (safe short-circuit). Also
// returns false — instead of throwing — when the secret is not configured,
// so an unconfigured deployment fails closed on any callback.
export function verifySignature(
  payload: string,
  expected: string,
  cfg?: Partial<RenderConfig> | null
): boolean {
  let computed: string;
  try {
    computed = sign(payload, cfg);
  } catch {
    return false;
  }
  if (computed.length !== expected.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(computed, "hex"),
    Buffer.from(expected, "hex")
  );
}

export interface RenderJobPayload {
  jobId: string;
  workspaceId: string;
  contentVariantId: string;
  callbackNonce: string;
  callbackUrl: string;
  // What the worker needs to render. Enough to run a template without
  // reading back into the DB — the app is the source of truth here.
  template: "square" | "vertical" | "story";
  caption: string;
  hashtags: string[];
  cta: string | null;
  sourceMediaUrl: string | null; // optional stock/product image; worker composites
}

export interface EnqueueResult {
  ok: boolean;
  status: number;
  error?: string;
}

// POST the render job to the worker. Returns quickly — the worker responds
// with 202 (accepted) and hits back via /api/render/callback when the render
// completes. If the worker is unconfigured we surface a distinct error so
// callers know to show a "not connected" banner instead of "worker down".
export async function enqueueRender(
  job: RenderJobPayload,
  cfg?: Partial<RenderConfig> | null
): Promise<EnqueueResult> {
  if (!renderConfigured(cfg)) {
    return { ok: false, status: 503, error: "render worker not configured" };
  }
  const body = JSON.stringify(job);
  const signature = sign(body, cfg);
  // Trim any trailing slash so a value of "https://render.internal/"
  // doesn't produce "//render" — some strict reverse proxies 404 on
  // double slashes.
  const baseUrl = resolveConfig(cfg).url.replace(/\/+$/, "");
  try {
    const res = await fetch(`${baseUrl}/render`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-render-signature": signature,
      },
      body,
      // Renders take minutes; the *enqueue* call is a quick handoff. Bound
      // it so a stuck worker doesn't hang the calling action.
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: text.slice(0, 500) };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return {
      ok: false,
      status: 502,
      error: e instanceof Error ? e.message : "enqueue failed",
    };
  }
}

// Callback verification: worker sends { jobId, nonce, ts, signature }. Reject
// stale timestamps (>5min drift) so a leaked signature can't be replayed.
export interface CallbackAuth {
  jobId: string;
  nonce: string;
  ts: number;
  signature: string;
}

export function verifyCallbackAuth(
  auth: CallbackAuth,
  cfg?: Partial<RenderConfig> | null
): { ok: true } | { ok: false; reason: string } {
  const drift = Math.abs(Date.now() - auth.ts * 1000);
  if (drift > 5 * 60_000) {
    return { ok: false, reason: "timestamp out of window" };
  }
  const payload = `${auth.jobId}.${auth.nonce}.${auth.ts}`;
  if (!verifySignature(payload, auth.signature, cfg)) {
    return { ok: false, reason: "bad signature" };
  }
  return { ok: true };
}

export function generateNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}
