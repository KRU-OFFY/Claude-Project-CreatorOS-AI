import type { PlatformKey } from "@/lib/platforms";

export interface RuleResult {
  rule: string;
  label: string;
  passed: boolean;
  severity: "low" | "medium" | "high";
  message: string;
}

// Product categories that trigger extra regulatory rules. `general` (or omitted)
// runs no category-specific pack. Thai-market regulators enforce these:
// - health   → อย. (Food/Drug), แพทยสภา (medical claims)
// - cosmetics → อย. cosmetics
// - financial → ก.ล.ต. / ธปท. (investment / financial products)
export type ProductCategory = "general" | "health" | "cosmetics" | "financial";

export interface ComplianceInput {
  platform: PlatformKey;
  caption: string;
  hashtags: string[];
  aiGenerated: boolean;
  productCategory?: ProductCategory;
}

// Per-platform config consumed by the shared engine.
export interface PlatformComplianceConfig {
  requireAiLabel: boolean; // platform mandates an explicit AI-generated label
  captionMaxLength: number | null;
  policyNote: string; // informational note shown to the user
  // extra platform-specific prohibited patterns (on top of the shared set)
  extraProhibited?: { pattern: RegExp; label: string }[];
}

// A category-specific regulatory rule pack. Applied when the input carries
// a matching `productCategory`. Both dimensions are additive:
// - `prohibited` — patterns that MUST NOT appear (fail = high severity)
// - `required`  — at least one pattern must appear (missing = medium severity)
export interface CategoryComplianceConfig {
  regulator: string; // human label for the rule pack (e.g. "อย.")
  prohibited: { pattern: RegExp; label: string }[];
  required?: {
    label: string;
    patterns: RegExp[];
    message: string;
  };
}

export interface ComplianceResult {
  results: RuleResult[];
  riskLevel: "low" | "medium" | "high";
  claimRiskScore: number; // 0-100
  disclosureOk: boolean;
  aiLabelOk: boolean;
  status: "pass" | "fail" | "needs_review";
}
