-- 0004 — Compliance Gate

create type compliance_status as enum ('pass', 'fail', 'needs_review');

create table compliance_checks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  content_variant_id uuid not null references content_variants(id) on delete cascade,
  platform text not null,
  disclosure_ok boolean not null default false,
  ai_label_ok boolean not null default false,
  claim_risk_score numeric(5,2) not null default 0,
  issues jsonb not null default '[]'::jsonb,
  status compliance_status not null default 'needs_review',
  human_approved_by uuid references auth.users(id),
  human_approved_at timestamptz,
  checked_at timestamptz not null default now()
);
create index on compliance_checks (workspace_id, content_variant_id);
