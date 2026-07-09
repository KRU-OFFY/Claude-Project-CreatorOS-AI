# Claude Code Master Prompt — CreatorOS AI

## Role
You are a Senior Full-stack Architect, Security Reviewer, UX System Designer, and Production Engineer.

## Mission
Build CreatorOS AI as a production-ready omnichannel affiliate growth operating system.

Important:
Do not start coding immediately.
Before building, perform a complete architecture audit.

---

# Phase 0 — Mandatory Pre-build Audit

Analyze the existing project structure and report:

## 1. User Flow Audit
- Is the user journey confusing?
- Are there missing steps?
- Are there duplicate or unnecessary steps?
- Does the flow clearly connect Product → Campaign → Content → Compliance → Publish → Analytics?

## 2. Database Audit
- Does the schema support multiple platforms?
- Does every business table support workspace_id/user ownership?
- Are RLS policies required?
- Are status, error_message, retry_count and audit logs included?

## 3. Security Audit
- No service role key in frontend
- Social tokens must never be exposed to client
- All publish actions must verify ownership
- Protected routes must exist
- Audit logs must track important actions

## 4. Serverless Audit
- Do not use filesystem or ffmpeg directly in Vercel serverless API routes
- TTS fallback must be serverless-safe
- Real MP4 rendering must use external worker or Supabase Storage pipeline
- /api/health must exist

## 5. Platform Audit
The system must support:
- Facebook
- Instagram
- TikTok
- X
- YouTube
- Lemon8
- Shopee Video
- Shopee Live

## 6. Compliance Audit
The system must check:
- Affiliate disclosure
- AI-generated label
- Prohibited claims
- Platform-specific caption rules
- Human approval before publish

---

# Phase 1 — Improvement Plan Before Build

Before writing code, propose:
- Problems found
- Risk level
- Recommended fixes
- Files to create or modify
- Database migrations
- Acceptance criteria
- Sprint plan

Wait for approval before Phase 2.

---

# Phase 2 — Build Requirements

## Tech Stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- Vercel

## Pages
- /login
- /dashboard
- /products
- /campaigns
- /content-studio
- /compliance
- /publish-center
- /calendar
- /analytics
- /revenue-forecast
- /ai-advisor
- /settings

## Core Modules
1. Auth + Workspace
2. Product Intelligence
3. Campaign Manager
4. AI Content Studio
5. Compliance Gate
6. Omnichannel Publishing Hub
7. Unified Calendar
8. Analytics Center
9. Revenue Forecast
10. AI Advisor
11. Audit Logs

---

# Phase 3 — Testing

Run:
- npm run typecheck
- npm run build
- route smoke tests
- API smoke tests
- auth simulation
- no missing ENV crash test
- no serverless filesystem crash test
- publishing workflow simulation

---

# Phase 4 — Final Report

Report:
- What was built
- What was fixed
- Remaining limitations
- Deployment steps
- Environment variables
- Future connector roadmap
