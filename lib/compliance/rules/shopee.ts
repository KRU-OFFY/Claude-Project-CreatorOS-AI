import type { PlatformComplianceConfig } from "@/lib/compliance/types";

// Shopee — shared config for Shopee Video and Shopee Live.
// Must follow Shopee marketplace / live selling policy; no misleading claims.
export const shopee: PlatformComplianceConfig = {
  requireAiLabel: false,
  captionMaxLength: 2000,
  policyNote: "ต้องเป็นไปตามนโยบาย Shopee (ห้ามข้อความชวนเชื่อเกินจริง)",
  extraProhibited: [
    { pattern: /ถูกที่สุด|ราคาถูกที่สุด/, label: "อ้างราคาถูกที่สุด" },
  ],
};
