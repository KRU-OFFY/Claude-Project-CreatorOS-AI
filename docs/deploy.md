# คู่มือ Deploy Production — CreatorOS AI

เอกสารนี้พาไปตั้งแต่ศูนย์จนถึงระบบที่รันจริงบน Vercel + Supabase พร้อม connector
Meta / TikTok / YouTube, cron อัตโนมัติ, และของเสริม (render worker, Resend, Sentry)

รายการ environment variables ทั้งหมดอยู่ที่ [`env.example`](../env.example) (repo root) —
ทุกชื่อในไฟล์นั้นตรวจกับโค้ดจริงแล้ว ใช้เป็น checklist ตอนกรอกค่าใน Vercel ได้เลย

ลำดับที่แนะนำ:

1. Supabase (database + auth)
2. Vercel (ตัวแอป + cron)
3. OAuth apps ต่อแพลตฟอร์ม (Meta / TikTok / Google)
4. ของเสริม: Render worker, Resend, Sentry
5. Smoke test หลัง deploy

---

## 1) Supabase

### 1.1 สร้างโปรเจกต์

1. สร้างโปรเจกต์ใหม่ที่ [supabase.com](https://supabase.com) (region ใกล้ผู้ใช้ เช่น Singapore)
2. ไปที่ **Project Settings → API** แล้วจดค่า 3 ตัว:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only — ห้ามหลุดไป client)

### 1.2 รัน migrations 0001–0017 ตามลำดับ

Migrations อยู่ที่ `supabase/migrations/0001…0017` ต้องรัน **เรียงตามเลข** เลือกได้ 2 ทาง:

**ทาง A — Supabase CLI (แนะนำ):**

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

**ทาง B — SQL Editor:** เปิด Dashboard → SQL Editor แล้ว paste เนื้อหาไฟล์ทีละไฟล์
จาก `0001_workspaces.sql` ไปจนถึง `0017_render_jobs.sql` ตามลำดับ

หมายเหตุต่อไฟล์:

- `0010_seed.sql` — seed เดโม (workspace + สินค้า + แคมเปญตัวอย่าง) **ข้ามได้ใน production**
- `0013_cron_optional.sql` — ทางเลือกแทน Vercel Cron ด้วย `pg_cron` + `pg_net`
  ทั้งไฟล์ถูก comment ไว้ — เปิดใช้เฉพาะกรณีในข้อ 2.3 เท่านั้น
- ทุกตาราง business มี `workspace_id` + RLS ผ่าน `is_workspace_member()` อยู่แล้ว
  ไม่ต้องตั้ง policy เพิ่มเอง

---

## 2) Vercel

### 2.1 Import และตั้งค่า env

1. Import repo นี้ที่ [vercel.com/new](https://vercel.com/new) (framework: Next.js — detect อัตโนมัติ)
2. ไปที่ **Settings → Environment Variables** แล้วกรอกค่าตาม [`env.example`](../env.example)
   อย่างน้อยต้องมี:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `TOKEN_ENCRYPTION_KEY` (สร้างด้วย `openssl rand -hex 32` — ถ้าไม่ตั้ง จะเชื่อมบัญชีโซเชียลไม่ได้)
   - `CRON_SECRET` (สร้างด้วย `openssl rand -hex 32` — ถ้าไม่ตั้ง cron routes จะปิดตัวเอง)
   - `APP_URL` = origin จริงของแอป เช่น `https://your-app.vercel.app` (ไม่มี trailing slash)
   - `ANTHROPIC_API_KEY` ถ้าต้องการ AI จริง (ไม่ตั้ง = rule-based fallback)
3. Deploy

### 2.2 Vercel Cron

ตารางเวลาอยู่ใน `vercel.json` แล้ว — Vercel อ่านอัตโนมัติตอน deploy:

| Route | Schedule | หน้าที่ |
|---|---|---|
| `/api/cron/publish` | `*/5 * * * *` (ทุก 5 นาที) | ยิงงานใน `publish_queue` ที่ถึงกำหนด |
| `/api/cron/ingest` | `0 * * * *` (รายชั่วโมง) | ดึง insights โพสต์ Meta → `analytics_metrics` |
| `/api/cron/refresh-tokens` | `0 3 * * *` (รายวัน 03:00 UTC) | ต่ออายุ token Meta / TikTok / YouTube |

เมื่อ `CRON_SECRET` ถูกตั้งใน env, Vercel Cron จะส่ง header
`Authorization: Bearer <CRON_SECRET>` ให้เอง (ตรวจใน `lib/cron.ts::authorizeCron`)

> **ข้อจำกัด plan:** Vercel Hobby รองรับ cron แบบรายวันเท่านั้น — schedule ทุก 5 นาที /
> รายชั่วโมง ต้องใช้ **Vercel Pro**

### 2.3 Fallback ถ้าไม่ใช้ Vercel Pro — pg_cron + pg_net

เปิด `supabase/migrations/0013_cron_optional.sql` แล้วทำตาม comment ในไฟล์:

1. ตั้ง `app.base_url` (URL แอปที่ deploy แล้ว) และ `app.cron_secret` (ค่าเดียวกับ `CRON_SECRET`)
   ด้วย `alter database postgres set ...` ตามตัวอย่างในไฟล์ (แล้ว reconnect)
2. Uncomment แล้วรัน migration — Postgres จะยิง `net.http_post` ไปที่ `/api/cron/*`
   พร้อม header `Authorization: Bearer ...` ตามตารางเวลาเดียวกัน

---

## 3) OAuth apps ต่อแพลตฟอร์ม

ทุก connector เป็น optional — ไม่ตั้ง env ของแพลตฟอร์มไหน ปุ่มเชื่อมบัญชีของแพลตฟอร์มนั้น
จะแสดงสถานะ "ยังไม่ตั้งค่า" และการโพสต์ใช้โหมด copy-to-post แทน

Redirect URI ด้านล่างคือ path จริงในโค้ด (`app/api/connect/{meta,tiktok,youtube}/callback`)
— แทน `<APP_URL>` ด้วย origin จริง เช่น `https://your-app.vercel.app`

### 3.1 Meta (Facebook Pages + Instagram)

1. สร้างแอปที่ [developers.facebook.com](https://developers.facebook.com) (ประเภท Business)
2. เพิ่ม product **Facebook Login** แล้วตั้ง Valid OAuth Redirect URI:
   ```
   <APP_URL>/api/connect/meta/callback
   ```
3. Scopes ที่แอปขอ (จาก `lib/meta.ts`):
   `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`,
   `instagram_basic`, `instagram_content_publish`, `read_insights`, `business_management`
4. ตั้ง env: `META_APP_ID`, `META_APP_SECRET`
   (มี `META_REDIRECT_URI` ให้ override ได้ ถ้า redirect ไม่ตรง default)

### 3.2 TikTok (Login Kit + Content Posting API)

1. สร้างแอปที่ [developers.tiktok.com](https://developers.tiktok.com)
2. เพิ่ม product **Login Kit** และ **Content Posting API** แล้วตั้ง Redirect URI:
   ```
   <APP_URL>/api/connect/tiktok/callback
   ```
3. Scopes ที่แอปขอ (จาก `lib/tiktok.ts`): `user.info.basic`, `video.publish`, `video.upload`
   — callback จะตรวจว่าผู้ใช้อนุญาต `video.publish` จริงก่อนบันทึก connection
4. ตั้ง env: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` และเลือกตั้ง
   `TIKTOK_DEFAULT_PRIVACY_LEVEL` (default `SELF_ONLY`) + `TIKTOK_REDIRECT_URI` (override)
5. **สำคัญ:** แอปที่ยังไม่ผ่าน audit ของ TikTok จะโพสต์แบบ Direct Post สู่สาธารณะไม่ได้ —
   TikTok จะคืน privacy level ที่ใช้ได้เป็น `SELF_ONLY` เท่านั้น (วิดีโอเห็นเฉพาะเจ้าของ)

### 3.3 Google / YouTube (Data API v3)

1. สร้างโปรเจกต์ใน [Google Cloud Console](https://console.cloud.google.com)
   แล้ว **enable YouTube Data API v3** (APIs & Services → Library)
2. ตั้งค่า **OAuth consent screen** (external) แล้วสร้าง OAuth Client ID (Web application)
   พร้อม Authorized redirect URI:
   ```
   <APP_URL>/api/connect/youtube/callback
   ```
3. Scopes ที่แอปขอ (จาก `lib/youtube.ts`):
   `https://www.googleapis.com/auth/youtube.upload`,
   `https://www.googleapis.com/auth/youtube.readonly`
4. ตั้ง env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` และเลือกตั้ง
   `YOUTUBE_DEFAULT_PRIVACY` (default `private`) + `GOOGLE_REDIRECT_URI` (override)

---

## 4) ของเสริม (optional)

### 4.1 Render worker — MP4 / TTS

แอปไม่ render media เอง (ไม่มี ffmpeg บน Vercel) — ต้อง deploy worker แยกบน host
ที่มี container จริง (Fly.io / Railway / Cloud Run แบบ CPU always allocated / VM ของตัวเอง)

- HTTP contract ฉบับเต็ม + ข้อควรระวัง serverless: [`docs/render-worker.md`](./render-worker.md)
- Skeleton โค้ดตัวอย่าง: `workers/render/server.ts`
- Env ฝั่งแอป: `RENDER_WORKER_URL`, `RENDER_WORKER_SECRET`, และ `APP_URL`
  (จำเป็นมากใน production — เป็น origin ที่ worker callback กลับมา)
- Env ฝั่ง worker: `RENDER_WORKER_SECRET` (ค่าเดียวกับฝั่งแอป — HMAC shared secret)

### 4.2 Resend — อีเมลคำเชิญทีม

- สมัครที่ [resend.com](https://resend.com), verify โดเมนผู้ส่ง แล้วตั้ง
  `RESEND_API_KEY` + `RESEND_FROM_EMAIL`
- ไม่ตั้งก็ใช้ระบบทีมได้ — ลิงก์เชิญจะแสดงใน UI ให้ copy ส่งเองแทน

### 4.3 Sentry — error reporting

- สร้างโปรเจกต์ Sentry แล้วตั้ง `SENTRY_DSN`
- ต้อง `npm install @sentry/node` เพิ่มเอง (เป็น optional dependency — `lib/log.ts`
  โหลดแบบ dynamic เฉพาะเมื่อ DSN ถูกตั้ง; ไม่ติดตั้งก็แค่ degrade เป็น log ปกติ)

---

## 5) Smoke test หลัง deploy

1. **Health check:**
   ```bash
   curl -s https://your-app.vercel.app/api/health
   ```
   ตรวจว่า `ok: true` และ flags ใน `checks` ตรงกับที่ตั้งใจ:
   `supabase_configured`, `supabase_reachable`, `ai_configured`,
   `render_worker_configured`, `cron_secret_configured`, `sentry_configured`,
   `resend_configured`, `meta_connector_configured`, `tiktok_connector_configured`
2. **Auth + workspace:** สมัคร/ล็อกอินที่ `/login` → ต้องเข้า `/dashboard` ได้
   (workspace ถูกสร้างอัตโนมัติตอน signup)
3. **เชื่อมแพลตฟอร์ม:** ไปที่ `/settings` → กดเชื่อม Meta / TikTok / YouTube สักตัว
   → OAuth ไป-กลับสำเร็จ และการ์ดแสดงชื่อบัญชี
4. **Publish test:** สร้าง content variant ที่ compliance ผ่าน → ตั้งเวลาหรือกดเผยแพร่
   จาก `/publish-center` → ตรวจว่ามี audit log และสถานะเปลี่ยนเป็น published
5. **Cron auth:** route ต้องปิดสำหรับคนนอกและเปิดให้ scheduler:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://your-app.vercel.app/api/cron/publish
   # ต้องได้ 401
   curl -s -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/publish
   # ต้องได้ JSON ปกติ (ไม่ใช่ 401)
   ```
6. **Local (ก่อน push):**
   ```bash
   npm run typecheck && npm test && npm run check:rls && npm run build
   npm run start &
   BASE_URL=http://localhost:3000 node scripts/smoke.mjs
   ```

---

## สิ่งที่ต้องทำเอง

สิ่งที่โค้ด/เอกสารทำแทนให้ไม่ได้ — ต้องดำเนินการกับแต่ละแพลตฟอร์มเอง:

- **Meta App Review:** scopes ที่ใช้ (`pages_manage_posts`, `instagram_content_publish`,
  `read_insights`, `business_management`, ฯลฯ) ต้องขอ **Advanced Access** ผ่าน App Review
  และส่วนใหญ่ต้องทำ **Business Verification** ก่อน — ระหว่างยังเป็น Development mode
  จะใช้ได้เฉพาะบัญชีที่มี role ในแอปเท่านั้น
- **TikTok app audit:** Direct Post สู่ feed สาธารณะต้องผ่านการ audit จาก TikTok —
  ก่อนหน้านั้นวิดีโอจะถูกจำกัดเป็น `SELF_ONLY` (ดูข้อ 3.2)
- **Google OAuth verification:** scope `youtube.upload` เป็น sensitive scope —
  consent screen สถานะ Testing จำกัด test users ~100 คนและ refresh token
  อาจหมดอายุใน 7 วัน; ใช้งานจริงต้องยื่น verification กับ Google
- **Vercel Pro หรือ pg_cron:** เลือกอย่างใดอย่างหนึ่งเพื่อให้ cron sub-daily ทำงาน (ข้อ 2.2–2.3)
- **Resend domain verification:** ตั้ง DNS records (SPF/DKIM) ของโดเมนผู้ส่งเอง
- **Render worker hosting:** เลือก host, deploy worker, ดูแล ffmpeg pipeline ของตัวเอง
  ตาม contract ใน `docs/render-worker.md`
- **เก็บ secrets ให้ปลอดภัย:** `SUPABASE_SERVICE_ROLE_KEY`, `TOKEN_ENCRYPTION_KEY`,
  `CRON_SECRET`, `RENDER_WORKER_SECRET` — หมุน (rotate) ทันทีถ้าสงสัยว่ารั่ว
  (หมายเหตุ: เปลี่ยน `TOKEN_ENCRYPTION_KEY` จะทำให้ token เดิมถอดรหัสไม่ได้ —
  ผู้ใช้ต้องเชื่อมบัญชีโซเชียลใหม่)
