import type { PlatformComplianceConfig } from "@/lib/compliance/types";

// X (Twitter) — short disclosure; 280 char limit.
export const x: PlatformComplianceConfig = {
  requireAiLabel: false,
  captionMaxLength: 280,
  policyNote: "ต้องมี disclosure สั้นๆ (#ad) ภายใน 280 ตัวอักษร",
};
