// Product scoring formula + tier thresholds (Brief 2.1 / Acceptance 3.3).
// Deterministic scoring that the AI layer can override with a richer analysis.

import type { PlatformKey } from "@/lib/platforms";

export type ProductTier = "hero" | "growth" | "test" | "watchlist";

export interface ScoreInput {
  price?: number | null;
  commission_rate?: number | null;
  trendVelocity?: number | null; // 0-100, optional external signal
}

// Thresholds — single source of truth used by UI badges and gating.
export const TIER_THRESHOLDS: { tier: ProductTier; min: number }[] = [
  { tier: "hero", min: 80 },
  { tier: "growth", min: 60 },
  { tier: "test", min: 40 },
  { tier: "watchlist", min: 0 },
];

export function tierForScore(score: number): ProductTier {
  return TIER_THRESHOLDS.find((t) => score >= t.min)!.tier;
}

// A product passes into a Campaign when it reaches at least the "test" tier.
export const CAMPAIGN_MIN_SCORE = 40;

export function passesToCampaign(score: number): boolean {
  return score >= CAMPAIGN_MIN_SCORE;
}

export function computeScore(input: ScoreInput): { score: number; tier: ProductTier } {
  const commission = input.commission_rate ?? 0;
  const price = input.price ?? 0;
  const trend = input.trendVelocity ?? 50;

  // Weighted: commission 45%, price sweet-spot 25%, trend 30%.
  const commissionScore = Math.min(commission / 20, 1) * 45; // 20%+ commission maxes out
  const priceScore = (price > 0 && price <= 800 ? 1 : price <= 1500 ? 0.7 : 0.4) * 25;
  const trendScore = (Math.max(0, Math.min(100, trend)) / 100) * 30;

  const score = Math.round(commissionScore + priceScore + trendScore);
  return { score, tier: tierForScore(score) };
}

export const TIER_LABELS: Record<ProductTier, string> = {
  hero: "Hero",
  growth: "Growth",
  test: "Test",
  watchlist: "Watchlist",
};

// Suggest promotion platforms for a tier (used by Campaign setup hints).
export function suggestedPlatforms(tier: ProductTier): PlatformKey[] {
  if (tier === "hero") return ["tiktok", "facebook", "instagram", "shopee_live", "shopee_video"];
  if (tier === "growth") return ["tiktok", "facebook", "shopee_video"];
  if (tier === "test") return ["tiktok", "lemon8"];
  return ["lemon8"];
}
