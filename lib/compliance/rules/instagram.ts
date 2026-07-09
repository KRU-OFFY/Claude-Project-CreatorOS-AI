import type { PlatformComplianceConfig } from "@/lib/compliance/types";

// Instagram — AI label + affiliate disclosure both required.
export const instagram: PlatformComplianceConfig = {
  requireAiLabel: true,
  captionMaxLength: 2200,
  policyNote: "ต้องมีทั้ง AI label และ affiliate disclosure",
};
