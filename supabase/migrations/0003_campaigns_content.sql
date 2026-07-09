-- 0003 — Campaign Manager + AI Content Studio

create type campaign_goal as enum ('conversion', 'awareness', 'live_commerce', 'retargeting');
create type campaign_status as enum ('draft', 'active', 'paused', 'completed');
create type content_type as enum ('brief', 'script', 'caption', 'image', 'video');
create type variant_status as enum ('draft', 'pending_compliance', 'pass', 'fail', 'needs_review', 'approved');

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name text not null,
  goal campaign_goal not null default 'conversion',
  target_platforms text[] not null default '{}',
  status campaign_status not null default 'draft',
  start_date date,
  end_date date,
  target_revenue numeric(14,2),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on campaigns (workspace_id, status);

create table content_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  type content_type not null default 'brief',
  title text not null,
  body text not null default '',
  ai_generated boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on content_items (workspace_id, campaign_id);

create table content_variants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  content_item_id uuid not null references content_items(id) on delete cascade,
  platform text not null,
  variant_body text not null default '',
  hashtags text[] not null default '{}',
  cta text,
  media_url text,
  status variant_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on content_variants (workspace_id, platform);
create index on content_variants (content_item_id);

create trigger campaigns_updated_at before update on campaigns
  for each row execute function set_updated_at();
create trigger content_items_updated_at before update on content_items
  for each row execute function set_updated_at();
create trigger content_variants_updated_at before update on content_variants
  for each row execute function set_updated_at();
