import { createAdapter } from "@/lib/adapters/base";
// X (Twitter) API v2. Set X_ACCESS_TOKEN to enable real publishing.
export const x = createAdapter("x", "X_ACCESS_TOKEN");
