import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron";
import { longLivedToken } from "@/lib/meta";
import { refreshAccessToken as youtubeRefresh } from "@/lib/youtube";
import { encryptToken, decryptToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

// Token refresh worker. Extends Meta tokens that carry an explicit expiry within
// the next 7 days. Rows with a null expiry (non-expiring page tokens) are left
// alone. Best-effort per row — a failure marks the connection status 'error'.
async function handle(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const metaCutoff = new Date(Date.now() + 7 * 864e5).toISOString();
  // Google access tokens live ~1h, so a wider look-ahead would refresh every
  // token every run; 24h is enough headroom for a daily cron.
  const googleCutoff = new Date(Date.now() + 2 * 864e5).toISOString();

  let refreshed = 0;
  let errored = 0;

  // --- Meta (long-lived page tokens) ---
  const { data: metaConns } = await admin
    .from("channel_connections")
    .select("id, platform, access_token_encrypted, expires_at, status")
    .in("platform", ["facebook", "instagram"])
    .eq("status", "connected")
    .not("expires_at", "is", null)
    .lte("expires_at", metaCutoff)
    .limit(50);

  for (const c of metaConns ?? []) {
    const current = c.access_token_encrypted ? decryptToken(c.access_token_encrypted) : null;
    if (!current) {
      await admin.from("channel_connections").update({ status: "error" }).eq("id", c.id);
      errored++;
      continue;
    }
    try {
      const ll = await longLivedToken(current);
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
      const expired = c.expires_at ? new Date(c.expires_at as string) <= new Date() : false;
      if (expired) {
        await admin.from("channel_connections").update({ status: "error" }).eq("id", c.id);
      }
      errored++;
    }
  }

  // --- YouTube (short-lived access token + long-lived refresh token) ---
  const { data: youtubeConns } = await admin
    .from("channel_connections")
    .select("id, refresh_token_encrypted, expires_at, status")
    .eq("platform", "youtube")
    .eq("status", "connected")
    .not("refresh_token_encrypted", "is", null)
    .lte("expires_at", googleCutoff)
    .limit(50);

  for (const c of youtubeConns ?? []) {
    const rt = c.refresh_token_encrypted ? decryptToken(c.refresh_token_encrypted) : null;
    if (!rt) {
      await admin.from("channel_connections").update({ status: "error" }).eq("id", c.id);
      errored++;
      continue;
    }
    try {
      const t = await youtubeRefresh(rt);
      // Google usually returns the same refresh_token, and
      // refreshAccessToken already preserves the original if omitted.
      // Still, only write the column when we actually have a value so a
      // null can never nuke the stored token via this path (belt-and-
      // braces against upstream refactors).
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

  const candidates = (metaConns?.length ?? 0) + (youtubeConns?.length ?? 0);
  return NextResponse.json({ ok: true, candidates, refreshed, errored });
}

export const GET = handle;
export const POST = handle;
