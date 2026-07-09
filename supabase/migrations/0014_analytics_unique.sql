-- 0014 — unique key for API analytics snapshots (one per job per day per source)
-- Enables an atomic upsert in the ingest cron so overlapping runs cannot create
-- duplicate rows that would double-count in the analytics aggregation.
-- Manual rows have publish_queue_id = NULL; NULLs are distinct, so multiple
-- manual entries per day are still allowed.
create unique index if not exists analytics_metrics_api_snapshot
  on analytics_metrics (workspace_id, publish_queue_id, metric_date, source);
