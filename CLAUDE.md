# CLAUDE.md — CreatorOS AI

Guidance for working in this repo.

## What this is
Next.js 15 (App Router) + TypeScript + Tailwind + Supabase app: an omnichannel
affiliate growth OS. Spec lives in `docs/spec/` (7 files) + the Pre-Build Audit brief.

## Conventions
- **UI language is Thai**; code, identifiers, and comments are English.
- Server Components by default; Client Components (`"use client"`) only for
  interactivity (forms with local state, sidebar toggle).
- Mutations go through **server actions** in `app/(dash)/actions.ts`.
- Data reads go through `lib/data.ts` (workspace-scoped, returns empty in demo mode).
- Never let missing env crash the app — see `lib/env.ts` (`isSupabaseConfigured`,
  `isAiConfigured`). Unconfigured → `/setup`.

## Key modules
- `lib/platforms.ts` — 8-platform registry (single source of truth, from Platform Matrix).
- `lib/scoring/product-score.ts` — score formula + tier thresholds (hero≥80/growth≥60/test≥40).
- `lib/compliance/` — data-driven rule engine; per-platform config in `rules/{platform}.ts`,
  shared engine in `index.ts` (disclosure/AI-label/prohibited-claims/caption-length).
- `lib/ai/` — Anthropic calls (`index.ts`) with rule-based `fallback.ts` for demo mode.
  Default model `claude-sonnet-5` (`AI_MODEL`).
- `lib/adapters/` — `PlatformAdapter` interface + 8 stub adapters (base factory in `base.ts`).
- `lib/analytics/normalize.ts` — platform metrics → unified model + `aggregate()`.
- `lib/tokens.ts` — AES-256-GCM for social tokens (server-only).
- `lib/audit.ts` — `logAudit()` for important writes.
- `lib/supabase/{client,server,admin,middleware}.ts` — `admin.ts` is service-role, `server-only`.

## Security invariants (do not break)
- `SUPABASE_SERVICE_ROLE_KEY` server-only; `lib/supabase/admin.ts` uses `import "server-only"`.
- Social tokens encrypted + never sent to client (column grants in `0009_rls_policies.sql`).
- Every publish path verifies ownership + writes an audit log.
- No `fs`/`ffmpeg` in `app/api/**` (real render = external worker). Enforced by grep in CI/review.
- DB trigger blocks compliance-`fail` variants from `publish_queue`.

## Commands
- `npm run typecheck` · `npm run build` · `npm run dev`
- Smoke: `npm run start &` then `BASE_URL=http://localhost:3000 node scripts/smoke.mjs`

## Migrations
`supabase/migrations/0001…0010`. Every business table has `workspace_id` + RLS via
`is_workspace_member()`. Roles: owner/editor/approver/viewer.
