import { createAdapter } from "@/lib/adapters/base";
// TikTok Content Posting API. Set TIKTOK_ACCESS_TOKEN to enable real publishing.
export const tiktok = createAdapter("tiktok", "TIKTOK_ACCESS_TOKEN");
