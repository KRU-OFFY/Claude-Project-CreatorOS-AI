-- 0006 — Omnichannel Publishing Hub queue
-- Acceptance 3.3: a content_variant with status 'fail' can NEVER enter the queue.
-- Enforced at the database via a trigger (not just the UI).

create type publish_status as enum
  ('draft', 'queued', 'publishing', 'published', 'failed', 'retry');

create table publish_queue (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  content_variant_id uuid not null references content_variants(id) on delete cascade,
  platform text not null,
  scheduled_at timestamptz,
  status publish_status not null default 'draft',
  retry_count int not null default 0,
  error_message text,
  published_url text,
  published_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on publish_queue (workspace_id, status);
create index on publish_queue (workspace_id, scheduled_at);

create trigger publish_queue_updated_at before update on publish_queue
  for each row execute function set_updated_at();

-- DB-level guard: block insert/update if the linked variant is compliance-failed.
create or replace function guard_publish_variant_not_failed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare v_status variant_status;
begin
  select status into v_status
  from content_variants
  where id = new.content_variant_id;

  if v_status = 'fail' then
    raise exception
      'content variant % is compliance-failed and cannot be queued for publishing',
      new.content_variant_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger publish_queue_guard_failed
  before insert or update on publish_queue
  for each row execute function guard_publish_variant_not_failed();
