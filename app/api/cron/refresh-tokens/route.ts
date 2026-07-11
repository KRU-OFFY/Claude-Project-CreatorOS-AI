import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron, withCronBoundary } from "@/lib/cron";
import { longLivedToken } from "@/lib/meta";
import { refreshAccessToken as tiktokRefresh } from "@/lib/tiktok";
import { refreshAccessToken as youtubeRefresh } from "@/lib/youtube";
import { encryptToken, decryptToken } from "@/lib/tokens";
import {
  getIntegrationConfig,
  isWorkflowEnabled,
  type IntegrationConfig,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

// Token refresh worker. Look-ahead windows differ per platform because token
// lifetimes differ wildly: Meta page tokens live ~60 days (7d window),
// TikTok access tokens ~24h (48h window), Google/YouTube access tokens ~1h
// (48h window; the refresh_token is long-lived). Best-effort per row — a
// terminal failure marks the connection status 'error'.
async function handle(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const metaCutoff = new Date(Date.now() + 7 * 864e5).toISOString();
  const shortLivedCutoff = new Date(Date.now() + 2 * 864e5).toISOString();

  let refreshed = 0;
  let errored = 0;
  let skipped = 0;

  // Per-workspace settings, resolved once per run. `undefined` config means
  // the workspace disabled the refresh workflow at /settings/system.
  const cfgCache = new Map<string, IntegrationConfig | undefined>();
  async function workspaceConfig(wsId: string): Promise<IntegrationConfig | undefined> {
    if (!cfgCache.has(wsId)) {
      const enabled = await isWorkflowEnabled(wsId, "workflow_refresh_tokens");
      cfgCache.set(wsId, enabled ? await getIntegrationConfig(wsId) : undefined);
    }
    return cfgCache.get(wsId);
  }

  // --- Meta (long-lived page tokens) ---
  const { data: metaConns } = await admin
    .from("channel_connections")
    .select("id, workspace_id, platform, access_token_encrypted, expires_at, status")
    .in("platform", ["facebook", "instagram"])
    .eq("status", "connected")
    .not("expires_at", "is", null)
    .lte("expires_at", metaCutoff)
    .limit(50);

  for (const c of metaConns ?? []) {
    const cfg = await workspaceConfig(c.workspace_id as string);
    if (!cfg) {
      skipped++;
      continue;
    }
    const current = c.access_token_encrypted ? decryptToken(c.access_token_encrypted) : null;
    if (!current) {
      // Undecryptable ciphertext (key rotation / corruption) can never yield
      // a usable token — permanent, so mark 'error' so the UI/publish path
      // stops treating it as connected.
      await admin.from("channel_connections").update({ status: "error" }).eq("id", c.id);
      errored++;
      continue;
    }
    try {
      const ll = await longLivedToken(current, cfg.meta);
      await admin
        .from("channel_connections")
        .update({
          access_token_encrypted: encryptToken(ll.token),
          expires_at: ll.expiresAt,
          status: "connected",
        })
        .eq("id", c.id);
      refreshed++;
    } catch {
      // Past expiry ⇒ terminal; not yet ⇒ transient, retry next run.
      const expired = c.expires_at ? new Date(c.expires_at as string) <= new Date() : false;
      if (expired) {
        await admin.from("channel_connections").update({ status: "error" }).eq("id", c.id);
      }
      errored++;
    }
  }

  // --- TikTok (24h access token + rotating refresh token) ---
  const { data: tiktokConns } = await admin
    .from("channel_connections")
    .select("id, workspace_id, refresh_token_encrypted, expires_at, status")
    .eq("platform", "tiktok")
    .eq("status", "connected")
    .not("refresh_token_encrypted", "is", null)
    .lte("expires_at", shortLivedCutoff)
    .limit(50);

  for (const c of tiktokConns ?? []) {
    const cfg = await workspaceConfig(c.workspace_id as string);
    if (!cfg) {
      skipped++;
      continue;
    }
    const rt = c.refresh_token_encrypted ? decryptToken(c.refresh_token_encrypted) : null;
    if (!rt) {
      await admin.from("channel_connections").update({ status: "error" }).eq("id", c.id);
      errored++;
      continue;
    }
    try {
      const t = await tiktokRefresh(rt, cfg.tiktok);
      // TikTok rotates the refresh token on every refresh — persist the new
      // one, otherwise the next tick uses a revoked value. Only write the
      // column when we actually have a value.
      const update: Record<string, unknown> = {
        access_token_encrypted: encryptToken(t.token),
        expires_at: t.expiresAt,
        status: "connected",
      };
      if (t.refreshToken) update.refresh_token_encrypted = encryptToken(t.refreshToken);
      await admin.from("channel_connections").update(update).eq("id", c.id);
      refreshed++;
    } catch {
      const expired = c.expires_at ? new Date(c.expires_at as string) <= new Date() : false;
      if (expired) {
        await admin.from("channel_connections").update({ status: "error" }).eq("id", c.id);
      }
      errored++;
    }
  }

  // --- YouTube (1h access token + long-lived refresh token) ---
  const { data: youtubeConns } = await admin
    .from("channel_connections")
    .select("id, workspace_id, refresh_token_encrypted, expires_at, status")
    .eq("platform", "youtube")
    .eq("status", "connected")
    .not("refresh_token_encrypted", "is", null)
    .lte("expires_at", shortLivedCutoff)
    .limit(50);

  for (const c of youtubeConns ?? []) {
    const cfg = await workspaceConfig(c.workspace_id as string);
    if (!cfg) {
      skipped++;
      continue;
    }
    const rt = c.refresh_token_encrypted ? decryptToken(c.refresh_token_encrypted) : null;
    if (!rt) {
      await admin.from("channel_connections").update({ status: "error" }).eq("id", c.id);
      errored++;
      continue;
    }
    try {
      const t = await youtubeRefresh(rt, cfg.google);
      // Google usually returns the same refresh_token, and youtubeRefresh
      // preserves the original when omitted. Only write the column when we
      // actually have a value so null can never nuke the stored token.
      const update: Record<string, unknown> = {
        access_token_encrypted: encryptToken(t.token),
        expires_at: t.expiresAt,
        status: "connected",
      };
      if (t.refreshToken) update.refresh_token_encrypted = encryptToken(t.refreshToken);
      await admin.from("channel_connections").update(update).eq("id", c.id);
      refreshed++;
    } catch {
      const expired = c.expires_at ? new Date(c.expires_at as string) <= new Date() : false;
      if (expired) {
        await admin.from("channel_connections").update({ status: "error" }).eq("id", c.id);
      }
      errored++;
    }
  }

  const candidates =
    (metaConns?.length ?? 0) + (tiktokConns?.length ?? 0) + (youtubeConns?.length ?? 0);
  return NextResponse.json({ ok: true, candidates, refreshed, errored, skipped });
}

const wrapped = withCronBoundary("refresh-tokens", handle);
export const GET = wrapped;
export const POST = wrapped;
