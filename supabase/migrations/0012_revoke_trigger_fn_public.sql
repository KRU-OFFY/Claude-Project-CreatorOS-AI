-- Functions grant EXECUTE to PUBLIC by default. Trigger functions are invoked by
-- the trigger mechanism (as table owner) and need no caller grant, so revoke
-- PUBLIC execute to remove them from the exposed RPC surface entirely.
-- (is_workspace_member / workspace_role / can_write_workspace intentionally stay
-- callable by `authenticated` — RLS policies invoke them and they only reveal
-- the calling user's own membership.)
revoke all on function set_updated_at() from public;
revoke all on function handle_new_user() from public;
revoke all on function guard_publish_variant_not_failed() from public;
