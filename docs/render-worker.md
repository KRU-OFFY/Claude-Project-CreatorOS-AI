# Render Worker Contract

CreatorOS AI runs on Vercel/serverless — no ffmpeg, no disk, no long-running
processes. Media rendering (MP4 / TTS / templated composites) runs in a
**separate worker** on any container host (Fly.io, Railway, Cloud Run,
your own box). This doc is the HTTP contract that worker MUST satisfy.

The client side lives in `lib/render.ts`; the callback lives at
`/api/render/callback`.

## Environment variables (app-side)

| Var                    | Required | Meaning                                        |
| ---------------------- | -------- | ---------------------------------------------- |
| `RENDER_WORKER_URL`    | yes      | Base URL of the worker (e.g. `https://render.internal`)   |
| `RENDER_WORKER_SECRET` | yes      | Shared HMAC secret (`openssl rand -hex 32`)    |

Without both, the Content Studio "🎬 สั่ง render" button is hidden and
`renderConfigured()` returns false.

## 1) Enqueue — `POST {RENDER_WORKER_URL}/render`

Body (JSON):

```json
{
  "jobId": "uuid",
  "workspaceId": "uuid",
  "contentVariantId": "uuid",
  "callbackNonce": "hex(16)",
  "callbackUrl": "https://app.example.com/api/render/callback",
  "template": "square" | "vertical" | "story",
  "caption": "...",
  "hashtags": ["a", "b"],
  "cta": "ซื้อเลย" | null,
  "sourceMediaUrl": "https://..." | null
}
```

Headers:

- `content-type: application/json`
- `x-render-signature: hex(hmac_sha256(RENDER_WORKER_SECRET, body_bytes))`

The worker MUST:

1. Verify `x-render-signature` matches an HMAC-SHA256 of the raw request body
   using `RENDER_WORKER_SECRET`. Reject with 401 on mismatch.
2. Reply **within 15 seconds** — the enqueue call is a handoff, not a wait.
   Return `202 Accepted` (or 200) with an empty/JSON body.
3. Start the render in the background.

## 2) Callback — `POST {callbackUrl}` (i.e. the app's `/api/render/callback`)

Body (JSON) on success:

```json
{
  "jobId": "uuid",
  "nonce": "same hex(16) sent in enqueue",
  "ts": 1731600000,             // unix seconds when the callback is sent
  "signature": "hex(hmac_sha256(secret, jobId + '.' + nonce + '.' + ts))",
  "mediaUrl": "https://cdn.example.com/renders/<jobId>.mp4",
  "thumbnailUrl": "https://cdn.example.com/renders/<jobId>.jpg",
  "durationMs": 15200
}
```

On failure:

```json
{
  "jobId": "uuid",
  "nonce": "...",
  "ts": 1731600000,
  "signature": "...",
  "error": "font pack missing"
}
```

The app verifies:

- Signature over the exact string `<jobId>.<nonce>.<ts>`.
- `Math.abs(now - ts*1000) ≤ 5min` — kills replay attacks even if the
  signature leaks.
- `nonce` matches the row stored in `render_jobs` — a leaked signature can't
  hijack a different job later.
- The row is not already terminal — repeated callbacks are idempotent (200
  with `already_terminal`).

On success the app writes:

- `render_jobs.status = 'succeeded'`, plus `media_url`, `thumbnail_url`,
  `duration_ms`, `completed_at`.
- `content_variants.media_url = <mediaUrl>` — so the publish flow picks it
  up on the next tick / manual publish.

## Signature snippet (Node)

```ts
import crypto from "node:crypto";
const secret = process.env.RENDER_WORKER_SECRET!;
const now = Math.floor(Date.now() / 1000);
const payload = `${jobId}.${nonce}.${now}`;
const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
```

## Retry / idempotency

- The app never re-enqueues a job automatically. If the worker fails, the
  operator can retry from Content Studio.
- The worker MAY retry its callback if the app returned 5xx. The app's
  callback handler is idempotent — repeated calls for a terminal row return
  `already_terminal` without side effects.

## Sample worker skeleton

See `workers/render/` for a minimal TypeScript skeleton that satisfies the
contract. It is NOT deployed as part of this repo — pick a host and drop
the code there.
