-- 0017 — Render jobs (Track C: external render worker)
-- The app enqueues a render for a content_variant → external worker produces
-- an MP4 / thumbnail → callback updates the row + writes media_url on the
-- source variant. Persisted so the UI can show progress, so retries are
-- observable, and so we don't rely on the worker holding state.

create type render_status as enum ('queued', 'rendering', 'succeeded', 'failed');

create table render_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  content_variant_id uuid not null references content_variants(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  status render_status not null default 'queued',
  media_url text,
  thumbnail_url text,
  duration_ms integer,
  error_message text,
  -- The worker signs its callbacks with an HMAC of (job_id + timestamp).
  -- We stash the sent timestamp so replays outside a short window get
  -- rejected — see /api/render/callback.
  callback_nonce text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index on render_jobs (workspace_id, created_at desc);
create index on render_jobs (content_variant_id);

create trigger render_jobs_updated_at before update on render_jobs
  for each row execute function set_updated_at();

alter table render_jobs enable row level security;
create policy "member read" on render_jobs
  for select using (is_workspace_member(workspace_id));
create policy "writer insert" on render_jobs
  for insert with check (can_write_workspace(workspace_id));
create policy "writer update" on render_jobs
  for update using (can_write_workspace(workspace_id));
