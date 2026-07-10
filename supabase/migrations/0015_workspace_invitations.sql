-- 0015 — Workspace invitations (Track F: team management)
-- The Team page issues invites; the accept flow at /invite/[token] consumes
-- the row and promotes the caller to workspace_members. Tokens are opaque
-- and pinned to a single email so a forwarded link cannot be redeemed by
-- someone else.

create table workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  role member_role not null default 'editor',
  token text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index on workspace_invitations (workspace_id);
create index on workspace_invitations (email);

alter table workspace_invitations enable row level security;

-- Members can see invites for their workspace (Team page). Non-members see
-- nothing — the accept flow uses the service-role client to look up by token
-- so unauthenticated / cross-workspace lookups still work by exact token.
create policy "member read" on workspace_invitations
  for select using (is_workspace_member(workspace_id));

-- Only owners create / revoke invites. Role changes and deletions all funnel
-- through owner-authored server actions.
create policy "owner insert" on workspace_invitations
  for insert with check (workspace_role(workspace_id) = 'owner');
create policy "owner update" on workspace_invitations
  for update using (workspace_role(workspace_id) = 'owner');
create policy "owner delete" on workspace_invitations
  for delete using (workspace_role(workspace_id) = 'owner');
