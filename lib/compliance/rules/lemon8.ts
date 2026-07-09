import type { PlatformComplianceConfig } from "@/lib/compliance/types";

// Lemon8 — blog-style review; disclosure required.
export const lemon8: PlatformComplianceConfig = {
  requireAiLabel: false,
  captionMaxLength: 4000,
  policyNote: "ต้องมี disclosure ในรีวิว",
};
