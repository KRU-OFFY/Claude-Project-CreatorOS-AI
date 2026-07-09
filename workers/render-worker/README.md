# Render Worker (external — NOT Vercel serverless)

Real MP4/TTS rendering must not run on Vercel serverless (ffmpeg + filesystem →
ENOENT). This worker is a **separate container** you deploy on Fly.io / Railway /
Cloud Run.

## Contract

1. App enqueues a render job (variant id + script/assets) — e.g. a row/queue the
   worker polls, or a direct call to the worker's own endpoint.
2. Worker renders with `ffmpeg` (and a serverless-safe TTS provider), uploads the
   result to **Supabase Storage**.
3. Worker POSTs back to the app:

   ```
   POST {APP_URL}/api/render/callback
   Authorization: Bearer {RENDER_WORKER_SECRET}
   { "variantId": "...", "mediaUrl": "https://.../rendered.mp4" }
   ```

   On failure send `{ "variantId": "...", "error": "..." }`.

The callback handler is `app/api/render/callback/route.ts` — it updates
`content_variants.media_url` using the service-role client.

## Env (worker side)
- `APP_URL` — the deployed app URL
- `RENDER_WORKER_SECRET` — must match the app's `RENDER_WORKER_SECRET`
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — to upload to Storage

## Status
Interface + contract defined. The container implementation (Dockerfile + ffmpeg
pipeline) is out of scope for this build round and is the next connector step.
