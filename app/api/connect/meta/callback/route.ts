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
    const userToken = await longLivedToken(shortToken).catch(() => shortToken);
    const pages = await listPages(userToken);

    if (pages.length === 0) {
      settings.searchParams.set("meta", "no_pages");
      return NextResponse.redirect(settings);
    }

    // Use the first managed page (a fuller UI would let the user pick).
    const page = pages[0];
    await saveMetaConnection({
      workspaceId: verified.workspaceId,
      userId: "",
      platform: "facebook",
      accountName: page.name,
      pageToken: page.access_token,
      metadata: { page_id: page.id },
    });

    if (page.instagram_business_account?.id) {
      await saveMetaConnection({
        workspaceId: verified.workspaceId,
        userId: "",
        platform: "instagram",
        accountName: page.name,
        pageToken: page.access_token,
        metadata: { ig_user_id: page.instagram_business_account.id, page_id: page.id },
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
