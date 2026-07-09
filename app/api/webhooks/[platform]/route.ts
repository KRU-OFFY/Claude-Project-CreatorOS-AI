import { NextResponse } from "next/server";
import { PLATFORM_KEYS } from "@/lib/platforms";

// Inbound webhooks from social platforms (publish status callbacks, metric
// pushes). Serverless-safe: no filesystem/ffmpeg. Signature verification per
// platform is a future connector concern; this validates the platform slug and
// acknowledges receipt so providers don't retry indefinitely.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  if (!PLATFORM_KEYS.includes(platform as never)) {
    return NextResponse.json({ error: "unknown platform" }, { status: 404 });
  }
  // Parse payload defensively; real handlers dispatch on event type.
  await request.json().catch(() => ({}));
  return NextResponse.json({ ok: true, platform });
}

// Some providers verify webhooks with a GET challenge.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const challenge = new URL(request.url).searchParams.get("hub.challenge");
  if (challenge) return new NextResponse(challenge, { status: 200 });
  return NextResponse.json({ ok: true, platform });
}
