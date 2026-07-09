import { createAdapter } from "@/lib/adapters/base";
// Meta Graph API (Instagram). Shares the Meta app config; publishing needs a
// linked IG business account (resolved during the Meta OAuth connect flow).
export const instagram = createAdapter("instagram", "META_APP_ID");
