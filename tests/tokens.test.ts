import { describe, it, expect, beforeAll } from "vitest";
import crypto from "node:crypto";

let encryptToken: typeof import("@/lib/tokens").encryptToken;
let decryptToken: typeof import("@/lib/tokens").decryptToken;

beforeAll(async () => {
  process.env.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
  const mod = await import("@/lib/tokens");
  encryptToken = mod.encryptToken;
  decryptToken = mod.decryptToken;
});

describe("token encryption (AES-256-GCM)", () => {
  it("round-trips a token", () => {
    const secret = "EAAB_page_token_example_123";
    const enc = encryptToken(secret)!;
    expect(enc).toBeTruthy();
    expect(enc).not.toContain(secret);
    expect(decryptToken(enc)).toBe(secret);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const a = encryptToken("same")!;
    const b = encryptToken("same")!;
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe("same");
    expect(decryptToken(b)).toBe("same");
  });

  it("returns null for tampered ciphertext", () => {
    const enc = encryptToken("secret")!;
    const parts = enc.split(":");
    const tampered = [parts[0], parts[1], Buffer.from("garbage").toString("base64")].join(":");
    expect(decryptToken(tampered)).toBeNull();
  });
});
