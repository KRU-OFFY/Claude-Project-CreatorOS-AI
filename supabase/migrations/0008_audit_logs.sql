-- 0008 — Audit Logs (login, publish, token connect/disconnect, compliance override, role change)

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on audit_logs (workspace_id, created_at);
