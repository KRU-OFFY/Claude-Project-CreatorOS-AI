import { NextResponse } from "next/server";
import { exchangeCode, myChannel, hasUploadScope } from "@/lib/youtube";
import { verifyState, saveConnection } from "@/lib/connections";
import { getIntegrationConfig } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

// Handles the Google OAuth redirect for YouTube: exchanges the code, refuses
// to save the connection if the user denied the upload scope, and stores the
// encrypted access + refresh tokens for the workspace.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const settings = new URL("/settings", request.url);

  if (url.searchParams.get("error") || !code || !state) {
    settings.searchParams.set("youtube", "cancelled");
    return NextResponse.redirect(settings);
  }

  const verified = verifyState(state);
  if (!verified) {
    settings.searchParams.set("youtube", "bad_state");
    return NextResponse.redirect(settings);
  }

  try {
    const { google } = await getIntegrationConfig(verified.workspaceId);
    const tok = await exchangeCode(url.origin, code, google);

    // Google's consent screen lets users deny individual scopes. Without
    // youtube.upload the connection is unusable for publishing — refuse
    // to save so the UI can surface the problem instead of failing later.
    if (!hasUploadScope(tok.scope)) {
      settings.searchParams.set("youtube", "missing_scope");
      return NextResponse.redirect(settings);
    }

    const channel = await myChannel(tok.token);

    await saveConnection({
      workspaceId: verified.workspaceId,
      userId: "",
      platform: "youtube",
      accountName: channel?.title || "YouTube",
      token: tok.token,
      refreshToken: tok.refreshToken,
      metadata: {
        channel_id: channel?.id ?? null,
        scope: tok.scope,
      },
      expiresAt: tok.expiresAt,
    });

    const admin = createAdminClient();
    if (admin) {
      await logAudit(admin, {
        workspaceId: verified.workspaceId,
        action: "token.connect",
        entityType: "channel_connections",
        metadata: { platform: "youtube" },
      });
    }

    settings.searchParams.set("youtube", "connected");
    return NextResponse.redirect(settings);
  } catch (e) {
    settings.searchParams.set("youtube", "error");
    settings.searchParams.set("msg", encodeURIComponent(e instanceof Error ? e.message : "unknown"));
    return NextResponse.redirect(settings);
  }
}
