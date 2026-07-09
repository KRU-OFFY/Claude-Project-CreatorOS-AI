import { describe, it, expect } from "vitest";
import {
  computeScore,
  tierForScore,
  passesToCampaign,
  CAMPAIGN_MIN_SCORE,
  suggestedPlatforms,
} from "@/lib/scoring/product-score";

describe("product scoring", () => {
  it("maps scores to tiers at the documented thresholds", () => {
    expect(tierForScore(80)).toBe("hero");
    expect(tierForScore(79)).toBe("growth");
    expect(tierForScore(60)).toBe("growth");
    expect(tierForScore(59)).toBe("test");
    expect(tierForScore(40)).toBe("test");
    expect(tierForScore(39)).toBe("watchlist");
    expect(tierForScore(0)).toBe("watchlist");
  });

  it("high commission + sweet-spot price scores into a strong tier", () => {
    const { score, tier } = computeScore({ price: 500, commission_rate: 20, trendVelocity: 90 });
    expect(score).toBeGreaterThanOrEqual(80);
    expect(tier).toBe("hero");
  });

  it("weak product lands in watchlist", () => {
    const { score, tier } = computeScore({ price: 3000, commission_rate: 1, trendVelocity: 10 });
    expect(score).toBeLessThan(40);
    expect(tier).toBe("watchlist");
  });

  it("campaign gate uses the min score", () => {
    expect(passesToCampaign(CAMPAIGN_MIN_SCORE)).toBe(true);
    expect(passesToCampaign(CAMPAIGN_MIN_SCORE - 1)).toBe(false);
  });

  it("suggests platforms per tier", () => {
    expect(suggestedPlatforms("hero")).toContain("shopee_live");
    expect(suggestedPlatforms("watchlist")).toEqual(["lemon8"]);
  });
});
