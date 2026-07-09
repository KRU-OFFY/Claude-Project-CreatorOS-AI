// Map platform-specific raw metrics into the unified analytics model
// (views/reach/engagement/clicks/orders/revenue/commission/roi).

import type { PlatformKey } from "@/lib/platforms";
import type { RawMetrics } from "@/lib/adapters/types";

export interface UnifiedMetric {
  platform: PlatformKey;
  views: number;
  reach: number;
  engagement: number;
  clicks: number;
  orders: number;
  revenue: number;
  commission: number;
  roi: number;
}

// cost is optional (e.g. ad spend); roi = (revenue - cost) / cost, or revenue-based when no cost.
export function normalize(
  platform: PlatformKey,
  raw: RawMetrics,
  cost = 0
): UnifiedMetric {
  const revenue = raw.revenue ?? 0;
  const commission = raw.commission ?? 0;
  const roi = cost > 0 ? Number((((revenue - cost) / cost) * 100).toFixed(2)) : 0;
  return {
    platform,
    views: raw.views ?? 0,
    reach: raw.reach ?? 0,
    engagement: raw.engagement ?? 0,
    clicks: raw.clicks ?? 0,
    orders: raw.orders ?? 0,
    revenue,
    commission,
    roi,
  };
}

export interface MetricRow {
  platform: string;
  views: number;
  reach: number;
  engagement: number;
  clicks: number;
  orders: number;
  revenue: number;
  commission: number;
}

export function aggregate(rows: MetricRow[]) {
  const totals = rows.reduce(
    (acc, r) => {
      acc.views += r.views;
      acc.reach += r.reach;
      acc.engagement += r.engagement;
      acc.clicks += r.clicks;
      acc.orders += r.orders;
      acc.revenue += Number(r.revenue);
      acc.commission += Number(r.commission);
      return acc;
    },
    { views: 0, reach: 0, engagement: 0, clicks: 0, orders: 0, revenue: 0, commission: 0 }
  );

  const byPlatform = new Map<string, MetricRow>();
  for (const r of rows) {
    const cur =
      byPlatform.get(r.platform) ??
      { platform: r.platform, views: 0, reach: 0, engagement: 0, clicks: 0, orders: 0, revenue: 0, commission: 0 };
    cur.views += r.views;
    cur.reach += r.reach;
    cur.engagement += r.engagement;
    cur.clicks += r.clicks;
    cur.orders += r.orders;
    cur.revenue += Number(r.revenue);
    cur.commission += Number(r.commission);
    byPlatform.set(r.platform, cur);
  }

  return { totals, byPlatform: Array.from(byPlatform.values()) };
}
