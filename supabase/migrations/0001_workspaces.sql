-- 0001 — Identity, workspaces, membership & roles
-- Every business table references workspace_id (added in later migrations).

create extension if not exists "pgcrypto";

create type member_role as enum ('owner', 'editor', 'approver', 'viewer');

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null default 'editor',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index on workspace_members (user_id);

create table settings (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger workspaces_updated_at before update on workspaces
  for each row execute function set_updated_at();

-- Bootstrap: on signup create profile + first workspace + owner membership.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare ws_id uuid;
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));

  insert into workspaces (name, owner_id)
  values (coalesce(new.raw_user_meta_data->>'workspace_name', 'เวิร์กสเปซของฉัน'), new.id)
  returning id into ws_id;

  insert into workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  insert into settings (workspace_id, data)
  values (ws_id, '{"monthly_revenue_target": 30000}'::jsonb);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
