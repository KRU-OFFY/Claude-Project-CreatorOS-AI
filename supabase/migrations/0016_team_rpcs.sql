-- 0016 — Atomic RPCs for team operations
-- Sequential writes over HTTP can leave the database mid-flight if a request
-- fails between them. Both flows below must land completely or not at all:
--
-- * transfer_workspace_ownership — demote current owner, promote new owner,
--   flip workspaces.owner_id. A half-applied transfer would leave the
--   workspace ownerless (no one can manage members or billing).
--
-- * accept_workspace_invite — mark the invite consumed AND upsert the
--   membership. A half-applied accept marks the invite `accepted_at` without
--   granting membership — the invitee is locked out because the invite is
--   already consumed and can't be redeemed again.
--
-- Both functions are SECURITY DEFINER so they can bypass RLS for the multi-
-- row writes. Callers use the service-role admin client and enforce the
-- ownership/eligibility checks in application code before calling.

create or replace function transfer_workspace_ownership(
  p_workspace_id uuid,
  p_current_owner_id uuid,
  p_new_owner_id uuid
) returns void
language plpgsql
security definer set search_path = public
as $$
begin
  -- Guard: both users must be current members. Prevents accidentally
  -- promoting a non-member if the caller passed a stale user id.
  if not exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id and user_id = p_current_owner_id and role = 'owner'
  ) then
    raise exception 'current user is not the workspace owner';
  end if;
  if not exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id and user_id = p_new_owner_id
  ) then
    raise exception 'new owner is not a member of this workspace';
  end if;

  update workspace_members
    set role = 'editor'
    where workspace_id = p_workspace_id and user_id = p_current_owner_id;

  update workspace_members
    set role = 'owner'
    where workspace_id = p_workspace_id and user_id = p_new_owner_id;

  update workspaces
    set owner_id = p_new_owner_id
    where id = p_workspace_id;
end;
$$;

revoke all on function transfer_workspace_ownership(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function accept_workspace_invite(
  p_invite_id uuid,
  p_user_id uuid
) returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_workspace uuid;
  v_role member_role;
  v_email text;
begin
  -- Claim the invite row. Only the first caller flips accepted_at from null,
  -- so a concurrent second click sees FOUND=false and short-circuits.
  update workspace_invitations
    set accepted_at = now(), accepted_by = p_user_id
    where id = p_invite_id
      and accepted_at is null
      and revoked_at is null
      and expires_at > now()
    returning workspace_id, role, email
    into v_workspace, v_role, v_email;

  if not found then
    raise exception 'invitation is not accepting new members';
  end if;

  -- Upsert the membership. Already-a-member is harmless — the role bumps to
  -- the invite's role (useful when re-inviting to change role).
  insert into workspace_members (workspace_id, user_id, role)
    values (v_workspace, p_user_id, v_role)
    on conflict (workspace_id, user_id) do update
    set role = excluded.role;
end;
$$;

revoke all on function accept_workspace_invite(uuid, uuid) from public, anon, authenticated;
