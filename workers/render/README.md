# Sample Render Worker

**This directory is NOT deployed with the app.** It's a starter skeleton for
the external service defined by `docs/render-worker.md`.

Pick a host (Fly.io / Railway / Cloud Run / your box), copy this file, install
the deps, add ffmpeg to the runtime image, and point `RENDER_WORKER_URL` at
the resulting HTTPS endpoint. Set `RENDER_WORKER_SECRET` to the same value on
both sides.

## What this stub covers

- HMAC verification on the enqueue POST.
- HMAC signing on the callback POST (with a fresh timestamp so replays are
  rejected).
- Idempotent placeholder render (writes nothing — just calls back with a
  fake media URL) so you can end-to-end the flow before wiring real ffmpeg.

Replace `renderMp4()` with your actual ffmpeg / template compositor. Everything
else is contract-faithful.

## Files

- `server.ts` — Express-style handler skeleton (framework-agnostic).
