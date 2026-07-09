import { NextResponse } from "next/server";
import { exchangeCode, longLivedToken, listPages } from "@/lib/meta";
import { verifyState, saveMetaConnection } from "@/lib/connections";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

// Handles the Meta OAuth redirect: exchanges the code, stores encrypted page
// tokens for Facebook (and Instagram if a business account is linked).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const settings = new URL("/settings", request.url);

  if (url.searchParams.get("error") || !code || !state) {
    settings.searchParams.set("meta", "cancelled");
    return NextResponse.redirect(settings);
  }

  const verified = verifyState(state);
  if (!verified) {
    settings.searchParams.set("meta", "bad_state");
    return NextResponse.redirect(settings);
  }

  try {
    const shortToken = await exchangeCode(url.origin, code);
    const ll = await longLivedToken(shortToken).catch(() => ({ token: shortToken, expiresAt: null }));
    const userToken = ll.token;
    const expiresAt = ll.expiresAt;
    const pages = await listPages(userToken);

    if (pages.length === 0) {
      settings.searchParams.set("meta", "no_pages");
      return NextResponse.redirect(settings);
    }

    // Use the first managed page (a fuller UI would let the user pick).
    // Page tokens derived from a long-lived user token do NOT expire, so store
    // expires_at = null (default). We keep the user-token expiry in metadata for
    // reference only — it must not drive the refresh cron.
    const page = pages[0];
    await saveMetaConnection({
      workspaceId: verified.workspaceId,
      userId: "",
      platform: "facebook",
      accountName: page.name,
      pageToken: page.access_token,
      metadata: { page_id: page.id, user_token_expires_at: expiresAt },
    });

    if (page.instagram_business_account?.id) {
      await saveMetaConnection({
        workspaceId: verified.workspaceId,
        userId: "",
        platform: "instagram",
        accountName: page.name,
        pageToken: page.access_token,
        metadata: {
          ig_user_id: page.instagram_business_account.id,
          page_id: page.id,
          user_token_expires_at: expiresAt,
        },
      });
    }

    const admin = createAdminClient();
    if (admin) {
      await logAudit(admin, {
        workspaceId: verified.workspaceId,
        action: "token.connect",
        entityType: "channel_connections",
        metadata: { platform: "meta", page: page.name },
      });
    }

    settings.searchParams.set("meta", "connected");
    return NextResponse.redirect(settings);
  } catch (e) {
    settings.searchParams.set("meta", "error");
    settings.searchParams.set(
      "msg",
      encodeURIComponent(e instanceof Error ? e.message : "unknown")
    );
    return NextResponse.redirect(settings);
  }
}
