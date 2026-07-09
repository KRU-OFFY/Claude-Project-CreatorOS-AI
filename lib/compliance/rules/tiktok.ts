import type { PlatformComplianceConfig } from "@/lib/compliance/types";

// TikTok — strict on exaggerated claims; AI-generated content must be labeled.
export const tiktok: PlatformComplianceConfig = {
  requireAiLabel: true,
  captionMaxLength: 2200,
  policyNote: "ห้าม claim เกินจริง และต้องติดป้ายคอนเทนต์ AI",
  extraProhibited: [
    { pattern: /ดีที่สุด|เบอร์หนึ่ง/, label: "อ้างว่าดีที่สุด/อันดับหนึ่ง" },
  ],
};
