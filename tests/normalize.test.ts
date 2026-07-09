import { describe, it, expect } from "vitest";
import { normalize, aggregate, type MetricRow } from "@/lib/analytics/normalize";

describe("analytics normalize", () => {
  it("computes ROI from cost", () => {
    const m = normalize("facebook", { revenue: 300, commission: 45 }, 100);
    expect(m.revenue).toBe(300);
    expect(m.roi).toBe(200); // (300-100)/100 * 100
  });

  it("roi is 0 when no cost provided", () => {
    const m = normalize("tiktok", { revenue: 300 });
    expect(m.roi).toBe(0);
  });

  it("aggregate sums totals and groups by platform", () => {
    const rows: MetricRow[] = [
      { platform: "facebook", views: 100, reach: 80, engagement: 10, clicks: 5, orders: 1, revenue: 200, commission: 20 },
      { platform: "facebook", views: 50, reach: 40, engagement: 5, clicks: 3, orders: 0, revenue: 100, commission: 10 },
      { platform: "tiktok", views: 500, reach: 400, engagement: 60, clicks: 30, orders: 4, revenue: 800, commission: 64 },
    ];
    const { totals, byPlatform } = aggregate(rows);
    expect(totals.views).toBe(650);
    expect(totals.revenue).toBe(1100);
    expect(byPlatform).toHaveLength(2);
    const fb = byPlatform.find((p) => p.platform === "facebook")!;
    expect(fb.views).toBe(150);
    expect(fb.revenue).toBe(300);
  });
});
