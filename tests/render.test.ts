import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  renderConfigured,
  verifySignature,
  verifyCallbackAuth,
  generateNonce,
  enqueueRender,
} from "@/lib/render";
import crypto from "node:crypto";

const oldEnv: Record<string, string | undefined> = {};
function stubEnv(k: string, v: string | undefined) {
  if (!(k in oldEnv)) oldEnv[k] = process.env[k];
  if (v === undefined) delete process.env[k];
  else process.env[k] = v;
}
afterEach(() => {
  for (const [k, v] of Object.entries(oldEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  Object.keys(oldEnv).forEach((k) => delete oldEnv[k]);
});

describe("renderConfigured", () => {
  it("false when secret missing", () => {
    stubEnv("RENDER_WORKER_URL", "https://x");
    stubEnv("RENDER_WORKER_SECRET", undefined);
    expect(renderConfigured()).toBe(false);
  });
  it("false when url missing", () => {
    stubEnv("RENDER_WORKER_URL", undefined);
    stubEnv("RENDER_WORKER_SECRET", "s");
    expect(renderConfigured()).toBe(false);
  });
  it("true when both set", () => {
    stubEnv("RENDER_WORKER_URL", "https://x");
    stubEnv("RENDER_WORKER_SECRET", "s");
    expect(renderConfigured()).toBe(true);
  });
});

function sign(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

describe("verifySignature", () => {
  it("accepts a matching HMAC", () => {
    stubEnv("RENDER_WORKER_SECRET", "sekret");
    const s = sign("payload-a", "sekret");
    expect(verifySignature("payload-a", s)).toBe(true);
  });
  it("rejects a signature with the wrong secret", () => {
    stubEnv("RENDER_WORKER_SECRET", "sekret");
    const s = sign("payload-a", "different");
    expect(verifySignature("payload-a", s)).toBe(false);
  });
  it("rejects mismatched payload", () => {
    stubEnv("RENDER_WORKER_SECRET", "sekret");
    const s = sign("payload-a", "sekret");
    expect(verifySignature("payload-b", s)).toBe(false);
  });
});

describe("verifyCallbackAuth", () => {
  const S = "s3cret";
  const jobId = "job-1";
  const nonce = "nonce-1";
  const now = Math.floor(Date.now() / 1000);

  it("accepts a fresh, correctly-signed callback", () => {
    stubEnv("RENDER_WORKER_SECRET", S);
    const sig = sign(`${jobId}.${nonce}.${now}`, S);
    const r = verifyCallbackAuth({ jobId, nonce, ts: now, signature: sig });
    expect(r).toEqual({ ok: true });
  });

  it("rejects a stale timestamp (>5min drift)", () => {
    stubEnv("RENDER_WORKER_SECRET", S);
    const stale = now - 10 * 60;
    const sig = sign(`${jobId}.${nonce}.${stale}`, S);
    const r = verifyCallbackAuth({ jobId, nonce, ts: stale, signature: sig });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("timestamp");
  });

  it("rejects a bad signature (right payload, wrong secret)", () => {
    stubEnv("RENDER_WORKER_SECRET", S);
    const sig = sign(`${jobId}.${nonce}.${now}`, "wrong");
    const r = verifyCallbackAuth({ jobId, nonce, ts: now, signature: sig });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("signature");
  });
});

describe("generateNonce", () => {
  it("returns 32 hex chars", () => {
    const n = generateNonce();
    expect(n).toMatch(/^[0-9a-f]{32}$/);
  });
  it("is unique across calls", () => {
    const set = new Set(Array.from({ length: 200 }, () => generateNonce()));
    expect(set.size).toBe(200);
  });
});

describe("enqueueRender", () => {
  it("returns 503 when not configured", async () => {
    stubEnv("RENDER_WORKER_URL", undefined);
    stubEnv("RENDER_WORKER_SECRET", undefined);
    const r = await enqueueRender({
      jobId: "j",
      workspaceId: "w",
      contentVariantId: "v",
      callbackNonce: "n",
      callbackUrl: "https://x/cb",
      template: "square",
      caption: "hi",
      hashtags: [],
      cta: null,
      sourceMediaUrl: null,
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(503);
    expect(r.error).toMatch(/not configured/);
  });
});
