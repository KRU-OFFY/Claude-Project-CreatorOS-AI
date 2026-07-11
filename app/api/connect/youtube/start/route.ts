import { NextResponse } from "next/server";
import { getActiveContext } from "@/lib/workspace";
import { youtubeConfigured, authUrl } from "@/lib/youtube";
import { getIntegrationConfig } from "@/lib/settings";
import { signState } from "@/lib/connections";

// Begins the YouTube (Google) OAuth flow.
export async function GET(request: Request) {
  const ctx = await getActiveContext();
  if (!ctx?.workspaceId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const { google } = await getIntegrationConfig(ctx.workspaceId);
  if (!youtubeConfigured(google)) {
    return NextResponse.redirect(new URL("/settings?youtube=not_configured", request.url));
  }
  const origin = new URL(request.url).origin;
  const state = signState(ctx.workspaceId);
  return NextResponse.redirect(authUrl(origin, state, google));
}
