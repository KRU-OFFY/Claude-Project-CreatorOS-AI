import type { PlatformComplianceConfig } from "@/lib/compliance/types";

// YouTube — paid promotion label required; AI content should be disclosed.
export const youtube: PlatformComplianceConfig = {
  requireAiLabel: true,
  captionMaxLength: 5000,
  policyNote: "ต้องมี paid promotion label และแจ้งการใช้ AI",
};
