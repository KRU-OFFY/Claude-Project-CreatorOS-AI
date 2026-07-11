# CreatorOS AI

> One AI. Every Platform.

AI Operating System สำหรับ Creator และ Affiliate — ค้นหาสินค้า → วิเคราะห์โอกาส → สร้างคอนเทนต์ →
ตรวจ Compliance → เลือกช่องทาง → เผยแพร่ → ติดตาม KPI → ให้ AI แนะนำรอบถัดไป ครบในระบบเดียว
รองรับ 8 แพลตฟอร์ม: Facebook, Instagram, TikTok, X, YouTube, Lemon8, Shopee Video, Shopee Live.

## Tech Stack

- **Next.js 15** (App Router) · **TypeScript** · **Tailwind CSS**
- **Supabase** — Auth · PostgreSQL (RLS) · Storage
- **Anthropic Claude** (`@anthropic-ai/sdk`) — AI Content Studio / scoring / advisor / forecast (มี rule-based fallback)
- **Vercel** สำหรับแอป + **External Render Worker** แยกต่างหากสำหรับ MP4/TTS (ไม่รันบน Vercel serverless)

## Guided Workflow

```
Product → Campaign → AI Content → Compliance → Channel Selection → Calendar → Publish → Analytics → Forecast → AI Advisor
```

## Features

- **11 หน้า dashboard:** `/dashboard` `/products` `/campaigns` `/content-studio` `/compliance`
  `/publish-center` `/calendar` `/analytics` `/revenue-forecast` `/ai-advisor` `/settings`
  (+ `/login`, `/setup`, `/invite/[token]`)
- **Team management:** เชิญสมาชิกทางอีเมล/ลิงก์ (`/settings/team`), role owner/editor/approver/viewer,
  โอน ownership แบบ atomic, audit log ทุก action
- **Compliance engine + Thai packs:** rule ต่อแพลตฟอร์ม (`lib/compliance/rules/*`) +
  ชุดกฎไทย `rules/th/` (เครื่องสำอาง / สุขภาพ-อาหารเสริม / การเงิน)
- **AI Advisor + Revenue Forecast:** วิเคราะห์ trend จาก analytics (`lib/analytics/trends.ts`)
  และแนะนำรอบถัดไป (Claude หรือ rule-based fallback)
- **Live connectors 3 แพลตฟอร์ม:** Meta (Facebook Pages + Instagram), TikTok (Content Posting API),
  YouTube (Data API v3) — OAuth เต็มรูปแบบ, token เข้ารหัส AES-256-GCM, refresh อัตโนมัติ;
  แพลตฟอร์มที่เหลือเป็น stub โหมด copy-to-post
- **Automation:** cron 3 ตัว (publish / ingest insights / refresh tokens) + structured logging
  (`lib/log.ts`) + Sentry (optional)
- **Render worker interface:** contract สำหรับ render MP4/TTS ภายนอก (HMAC-signed,
  ดู `docs/render-worker.md`)

## Getting Started

```bash
npm install
npm run dev          # รันได้ทันทีแบบ zero-config (demo mode → หน้า /setup)
```

เมื่อพร้อมเชื่อมของจริง copy template แล้วกรอกค่า:

```bash
cp env.example .env.local
```

ตัวแปรทั้งหมดมีคำอธิบายใน [`env.example`](./env.example) — สรุปย่อ:

| กลุ่ม | ตัวแปร | จำเป็น |
|---|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL` `NEXT_PUBLIC_SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` | ✅ (ไม่ตั้ง = demo mode) |
| Security | `TOKEN_ENCRYPTION_KEY` `CRON_SECRET` (สร้างด้วย `openssl rand -hex 32`) | ✅ ใน production |
| App | `APP_URL` `LOG_LEVEL` | แนะนำ |
| AI | `ANTHROPIC_API_KEY` `AI_MODEL` (default `claude-sonnet-5`) | ⬜ |
| Meta | `META_APP_ID` `META_APP_SECRET` | ⬜ |
| TikTok | `TIKTOK_CLIENT_KEY` `TIKTOK_CLIENT_SECRET` `TIKTOK_DEFAULT_PRIVACY_LEVEL` | ⬜ |
| YouTube | `GOOGLE_CLIENT_ID` `GOOGLE_CLIENT_SECRET` `YOUTUBE_DEFAULT_PRIVACY` | ⬜ |
| Render | `RENDER_WORKER_URL` `RENDER_WORKER_SECRET` | ⬜ |
| Email | `RESEND_API_KEY` `RESEND_FROM_EMAIL` | ⬜ |
| Observability | `SENTRY_DSN` | ⬜ |

## Database

Migrations อยู่ที่ `supabase/migrations/` (**0001–0017**) — apply ด้วย Supabase CLI:

```bash
supabase link --project-ref <ref>
supabase db push
```

- `0010` เป็น demo seed (ข้ามได้ใน production) · `0013` เป็น pg_cron ทางเลือก (comment ไว้ทั้งไฟล์)

โครงสร้างหลัก: `workspaces`, `workspace_members` (role: owner/editor/approver/viewer),
`workspace_invitations`, `products`, `campaigns`, `content_items`, `content_variants`,
`compliance_checks`, `channel_connections`, `publish_queue`, `analytics_metrics`,
`commissions`, `render_jobs`, `audit_logs`.

**Security ที่บังคับใน schema:**
- ทุกตาราง business มี `workspace_id` + RLS (isolation ตาม membership)
- token columns ของ `channel_connections` ไม่ถูก grant ให้ client — เก็บฝั่ง server เท่านั้น
- Trigger (`0006`) บล็อก content variant สถานะ `fail` ไม่ให้เข้า `publish_queue` ที่ระดับ DB
- `audit_logs` เป็น insert-only

## Testing

```bash
npm run typecheck    # TypeScript
npm test             # unit tests (vitest) — publish, tokens, compliance, team, ฯลฯ
npm run check:rls    # linter ตรวจว่าทุกตารางใน migrations มี RLS
npm run build        # production build
npm run start &      # แล้ว:
BASE_URL=http://localhost:3000 node scripts/smoke.mjs
```

## Deployment

คู่มือฉบับเต็มทีละขั้น (Supabase → Vercel → OAuth apps → smoke test):
**[`docs/deploy.md`](./docs/deploy.md)**

สรุปย่อ:

1. สร้างโปรเจกต์ Supabase แล้วรัน migrations `0001–0017`
2. Deploy บน **Vercel** — กรอก env ตาม [`env.example`](./env.example)
3. สร้าง OAuth apps: Meta developers / TikTok developers / Google Cloud Console
   (redirect URIs: `<APP_URL>/api/connect/{meta,tiktok,youtube}/callback`)
4. (optional) Deploy render worker บน Fly.io/Railway/Cloud Run ตาม `docs/render-worker.md`
5. ตรวจ `/api/health` ว่า flags ครบ

## Automation (Cron)

Core loop ทำงานเองผ่าน `/api/cron/*` (ป้องกันด้วย `CRON_SECRET` — `Authorization: Bearer`):

| Route | หน้าที่ | ตารางเวลา (`vercel.json`) |
|---|---|---|
| `/api/cron/publish` | ยิงงานใน `publish_queue` ที่ถึงเวลา (`scheduled_at <= now`) ผ่าน connector | ทุก 5 นาที |
| `/api/cron/ingest` | ดึง insights ของโพสต์ Meta ที่เผยแพร่แล้ว → เขียน `analytics_metrics` | รายชั่วโมง |
| `/api/cron/refresh-tokens` | ต่ออายุ token Meta / TikTok / YouTube ที่ใกล้หมด | รายวัน 03:00 UTC |

**หมายเหตุ:** Vercel Hobby รองรับ cron รายวันเท่านั้น — sub-daily ต้องใช้ **Vercel Pro**
ถ้าไม่ใช้ Pro ให้เปิด `supabase/migrations/0013_cron_optional.sql`
(pg_cron + pg_net เรียก route เดียวกันจากใน Postgres) แทน

## Connector Status

| แพลตฟอร์ม | สถานะ |
|---|---|
| Facebook / Instagram (Meta) | ✅ OAuth + publish + insights + token refresh |
| TikTok | ✅ OAuth + Direct Post (privacy level ตามสถานะ audit ของแอป) + token refresh |
| YouTube | ✅ OAuth + video upload + token refresh |
| X / Lemon8 / Shopee Video / Shopee Live | 🔲 stub — โหมด copy-to-post |

ขั้นถัดไป: implement connector ที่เหลือ แล้วดึง analytics จริงเข้ามาแทนการกรอก manual.
