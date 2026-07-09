# CreatorOS AI

> One AI. Every Platform.

AI Operating System สำหรับ Creator และ Affiliate — ค้นหาสินค้า → วิเคราะห์โอกาส → สร้างคอนเทนต์ →
ตรวจ Compliance → เลือกช่องทาง → เผยแพร่ → ติดตาม KPI → ให้ AI แนะนำรอบถัดไป ครบในระบบเดียว
รองรับ 8 แพลตฟอร์ม: Facebook, Instagram, TikTok, X, YouTube, Lemon8, Shopee Video, Shopee Live.

## Tech Stack

- **Next.js 15** (App Router) · **TypeScript** · **Tailwind CSS**
- **Supabase** — Auth · PostgreSQL (RLS) · Storage
- **Anthropic Claude** (`@anthropic-ai/sdk`) — AI Content Studio / scoring / advisor (มี rule-based fallback)
- **Vercel** สำหรับแอป + **External Render Worker** แยกต่างหากสำหรับ MP4/TTS (ไม่รันบน Vercel serverless)

## Guided Workflow

```
Product → Campaign → AI Content → Compliance → Channel Selection → Calendar → Publish → Analytics → Forecast → AI Advisor
```

## Pages (12)

`/login` `/dashboard` `/products` `/campaigns` `/content-studio` `/compliance`
`/publish-center` `/calendar` `/analytics` `/revenue-forecast` `/ai-advisor` `/settings`

## Getting Started

```bash
npm install
cp .env.local.example .env.local   # แล้วกรอกค่า (ดูด้านล่าง)
npm run dev
```

หากยังไม่ตั้งค่า Supabase แอปจะยังรันได้และพาไปหน้า `/setup` (ไม่ crash).

### Environment Variables

| ตัวแปร | จำเป็น | ใช้ทำอะไร |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | server-only — token ops + system writes (ห้าม import จาก client) |
| `ANTHROPIC_API_KEY` | ⬜ | เปิดใช้ AI จริง (ไม่ใส่ = โหมด rule-based demo) |
| `AI_MODEL` | ⬜ | ค่าเริ่มต้น `claude-sonnet-5` |
| `TOKEN_ENCRYPTION_KEY` | ⬜ | 32-byte hex/base64 เข้ารหัส social token (`openssl rand -hex 32`) |
| `RENDER_WORKER_URL` / `RENDER_WORKER_SECRET` | ⬜ | External Render Worker |
| `META_/TIKTOK_/X_/YOUTUBE_/LEMON8_/SHOPEE_ACCESS_TOKEN` | ⬜ | เปิดการโพสต์จริงต่อแพลตฟอร์ม |

## Database

Migrations อยู่ที่ `supabase/migrations/` (0001–0010) — apply ด้วย Supabase CLI หรือ MCP:

```bash
supabase link --project-ref <ref>
supabase db push
```

โครงสร้างหลัก: `workspaces`, `workspace_members` (role: owner/editor/approver/viewer),
`products`, `campaigns`, `content_items`, `content_variants`, `compliance_checks`,
`channel_connections`, `publish_queue`, `analytics_metrics`, `commissions`, `audit_logs`.

**Security ที่บังคับใน schema:**
- ทุกตาราง business มี `workspace_id` + RLS (isolation ตาม membership)
- token columns ของ `channel_connections` ไม่ถูก grant ให้ client — เก็บฝั่ง server เท่านั้น
- Trigger (`0006`) บล็อก content variant สถานะ `fail` ไม่ให้เข้า `publish_queue` ที่ระดับ DB
- `audit_logs` เป็น insert-only

## Testing

```bash
npm run typecheck
npm run build
npm run start &                       # แล้ว:
BASE_URL=http://localhost:3000 node scripts/smoke.mjs
```

## Deployment

1. Deploy แอปบน **Vercel** (ตั้งค่า env ทั้งหมด)
2. Apply migrations ไป Supabase
3. (ถ้าต้อง render MP4 จริง) deploy `workers/render-worker/` บน Fly.io/Railway/Cloud Run
   แล้วชี้ `RENDER_WORKER_URL` มาที่มัน — worker เขียนผลลง Supabase Storage และ callback
   `/api/render/callback`

## Connector Roadmap

รอบนี้ Platform Adapter Layer เป็น interface เดียว + stub (โหมด copy-to-post เมื่อไม่มี credentials).
ขั้นถัดไป: implement OAuth + publish API จริงต่อ Meta / TikTok / YouTube / X / Shopee แล้วดึง
analytics จริงเข้ามาแทนการกรอก manual.
