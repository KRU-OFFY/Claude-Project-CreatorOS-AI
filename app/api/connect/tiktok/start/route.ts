import { NextResponse } from "next/server";
import { getActiveContext } from "@/lib/workspace";
import { tiktokConfigured, authUrl } from "@/lib/tiktok";
import { getIntegrationConfig } from "@/lib/settings";
import { signState } from "@/lib/connections";

// Begins the TikTok OAuth flow.
export async function GET(request: Request) {
  const ctx = await getActiveContext();
  if (!ctx?.workspaceId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const { tiktok } = await getIntegrationConfig(ctx.workspaceId);
  if (!tiktokConfigured(tiktok)) {
    return NextResponse.redirect(new URL("/settings?tiktok=not_configured", request.url));
  }
  const origin = new URL(request.url).origin;
  const state = signState(ctx.workspaceId);
  return NextResponse.redirect(authUrl(origin, state, tiktok));
}
