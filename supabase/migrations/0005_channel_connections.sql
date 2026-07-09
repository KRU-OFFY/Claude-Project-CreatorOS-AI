-- 0005 — Channel Connections (social platform accounts)
-- Tokens are stored ENCRYPTED (app encrypts with TOKEN_ENCRYPTION_KEY before insert)
-- and are NEVER granted to the client — see column grants in 0009_rls_policies.sql.

create type connection_status as enum ('disconnected', 'connected', 'error');

create table channel_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  platform text not null,
  account_name text not null default '',
  access_token_encrypted text,
  refresh_token_encrypted text,
  expires_at timestamptz,
  status connection_status not null default 'disconnected',
  metadata jsonb not null default '{}'::jsonb,
  connected_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, platform, account_name)
);
create index on channel_connections (workspace_id);

create trigger channel_connections_updated_at before update on channel_connections
  for each row execute function set_updated_at();
