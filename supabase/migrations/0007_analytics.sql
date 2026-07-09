-- 0007 — Analytics Center (unified cross-platform metric model) + commissions

create table analytics_metrics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  platform text not null,
  publish_queue_id uuid references publish_queue(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  metric_date date not null default current_date,
  views bigint not null default 0,
  reach bigint not null default 0,
  engagement bigint not null default 0,
  clicks bigint not null default 0,
  orders bigint not null default 0,
  revenue numeric(14,2) not null default 0,
  commission numeric(14,2) not null default 0,
  roi numeric(10,2) not null default 0,
  source text not null default 'manual',
  collected_at timestamptz not null default now()
);
create index on analytics_metrics (workspace_id, metric_date);
create index on analytics_metrics (workspace_id, platform);

create table commissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  platform text,
  order_ref text,
  order_date date not null default current_date,
  order_amount numeric(14,2) not null default 0,
  commission_amount numeric(14,2) not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index on commissions (workspace_id, order_date);
