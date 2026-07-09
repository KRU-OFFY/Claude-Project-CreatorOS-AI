import type { PlatformKey } from "@/lib/platforms";

export interface RuleResult {
  rule: string;
  label: string;
  passed: boolean;
  severity: "low" | "medium" | "high";
  message: string;
}

export interface ComplianceInput {
  platform: PlatformKey;
  caption: string;
  hashtags: string[];
  aiGenerated: boolean;
}

// Per-platform config consumed by the shared engine.
export interface PlatformComplianceConfig {
  requireAiLabel: boolean; // platform mandates an explicit AI-generated label
  captionMaxLength: number | null;
  policyNote: string; // informational note shown to the user
  // extra platform-specific prohibited patterns (on top of the shared set)
  extraProhibited?: { pattern: RegExp; label: string }[];
}

export interface ComplianceResult {
  results: RuleResult[];
  riskLevel: "low" | "medium" | "high";
  claimRiskScore: number; // 0-100
  disclosureOk: boolean;
  aiLabelOk: boolean;
  status: "pass" | "fail" | "needs_review";
}
