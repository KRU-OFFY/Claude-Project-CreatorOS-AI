import { createAdapter } from "@/lib/adapters/base";
// Meta Graph API (Facebook). Configured when the Meta app is set up; real
// publishing uses per-workspace page tokens via lib/meta + the /api/connect flow.
export const facebook = createAdapter("facebook", "META_APP_ID");
