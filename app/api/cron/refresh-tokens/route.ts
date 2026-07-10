import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron";
import { longLivedToken } from "@/lib/meta";
import { refreshAccessToken as tiktokRefresh } from "@/lib/tiktok";
import { encryptToken, decryptToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

// Token refresh worker. Extends tokens whose expiry lands within the next 7
// days. Meta page tokens (null expiry) are left alone; TikTok access tokens
// expire in ~24h so its cutoff is tighter (48h look-ahead — see below).
// Best-effort per row — a hard failure marks the connection status 'error'.
async function handle(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const metaCutoff = new Date(Date.now() + 7 * 864e5).toISOString();
  // TikTok access tokens live ~24h so a 7-day look-ahead would refresh every
  // token every run; 48h is enough headroom for a daily cron.
  const tiktokCutoff = new Date(Date.now() + 2 * 864e5).toISOString();

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

  // --- TikTok (short-lived access token + refresh token) ---
  const { data: tiktokConns } = await admin
    .from("channel_connections")
    .select("id, refresh_token_encrypted, expires_at, status")
    .eq("platform", "tiktok")
    .eq("status", "connected")
    .not("refresh_token_encrypted", "is", null)
    .lte("expires_at", tiktokCutoff)
    .limit(50);

  for (const c of tiktokConns ?? []) {
    const rt = c.refresh_token_encrypted ? decryptToken(c.refresh_token_encrypted) : null;
    if (!rt) {
      await admin.from("channel_connections").update({ status: "error" }).eq("id", c.id);
      errored++;
      continue;
    }
    try {
      const t = await tiktokRefresh(rt);
      await admin
        .from("channel_connections")
        .update({
          access_token_encrypted: encryptToken(t.token),
          // TikTok rotates the refresh token on every refresh — persist the
          // new one, otherwise the next tick uses a revoked value.
          refresh_token_encrypted: t.refreshToken ? encryptToken(t.refreshToken) : null,
          expires_at: t.expiresAt,
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

  const candidates = (metaConns?.length ?? 0) + (tiktokConns?.length ?? 0);
  return NextResponse.json({ ok: true, candidates, refreshed, errored });
}

export const GET = handle;
export const POST = handle;
