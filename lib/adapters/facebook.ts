import { createAdapter } from "@/lib/adapters/base";
// Meta Graph API (Facebook). Set META_ACCESS_TOKEN to enable real publishing.
export const facebook = createAdapter("facebook", "META_ACCESS_TOKEN");
