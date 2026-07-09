import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron";
import { longLivedToken } from "@/lib/meta";
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

  const soonIso = new Date(Date.now() + 7 * 864e5).toISOString();
  const { data: conns } = await admin
    .from("channel_connections")
    .select("id, platform, access_token_encrypted, expires_at, status")
    .in("platform", ["facebook", "instagram"])
    .eq("status", "connected")
    .not("expires_at", "is", null)
    .lte("expires_at", soonIso)
    .limit(50);

  let refreshed = 0;
  let errored = 0;

  for (const c of conns ?? []) {
    const current = c.access_token_encrypted ? decryptToken(c.access_token_encrypted) : null;
    if (!current) {
      // Undecryptable ciphertext (key rotation / corruption) can never yield a
      // usable token — this is permanent, so mark the connection 'error' so the
      // UI/publish path stops treating it as connected.
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
      // If the token is already past expiry, a failed refresh is terminal —
      // mark it 'error' so the UI/publish path stops using a dead token. If it
      // hasn't expired yet, treat the failure as transient and leave it
      // 'connected' to retry on the next run.
      const expired = c.expires_at ? new Date(c.expires_at as string) <= new Date() : false;
      if (expired) {
        await admin.from("channel_connections").update({ status: "error" }).eq("id", c.id);
      }
      errored++;
    }
  }

  return NextResponse.json({ ok: true, candidates: conns?.length ?? 0, refreshed, errored });
}

export const GET = handle;
export const POST = handle;
