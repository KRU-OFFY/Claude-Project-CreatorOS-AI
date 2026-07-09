import { createAdapter } from "@/lib/adapters/base";
// TikTok Content Posting API. Configured when the TikTok app is set up; real
// publishing uses per-workspace tokens via lib/tiktok + the /api/connect flow.
export const tiktok = createAdapter("tiktok", "TIKTOK_CLIENT_KEY");
