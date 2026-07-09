import "server-only";

import crypto from "node:crypto";

// AES-256-GCM encryption for social platform tokens before storage.
// TOKEN_ENCRYPTION_KEY must be a 32-byte key (base64 or hex). Server-only.

function getKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  // Accept hex (64 chars) or base64.
  const buf =
    raw.length === 64 && /^[0-9a-f]+$/i.test(raw)
      ? Buffer.from(raw, "hex")
      : Buffer.from(raw, "base64");
  return buf.length === 32 ? buf : null;
}

export function encryptToken(plaintext: string): string | null {
  const key = getKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as iv:tag:ciphertext (all base64).
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

export function decryptToken(stored: string): string | null {
  const key = getKey();
  if (!key) return null;
  const [ivB64, tagB64, dataB64] = stored.split(":");
  if (!ivB64 || !tagB64 || !dataB64) return null;
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}
