-- 0009 — Row Level Security for every business table
-- Membership is checked via a security-definer helper to avoid recursive
-- policy lookups on workspace_members.

create or replace function is_workspace_member(ws uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function workspace_role(ws uuid)
returns member_role
language sql
security definer set search_path = public
stable
as $$
  select role from workspace_members
  where workspace_id = ws and user_id = auth.uid()
  limit 1;
$$;

-- Writers = owner / editor / approver (viewer is read-only).
create or replace function can_write_workspace(ws uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select workspace_role(ws) in ('owner', 'editor', 'approver');
$$;

-- ===== profiles =====
alter table profiles enable row level security;
create policy "own profile read" on profiles for select using (id = auth.uid());
create policy "own profile update" on profiles for update using (id = auth.uid());

-- ===== workspaces =====
alter table workspaces enable row level security;
create policy "member read" on workspaces for select using (is_workspace_member(id));
create policy "owner update" on workspaces for update using (workspace_role(id) = 'owner');

-- ===== workspace_members =====
alter table workspace_members enable row level security;
create policy "member read" on workspace_members for select using (is_workspace_member(workspace_id));
create policy "owner manage" on workspace_members for all using (workspace_role(workspace_id) = 'owner');

-- ===== standard business tables (member read / writer write) =====
do $$
declare t text;
begin
  foreach t in array array[
    'products','campaigns','content_items','content_variants','compliance_checks',
    'publish_queue','analytics_metrics','commissions','settings','channel_connections'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "member read" on %I for select using (is_workspace_member(workspace_id))', t);
    execute format('create policy "writer insert" on %I for insert with check (can_write_workspace(workspace_id))', t);
    execute format('create policy "writer update" on %I for update using (can_write_workspace(workspace_id))', t);
    execute format('create policy "writer delete" on %I for delete using (can_write_workspace(workspace_id))', t);
  end loop;
end;
$$;

-- ===== audit_logs: insert-only for members, readable, never updatable/deletable =====
alter table audit_logs enable row level security;
create policy "member read" on audit_logs for select using (is_workspace_member(workspace_id));
create policy "member insert" on audit_logs for insert with check (is_workspace_member(workspace_id));

-- ===== token protection: clients can never read/write encrypted token columns =====
-- Server code uses the service-role key (bypasses RLS) for token operations.
revoke select on channel_connections from anon, authenticated;
grant select (id, workspace_id, platform, account_name, status, expires_at, metadata, connected_by, created_at, updated_at)
  on channel_connections to authenticated;
revoke insert, update on channel_connections from anon, authenticated;
grant insert (workspace_id, platform, account_name, status, metadata, connected_by),
      update (account_name, status, metadata)
  on channel_connections to authenticated;
