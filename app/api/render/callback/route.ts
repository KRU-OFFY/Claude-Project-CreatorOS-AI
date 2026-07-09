import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Callback from the external Render Worker (Fly.io/Railway/Cloud Run) after it
// finishes rendering an MP4 and uploads it to Supabase Storage. The worker
// authenticates with RENDER_WORKER_SECRET. Serverless-safe: no fs/ffmpeg here.
export async function POST(request: Request) {
  const secret = process.env.RENDER_WORKER_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const variantId: string | undefined = body?.variantId;
  const mediaUrl: string | undefined = body?.mediaUrl;
  const errorMessage: string | undefined = body?.error;
  if (!variantId) {
    return NextResponse.json({ error: "variantId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  if (errorMessage) {
    return NextResponse.json({ ok: true, status: "error_logged" });
  }

  await admin
    .from("content_variants")
    .update({ media_url: mediaUrl })
    .eq("id", variantId);

  return NextResponse.json({ ok: true });
}
