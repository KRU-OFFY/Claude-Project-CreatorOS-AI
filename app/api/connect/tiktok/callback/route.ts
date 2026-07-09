import { NextResponse } from "next/server";
import { exchangeCode, creatorInfo } from "@/lib/tiktok";
import { verifyState, saveConnection } from "@/lib/connections";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/tokens";
import { logAudit } from "@/lib/audit";

// Handles the TikTok OAuth redirect: exchanges the code and stores the encrypted
// access token (+ encrypted refresh token in metadata) for the workspace.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const settings = new URL("/settings", request.url);

  if (url.searchParams.get("error") || !code || !state) {
    settings.searchParams.set("tiktok", "cancelled");
    return NextResponse.redirect(settings);
  }

  const verified = verifyState(state);
  if (!verified) {
    settings.searchParams.set("tiktok", "bad_state");
    return NextResponse.redirect(settings);
  }

  try {
    const tok = await exchangeCode(url.origin, code);
    const info = await creatorInfo(tok.token);

    await saveConnection({
      workspaceId: verified.workspaceId,
      userId: "",
      platform: "tiktok",
      accountName: info?.nickname || "TikTok",
      token: tok.token,
      // Refresh token is a secret too — store it encrypted, not in plaintext.
      metadata: {
        open_id: tok.openId,
        refresh_token_encrypted: tok.refreshToken ? encryptToken(tok.refreshToken) : null,
      },
      expiresAt: tok.expiresAt,
    });

    const admin = createAdminClient();
    if (admin) {
      await logAudit(admin, {
        workspaceId: verified.workspaceId,
        action: "token.connect",
        entityType: "channel_connections",
        metadata: { platform: "tiktok" },
      });
    }

    settings.searchParams.set("tiktok", "connected");
    return NextResponse.redirect(settings);
  } catch (e) {
    settings.searchParams.set("tiktok", "error");
    settings.searchParams.set("msg", encodeURIComponent(e instanceof Error ? e.message : "unknown"));
    return NextResponse.redirect(settings);
  }
}
