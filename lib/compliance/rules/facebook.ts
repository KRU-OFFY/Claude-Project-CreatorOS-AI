import type { PlatformComplianceConfig } from "@/lib/compliance/types";

// Facebook — affiliate disclosure required; long caption limit.
export const facebook: PlatformComplianceConfig = {
  requireAiLabel: false,
  captionMaxLength: 63206,
  policyNote: "ต้องมี affiliate disclosure ตามนโยบาย Facebook",
};
