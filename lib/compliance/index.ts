// Compliance Gate — data-driven rule engine.
// Per-platform configs live in ./rules/{platform}.ts; the engine below applies
// the shared rules (affiliate disclosure, AI label, prohibited claims, caption
// length) plus any platform-specific prohibited patterns.

import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import type {
  ComplianceInput,
  ComplianceResult,
  PlatformComplianceConfig,
  RuleResult,
} from "@/lib/compliance/types";

import { facebook } from "@/lib/compliance/rules/facebook";
import { instagram } from "@/lib/compliance/rules/instagram";
import { tiktok } from "@/lib/compliance/rules/tiktok";
import { x } from "@/lib/compliance/rules/x";
import { youtube } from "@/lib/compliance/rules/youtube";
import { lemon8 } from "@/lib/compliance/rules/lemon8";
import { shopee } from "@/lib/compliance/rules/shopee";

const CONFIGS: Record<PlatformKey, PlatformComplianceConfig> = {
  facebook,
  instagram,
  tiktok,
  x,
  youtube,
  lemon8,
  shopee_video: shopee,
  shopee_live: shopee,
};

const DISCLOSURE_PATTERNS = [
  /#ad\b/i,
  /#โฆษณา/,
  /#สปอนเซอร์/,
  /ได้รับค่าคอมมิชชั่น/,
  /affiliate/i,
  /ลิงก์พันธมิตร/,
  /paid partnership/i,
];

const AI_LABEL_PATTERNS = [/#ai/i, /สร้างด้วย\s*ai/i, /ai[- ]generated/i, /คอนเทนต์\s*ai/i];

const SHARED_PROHIBITED: { pattern: RegExp; label: string }[] = [
  { pattern: /รักษา(โรค|หาย|ขาด)/, label: "อ้างสรรพคุณรักษาโรค" },
  { pattern: /หายขาด/, label: "อ้างว่าหายขาด" },
  { pattern: /100\s*%|ร้อยเปอร์เซ็นต์/, label: "การันตีผลลัพธ์ 100%" },
  { pattern: /การันตี(ผล|รวย|กำไร)/, label: "การันตีผลลัพธ์/รายได้" },
  { pattern: /ลดน้ำหนัก.{0,10}(เร็ว|ทันที|ใน\s*\d+\s*วัน)/, label: "อ้างลดน้ำหนักเร็วผิดปกติ" },
  { pattern: /ขาว(ใส)?ใน\s*\d+\s*(วัน|ชั่วโมง)/, label: "อ้างผลลัพธ์ผิวขาวเร็วผิดปกติ" },
  { pattern: /รวย(เร็ว|ทางลัด)/, label: "ชวนเชื่อรวยเร็ว" },
];

export function checkCompliance(input: ComplianceInput): ComplianceResult {
  const { platform, caption, hashtags, aiGenerated } = input;
  const cfg = CONFIGS[platform];
  const fullText = caption + " " + hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");
  const results: RuleResult[] = [];

  // 1) Affiliate disclosure (required everywhere).
  const disclosureOk = DISCLOSURE_PATTERNS.some((p) => p.test(fullText));
  results.push({
    rule: "affiliate_disclosure",
    label: "Affiliate disclosure",
    passed: disclosureOk,
    severity: "high",
    message: disclosureOk
      ? "พบข้อความเปิดเผยผลประโยชน์แล้ว"
      : "ต้องระบุ disclosure เช่น #โฆษณา #ad หรือ 'ได้รับค่าคอมมิชชั่น'",
  });

  // 2) AI-generated label (required on some platforms).
  const hasAiLabel = AI_LABEL_PATTERNS.some((p) => p.test(fullText));
  const aiLabelOk = !aiGenerated || !cfg.requireAiLabel || hasAiLabel;
  if (aiGenerated) {
    results.push({
      rule: "ai_label",
      label: "AI-generated label",
      passed: aiLabelOk,
      severity: cfg.requireAiLabel ? "high" : "low",
      message: !cfg.requireAiLabel
        ? "แพลตฟอร์มนี้ไม่บังคับ AI label (แนะนำให้ใส่)"
        : hasAiLabel
          ? "มีการติดป้าย AI-generated แล้ว"
          : `${PLATFORMS[platform].label} บังคับติดป้ายคอนเทนต์ AI เช่น #AIgenerated`,
    });
  }

  // 3) Prohibited claims (shared + platform-specific).
  const prohibited = [...SHARED_PROHIBITED, ...(cfg.extraProhibited ?? [])];
  const violations = prohibited.filter((c) => c.pattern.test(fullText));
  results.push({
    rule: "prohibited_claims",
    label: "ข้อความอ้างสรรพคุณต้องห้าม",
    passed: violations.length === 0,
    severity: "high",
    message:
      violations.length === 0
        ? "ไม่พบข้อความอ้างเกินจริง"
        : `พบข้อความเสี่ยง: ${violations.map((v) => v.label).join(", ")}`,
  });

  // 4) Caption length.
  if (cfg.captionMaxLength) {
    const ok = fullText.length <= cfg.captionMaxLength;
    results.push({
      rule: "caption_length",
      label: `ความยาวแคปชั่น (${PLATFORMS[platform].label})`,
      passed: ok,
      severity: "medium",
      message: ok
        ? `ความยาว ${fullText.length}/${cfg.captionMaxLength} ตัวอักษร`
        : `ยาวเกินกำหนด ${fullText.length}/${cfg.captionMaxLength} ตัวอักษร`,
    });
  }

  // 5) Platform policy note (informational).
  results.push({
    rule: "platform_policy",
    label: `นโยบายเฉพาะ ${PLATFORMS[platform].label}`,
    passed: true,
    severity: "low",
    message: cfg.policyNote,
  });

  // Aggregate.
  const highFail = results.some((r) => !r.passed && r.severity === "high");
  const medFail = results.some((r) => !r.passed && r.severity === "medium");
  const riskLevel: "low" | "medium" | "high" = highFail ? "high" : medFail ? "medium" : "low";

  // claim_risk_score: 0 (clean) → 100 (many high-severity failures).
  const failWeights = results
    .filter((r) => !r.passed)
    .map((r) => (r.severity === "high" ? 40 : r.severity === "medium" ? 20 : 5));
  const claimRiskScore = Math.min(100, failWeights.reduce((a, b) => a + b, 0));

  const status: ComplianceResult["status"] = highFail
    ? "fail"
    : medFail
      ? "needs_review"
      : "pass";

  return { results, riskLevel, claimRiskScore, disclosureOk, aiLabelOk, status };
}
