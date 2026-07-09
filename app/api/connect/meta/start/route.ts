import { NextResponse } from "next/server";
import { getActiveContext } from "@/lib/workspace";
import { metaConfigured, authDialogUrl } from "@/lib/meta";
import { signState } from "@/lib/connections";

// Begins the Meta (Facebook/Instagram) OAuth flow.
export async function GET(request: Request) {
  const ctx = await getActiveContext();
  if (!ctx?.workspaceId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!metaConfigured()) {
    return NextResponse.redirect(
      new URL("/settings?meta=not_configured", request.url)
    );
  }
  const origin = new URL(request.url).origin;
  const state = signState(ctx.workspaceId);
  return NextResponse.redirect(authDialogUrl(origin, state));
}
