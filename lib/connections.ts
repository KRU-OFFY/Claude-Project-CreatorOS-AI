import "server-only";

import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken, decryptToken } from "@/lib/tokens";

// OAuth state signing (CSRF protection). Signs the workspace id + nonce + ts.
function stateSecret(): string {
  return process.env.META_APP_SECRET || process.env.TOKEN_ENCRYPTION_KEY || "dev-secret";
}

export function signState(workspaceId: string): string {
  const payload = `${workspaceId}.${crypto.randomBytes(8).toString("hex")}.${Date.now()}`;
  const sig = crypto.createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyState(state: string): { workspaceId: string } | null {
  const [b64, sig] = state.split(".");
  if (!b64 || !sig) return null;
  const payload = Buffer.from(b64, "base64url").toString("utf8");
  const expected = crypto.createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const [workspaceId, , ts] = payload.split(".");
  if (Date.now() - Number(ts) > 10 * 60_000) return null; // 10-min expiry
  return { workspaceId };
}

// Persist an encrypted platform connection (server-side, bypasses RLS via admin).
// `refreshToken` (when provided) is stored in the dedicated encrypted column —
// NOT in `metadata`, which RLS grants clients `select` on (see 0009).
export async function saveConnection(params: {
  workspaceId: string;
  userId: string;
  platform: string;
  accountName: string;
  token: string;
  refreshToken?: string | null;
  metadata: Record<string, unknown>;
  expiresAt?: string | null;
}): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const enc = encryptToken(params.token);
  const encRefresh = params.refreshToken ? encryptToken(params.refreshToken) : null;
  await admin
    .from("channel_connections")
    .upsert(
      {
        workspace_id: params.workspaceId,
        platform: params.platform,
        account_name: params.accountName,
        access_token_encrypted: enc,
        refresh_token_encrypted: encRefresh,
        status: "connected",
        metadata: params.metadata,
        connected_by: params.userId || null,
        expires_at: params.expiresAt ?? null,
      },
      { onConflict: "workspace_id,platform,account_name" }
    );
  return true;
}

// Back-compat shim for Meta call sites (unchanged public shape).
export function saveMetaConnection(params: {
  workspaceId: string;
  userId: string;
  platform: "facebook" | "instagram";
  accountName: string;
  pageToken: string;
  metadata: Record<string, unknown>;
  expiresAt?: string | null;
}): Promise<boolean> {
  return saveConnection({
    workspaceId: params.workspaceId,
    userId: params.userId,
    platform: params.platform,
    accountName: params.accountName,
    token: params.pageToken,
    metadata: params.metadata,
    expiresAt: params.expiresAt ?? null,
  });
}

export interface DecryptedConnection {
  accountName: string;
  token: string;
  refreshToken: string | null;
  metadata: Record<string, unknown>;
}

// Load + decrypt a workspace's connected account for any platform (server-only).
export async function getConnection(
  workspaceId: string,
  platform: string
): Promise<DecryptedConnection | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("channel_connections")
    .select("account_name, access_token_encrypted, refresh_token_encrypted, metadata, status")
    .eq("workspace_id", workspaceId)
    .eq("platform", platform)
    .eq("status", "connected")
    .limit(1)
    .maybeSingle();
  if (!data?.access_token_encrypted) return null;
  const token = decryptToken(data.access_token_encrypted);
  if (!token) return null;
  const refreshToken = data.refresh_token_encrypted
    ? decryptToken(data.refresh_token_encrypted)
    : null;
  return {
    accountName: data.account_name as string,
    token,
    refreshToken,
    metadata: (data.metadata as Record<string, unknown>) ?? {},
  };
}

// Back-compat wrapper for the Meta call sites.
export function getMetaConnection(
  workspaceId: string,
  platform: "facebook" | "instagram"
): Promise<DecryptedConnection | null> {
  return getConnection(workspaceId, platform);
}
