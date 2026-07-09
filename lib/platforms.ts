// Platform registry — single source of truth derived from the
// Platform Publishing Matrix (docs/spec/07_PLATFORM_PUBLISHING_MATRIX.md).

export type PlatformKey =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "x"
  | "youtube"
  | "lemon8"
  | "shopee_video"
  | "shopee_live";

export interface PlatformInfo {
  key: PlatformKey;
  label: string;
  contentTypes: string[];
  style: string;
  cta: string;
  compliance: string;
  kpis: string[];
  captionMaxLength: number | null;
  color: string; // tailwind-safe hex for badges/charts
}

export const PLATFORMS: Record<PlatformKey, PlatformInfo> = {
  facebook: {
    key: "facebook",
    label: "Facebook",
    contentTypes: ["Post", "Reels", "Story"],
    style: "Storytelling",
    cta: "คลิก/ดูตะกร้า",
    compliance: "Affiliate disclosure",
    kpis: ["Reach", "Engagement", "Clicks"],
    captionMaxLength: 63206,
    color: "#1877F2",
  },
  instagram: {
    key: "instagram",
    label: "Instagram",
    contentTypes: ["Reels", "Feed", "Story"],
    style: "Aesthetic",
    cta: "Link/DM/Shop",
    compliance: "AI label + disclosure",
    kpis: ["Views", "Saves", "Shares"],
    captionMaxLength: 2200,
    color: "#E4405F",
  },
  tiktok: {
    key: "tiktok",
    label: "TikTok",
    contentTypes: ["Short Video"],
    style: "Hook 3 วินาที",
    cta: "Comment/Shop/Link",
    compliance: "ห้าม claim เกินจริง",
    kpis: ["Views", "Watch time", "CTR"],
    captionMaxLength: 2200,
    color: "#0f0f0f",
  },
  x: {
    key: "x",
    label: "X (Twitter)",
    contentTypes: ["Post", "Thread"],
    style: "สั้น คม",
    cta: "Link click",
    compliance: "Disclosure สั้น",
    kpis: ["Impressions", "Clicks"],
    captionMaxLength: 280,
    color: "#0f1419",
  },
  youtube: {
    key: "youtube",
    label: "YouTube",
    contentTypes: ["Shorts", "Video"],
    style: "SEO",
    cta: "Link in description",
    compliance: "Paid promotion label",
    kpis: ["Watch time", "CTR"],
    captionMaxLength: 5000,
    color: "#FF0000",
  },
  lemon8: {
    key: "lemon8",
    label: "Lemon8",
    contentTypes: ["Blog-style"],
    style: "รีวิวละเอียด",
    cta: "ดูพิกัดสินค้า",
    compliance: "Disclosure",
    kpis: ["Reads", "Saves"],
    captionMaxLength: 4000,
    color: "#FFD400",
  },
  shopee_video: {
    key: "shopee_video",
    label: "Shopee Video",
    contentTypes: ["Product video"],
    style: "ขายตรง",
    cta: "กดตะกร้า",
    compliance: "Shopee policy",
    kpis: ["Product clicks", "Orders"],
    captionMaxLength: 2000,
    color: "#EE4D2D",
  },
  shopee_live: {
    key: "shopee_live",
    label: "Shopee Live",
    contentTypes: ["Live selling"],
    style: "Real-time",
    cta: "กดซื้อระหว่าง Live",
    compliance: "Live policy",
    kpis: ["Viewers", "GMV"],
    captionMaxLength: 2000,
    color: "#EE4D2D",
  },
};

export const PLATFORM_KEYS = Object.keys(PLATFORMS) as PlatformKey[];

export function platformLabel(key: string): string {
  return PLATFORMS[key as PlatformKey]?.label ?? key;
}
