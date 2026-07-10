import { describe, it, expect } from "vitest";
import {
  dailyTotals,
  linearForecast,
  trendPct,
  trendDirection,
  platformShares,
  summarize,
  type AnalyticsRow,
} from "@/lib/analytics/trends";

const today = "2026-07-10";

function row(date: string, platform: string, revenue: number, clicks = 0): AnalyticsRow {
  return {
    platform,
    metric_date: date,
    views: 0,
    reach: 0,
    engagement: 0,
    clicks,
    orders: 0,
    revenue,
    commission: 0,
  };
}

describe("dailyTotals", () => {
  it("returns one point per day in the window, zero-filled", () => {
    const rows = [row("2026-07-09", "facebook", 100), row("2026-07-08", "instagram", 50)];
    const daily = dailyTotals(rows, 7, today);
    expect(daily).toHaveLength(7);
    expect(daily.at(-1)!.date).toBe(today);
    const sum = daily.reduce((a, d) => a + d.revenue, 0);
    expect(sum).toBe(150);
  });

  it("aggregates multiple platforms on the same day", () => {
    const rows = [row("2026-07-09", "facebook", 100), row("2026-07-09", "instagram", 30)];
    const daily = dailyTotals(rows, 3, today);
    expect(daily.find((d) => d.date === "2026-07-09")!.revenue).toBe(130);
  });

  it("ignores rows outside the window", () => {
    const rows = [row("2026-06-01", "facebook", 999), row("2026-07-09", "facebook", 10)];
    const daily = dailyTotals(rows, 7, today);
    expect(daily.reduce((a, d) => a + d.revenue, 0)).toBe(10);
  });
});

describe("linearForecast", () => {
  it("projects upward for an ascending series", () => {
    const daily = dailyTotals(
      [
        row("2026-07-04", "facebook", 10),
        row("2026-07-05", "facebook", 20),
        row("2026-07-06", "facebook", 30),
        row("2026-07-07", "facebook", 40),
        row("2026-07-08", "facebook", 50),
        row("2026-07-09", "facebook", 60),
        row("2026-07-10", "facebook", 70),
      ],
      7,
      today
    );
    const f = linearForecast(daily, 3);
    expect(f).toHaveLength(3);
    expect(f[0].revenue).toBeGreaterThan(70);
    expect(f[2].revenue).toBeGreaterThan(f[0].revenue);
  });

  it("clamps negative projections to zero", () => {
    const daily = dailyTotals(
      [
        row("2026-07-04", "facebook", 100),
        row("2026-07-05", "facebook", 80),
        row("2026-07-06", "facebook", 60),
        row("2026-07-07", "facebook", 40),
        row("2026-07-08", "facebook", 20),
        row("2026-07-09", "facebook", 10),
        row("2026-07-10", "facebook", 5),
      ],
      7,
      today
    );
    const f = linearForecast(daily, 7);
    // Even a hard downward trend clamps at zero, never negative.
    for (const p of f) expect(p.revenue).toBeGreaterThanOrEqual(0);
  });

  it("returns empty when the horizon is zero or the series is too short", () => {
    expect(linearForecast([], 5)).toEqual([]);
    expect(linearForecast([{ date: "d", revenue: 1, clicks: 0, orders: 0, commission: 0 }], 5)).toEqual([]);
    expect(
      linearForecast(dailyTotals([row("2026-07-10", "facebook", 1)], 7, today), 0)
    ).toEqual([]);
  });
});

describe("trendPct + trendDirection", () => {
  it("reports up for a rising series", () => {
    const daily = dailyTotals(
      [
        row("2026-07-04", "facebook", 10),
        row("2026-07-05", "facebook", 10),
        row("2026-07-06", "facebook", 10),
        row("2026-07-07", "facebook", 30),
        row("2026-07-08", "facebook", 30),
        row("2026-07-09", "facebook", 30),
        row("2026-07-10", "facebook", 30),
      ],
      7,
      today
    );
    expect(trendPct(daily)).toBeGreaterThan(0);
    expect(trendDirection(daily)).toBe("up");
  });

  it("reports down for a falling series", () => {
    const daily = dailyTotals(
      [
        row("2026-07-04", "facebook", 100),
        row("2026-07-05", "facebook", 100),
        row("2026-07-06", "facebook", 100),
        row("2026-07-07", "facebook", 20),
        row("2026-07-08", "facebook", 20),
        row("2026-07-09", "facebook", 20),
        row("2026-07-10", "facebook", 20),
      ],
      7,
      today
    );
    expect(trendDirection(daily)).toBe("down");
  });

  it("reports flat for a steady series", () => {
    const daily = dailyTotals(
      Array.from({ length: 7 }, (_, i) => row(`2026-07-${(4 + i).toString().padStart(2, "0")}`, "facebook", 50)),
      7,
      today
    );
    expect(trendDirection(daily)).toBe("flat");
  });
});

describe("platformShares", () => {
  it("computes share correctly", () => {
    const rows = [row("2026-07-09", "facebook", 300), row("2026-07-09", "instagram", 100)];
    const shares = platformShares(rows);
    expect(shares[0].platform).toBe("facebook");
    expect(shares[0].share).toBeCloseTo(0.75, 2);
    expect(shares[1].share).toBeCloseTo(0.25, 2);
  });
});

describe("summarize", () => {
  it("flags hasSignal false when < 3 non-zero days", () => {
    const rows = [row("2026-07-10", "facebook", 100)];
    expect(summarize(rows, 7).hasSignal).toBe(false);
  });

  it("flags hasSignal true when >= 3 non-zero days", () => {
    const rows = [
      row("2026-07-08", "facebook", 50),
      row("2026-07-09", "facebook", 50),
      row("2026-07-10", "facebook", 50),
    ];
    expect(summarize(rows, 7).hasSignal).toBe(true);
  });
});
