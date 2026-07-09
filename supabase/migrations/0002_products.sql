-- 0002 — Product Intelligence

create type product_tier as enum ('hero', 'growth', 'test', 'watchlist');

create table products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  source_platform text,
  external_id text,
  name text not null,
  url text,
  image_url text,
  price numeric(12,2),
  commission_rate numeric(5,2),
  score numeric(5,2),
  tier product_tier not null default 'watchlist',
  raw_data jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on products (workspace_id, tier);
create index on products (workspace_id, score);

create trigger products_updated_at before update on products
  for each row execute function set_updated_at();
