// Trend + forecast helpers on top of analytics_metrics rows.
// Pure functions — no I/O. The AI Advisor and Revenue Forecast pages call
// these to turn a bag of rows into a story ("revenue trending up 15% over
// the last 7 days, forecast +THB 12k next week").

import type { PlatformKey } from "@/lib/platforms";

export interface AnalyticsRow {
  platform: string;
  metric_date: string; // ISO date (YYYY-MM-DD)
  views: number;
  reach: number;
  engagement: number;
  clicks: number;
  orders: number;
  revenue: number;
  commission: number;
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  revenue: number;
  clicks: number;
  orders: number;
  commission: number;
}

export interface ForecastPoint {
  date: string;
  revenue: number;
  lower: number; // simple ± band based on residual stddev
  upper: number;
}

// Bucket a row set by day, summing across platforms and jobs so each day
// gets exactly one point. Missing days are filled with zeros so the
// regression sees a continuous series.
export function dailyTotals(
  rows: AnalyticsRow[],
  days: number,
  todayIso?: string
): DailyPoint[] {
  const today = todayIso ? new Date(todayIso) : new Date();
  const startMs = today.getTime() - (days - 1) * 864e5;

  const byDate = new Map<string, DailyPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(startMs + i * 864e5).toISOString().slice(0, 10);
    byDate.set(d, { date: d, revenue: 0, clicks: 0, orders: 0, commission: 0 });
  }
  for (const r of rows) {
    const bucket = byDate.get(r.metric_date);
    if (!bucket) continue;
    bucket.revenue += Number(r.revenue);
    bucket.clicks += Number(r.clicks);
    bucket.orders += Number(r.orders);
    bucket.commission += Number(r.commission);
  }
  return Array.from(byDate.values());
}

// Ordinary-least-squares fit y = a + b*x over the daily series, then project
// `horizon` days forward. Confidence band is ±1σ of the training residuals —
// coarse but honest given we're fitting on <=14 points.
export function linearForecast(
  daily: DailyPoint[],
  horizon: number,
  metric: keyof Omit<DailyPoint, "date"> = "revenue"
): ForecastPoint[] {
  const n = daily.length;
  if (n < 2 || horizon <= 0) return [];

  const xs = daily.map((_, i) => i);
  const ys = daily.map((d) => d[metric]);
  const mx = mean(xs);
  const my = mean(ys);
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;

  const residuals = xs.map((x, i) => ys[i] - (intercept + slope * x));
  const sd = Math.sqrt(mean(residuals.map((r) => r * r)));

  const lastDate = new Date(daily[n - 1].date + "T00:00:00Z").getTime();
  const points: ForecastPoint[] = [];
  for (let h = 1; h <= horizon; h++) {
    const yHat = intercept + slope * (n - 1 + h);
    const clamped = Math.max(0, yHat);
    const date = new Date(lastDate + h * 864e5).toISOString().slice(0, 10);
    points.push({
      date,
      revenue: Math.round(clamped),
      lower: Math.max(0, Math.round(clamped - sd)),
      upper: Math.round(clamped + sd),
    });
  }
  return points;
}

// Percentage change between the average of the first and second halves of
// the window. Robust to a single spiky day and gives the Advisor a natural
// signal ("trending up 22%" instead of raw slope).
export function trendPct(daily: DailyPoint[], metric: keyof Omit<DailyPoint, "date"> = "revenue"): number {
  if (daily.length < 2) return 0;
  const half = Math.floor(daily.length / 2);
  const first = mean(daily.slice(0, half).map((d) => d[metric]));
  const second = mean(daily.slice(half).map((d) => d[metric]));
  if (first === 0) return second > 0 ? 100 : 0;
  return Math.round(((second - first) / first) * 100);
}

export type TrendDirection = "up" | "down" | "flat";

export function trendDirection(daily: DailyPoint[], metric?: keyof Omit<DailyPoint, "date">): TrendDirection {
  const pct = trendPct(daily, metric);
  if (pct >= 5) return "up";
  if (pct <= -5) return "down";
  return "flat";
}

export interface PlatformShare {
  platform: string;
  revenue: number;
  clicks: number;
  share: number; // 0..1 of total revenue
}

// Group by platform, sum revenue + clicks, sort desc. Useful for "best
// channel" recommendations in the Advisor.
export function platformShares(rows: AnalyticsRow[]): PlatformShare[] {
  const byPlatform = new Map<string, PlatformShare>();
  let total = 0;
  for (const r of rows) {
    const rev = Number(r.revenue);
    total += rev;
    const cur = byPlatform.get(r.platform) ?? {
      platform: r.platform,
      revenue: 0,
      clicks: 0,
      share: 0,
    };
    cur.revenue += rev;
    cur.clicks += Number(r.clicks);
    byPlatform.set(r.platform, cur);
  }
  const list = Array.from(byPlatform.values());
  for (const p of list) p.share = total > 0 ? p.revenue / total : 0;
  return list.sort((a, b) => b.revenue - a.revenue);
}

// Compact JSON blob handed to the AI Advisor prompt so it can ground
// recommendations in actual numbers. Kept small on purpose — the prompt
// pays per token.
export interface TrendSummary {
  days: number;
  revenue14d: number;
  revenueTrendPct: number;
  clicks14d: number;
  clicksTrendPct: number;
  orders14d: number;
  topPlatform: string | null;
  topPlatformShare: number;
  forecast7dRevenue: number;
  hasSignal: boolean;
}

export function summarize(rows: AnalyticsRow[], days = 14): TrendSummary {
  const daily = dailyTotals(rows, days);
  const revenue14d = sum(daily.map((d) => d.revenue));
  const clicks14d = sum(daily.map((d) => d.clicks));
  const orders14d = sum(daily.map((d) => d.orders));
  const forecast = linearForecast(daily, 7, "revenue");
  const shares = platformShares(rows);
  const top = shares[0];

  return {
    days,
    revenue14d: Math.round(revenue14d),
    revenueTrendPct: trendPct(daily, "revenue"),
    clicks14d,
    clicksTrendPct: trendPct(daily, "clicks"),
    orders14d,
    topPlatform: top?.platform ?? null,
    topPlatformShare: top ? Math.round(top.share * 100) : 0,
    forecast7dRevenue: sum(forecast.map((f) => f.revenue)),
    // "hasSignal" tells the advisor whether the caller has enough data
    // to trust the numbers (< 3 non-zero days ⇒ demo/empty workspace,
    // fallback advice is more appropriate than trend-grounded copy).
    hasSignal: daily.filter((d) => d.revenue > 0 || d.clicks > 0).length >= 3,
  };
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

// Re-export a `PlatformKey`-friendly type alias for callers that already
// have narrowed platform names — the trend helpers accept any string so
// they don't force the alias upstream.
export type { PlatformKey };
