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
- Env template is `env.example` at the repo root (committed — the name
  intentionally doesn't match the `.env*` gitignore pattern). Keep it in sync
  when adding/removing `process.env.*` reads.

## Key modules
- `lib/platforms.ts` — 8-platform registry (single source of truth, from Platform Matrix).
- `lib/scoring/product-score.ts` — score formula + tier thresholds (hero≥80/growth≥60/test≥40).
- `lib/compliance/` — data-driven rule engine; per-platform config in `rules/{platform}.ts`,
  shared engine in `index.ts` (disclosure/AI-label/prohibited-claims/caption-length).
  Thai category packs in `rules/th/{cosmetics,health,financial}.ts`.
- `lib/ai/` — Anthropic calls (`index.ts`) with rule-based `fallback.ts` for demo mode.
  Default model `claude-sonnet-5` (`AI_MODEL`).
- `lib/adapters/` — `PlatformAdapter` interface + 8 stub adapters (base factory in `base.ts`).
- `lib/analytics/normalize.ts` — platform metrics → unified model + `aggregate()`.
  `lib/analytics/trends.ts` — trend extraction feeding forecast + AI advisor.
- `lib/tokens.ts` — AES-256-GCM for social tokens (server-only).
- `lib/settings.ts` — workspace settings registry + resolution (DB → env →
  default); secrets encrypted in `workspace_settings.value_encrypted`
  (owner-write, not client-selectable); workflow toggles via
  `isWorkflowEnabled()`; UI at `/settings/system`.
- `lib/meta.ts` / `lib/tiktok.ts` / `lib/youtube.ts` — live connectors (OAuth,
  publish, insights/refresh); OAuth routes in `app/api/connect/{meta,tiktok,youtube}/`.
- `lib/team.ts` — invites (token gen, Resend email w/ log fallback), role rules,
  `TEAM_ACTIONS` audit taxonomy.
- `lib/render.ts` — external render-worker client (HMAC enqueue + callback
  verification); contract in `docs/render-worker.md`, skeleton in `workers/render/`.
- `lib/log.ts` — structured JSON logger (`LOG_LEVEL`) + optional Sentry via
  `SENTRY_DSN` (`reportError`); cron boundary in `lib/cron.ts::withCronBoundary`.
- `lib/audit.ts` — `logAudit()` for important writes.
- `lib/supabase/{client,server,admin,middleware}.ts` — `admin.ts` is service-role, `server-only`.

## Security invariants (do not break)
- `SUPABASE_SERVICE_ROLE_KEY` server-only; `lib/supabase/admin.ts` uses `import "server-only"`.
- Social tokens encrypted + never sent to client (column grants in `0009_rls_policies.sql`). Refresh tokens live in the dedicated `refresh_token_encrypted` column — never in `metadata` (which RLS grants clients `select` on).
- Every publish path verifies ownership + writes an audit log.
- No `fs`/`ffmpeg` in `app/api/**` (real render = external worker). Enforced by grep in CI/review.
- DB trigger blocks compliance-`fail` variants from `publish_queue`.

## Commands
- `npm run typecheck` · `npm test` (vitest) · `npm run check:rls` (RLS linter over
  migrations) · `npm run build` · `npm run dev`
- Smoke: `npm run start &` then `BASE_URL=http://localhost:3000 node scripts/smoke.mjs`

## Claude Code config (`.claude/`)
Team-shared config lives in `.claude/settings.json` (committed). It:
- Auto-approves safe read-only commands (`npm run typecheck|lint|test|build|check:rls`, `git status|diff|log|show|fetch origin`) so common workflows don't prompt.
- Denies destructive operations (`git push origin main|master`, force-push, `rm -rf /|~`, reads of `.env*` / `*.pem` / `*.key`).
- Runs two hooks (scripts in `.claude/hooks/`, POSIX sh + optional `jq`):
  - `guard-git-push.sh` (PreToolUse Bash) — blocks direct push to `main`/`master` and any `--force`/`-f` push. Exit 2 aborts the tool call.
  - `post-edit-check.sh` (PostToolUse Edit|Write|MultiEdit) — non-blocking reminders after edits: touch a `.ts`/`.tsx` → nudge `npm run typecheck`; touch a migration → nudge `npm run check:rls`; touch `env.example` / `package.json` → nudge doc/lockfile sync.

Personal overrides go in `.claude/settings.local.json` (gitignored).

## Automation (cron)
- `/api/cron/{publish,ingest,refresh-tokens}` — protected by `CRON_SECRET` (`authorizeCron` in `lib/cron.ts`); scheduled in `vercel.json`.
- Publish core is shared: `lib/publish.ts::executePublish` is called by both the `publishNow` action and the publish cron. Cron uses the service-role admin client and scopes by `job.workspace_id`.
- `lib/meta.ts` insights (`facebookPostInsights` / `instagramMediaInsights`) feed `analytics_metrics` (source=`api`) via the ingest cron.
- TikTok: `hasPublishScope` gates the OAuth callback (user can deny `video.publish`); `publishVideo` requires `privacy_level` (fetched via `creatorInfo.privacyLevelOptions`, defaults to `TIKTOK_DEFAULT_PRIVACY_LEVEL` or `SELF_ONLY`); refresh cron rotates both access + refresh tokens (TikTok returns a new refresh_token on every refresh).

## Migrations
`supabase/migrations/0001…0018`. Every business table has `workspace_id` + RLS via
`is_workspace_member()`. Roles: owner/editor/approver/viewer. `0013` is an optional
pg_cron alternative to Vercel Cron (commented out). `0010` is an optional demo seed.
`0015`/`0016` add team invitations + RPCs; `0017` adds `render_jobs`;
`0018` adds `workspace_settings` (Track L settings center).
