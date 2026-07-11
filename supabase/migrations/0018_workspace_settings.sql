-- 0018 — Workspace settings (Track L: in-app system settings center)
-- Key-value store for per-workspace configuration edited at /settings/system.
-- Two kinds of values:
--   * value            — non-secret settings (workflow toggles, defaults)
--   * value_encrypted  — secrets (API keys), AES-256-GCM via lib/tokens.ts,
--                        written/read only through the service-role client
-- Resolution order in lib/settings.ts is DB → process.env → registry default,
-- so a deployment that keeps everything in Vercel env keeps working unchanged.
--
-- Deliberately separate from the legacy `settings` jsonb table (0001): that one
-- is member-readable and editor-writable, which is wrong for secrets. This
-- table is owner-write and its encrypted column is not client-selectable.

create table workspace_settings (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  key text not null,
  value text,
  value_encrypted text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, key)
);

create trigger workspace_settings_updated_at before update on workspace_settings
  for each row execute function set_updated_at();

alter table workspace_settings enable row level security;

-- Members may read non-secret settings (column grant below hides secrets).
create policy "member read" on workspace_settings
  for select using (is_workspace_member(workspace_id));

-- Only the workspace owner may change system settings.
create policy "owner insert" on workspace_settings
  for insert with check (workspace_role(workspace_id) = 'owner');
create policy "owner update" on workspace_settings
  for update using (workspace_role(workspace_id) = 'owner');
create policy "owner delete" on workspace_settings
  for delete using (workspace_role(workspace_id) = 'owner');

-- Secret protection (same pattern as channel_connections token columns):
-- clients can never select value_encrypted — server code uses the
-- service-role client for secret reads/writes.
revoke select on workspace_settings from anon, authenticated;
grant select (workspace_id, key, value, updated_at)
  on workspace_settings to authenticated;
