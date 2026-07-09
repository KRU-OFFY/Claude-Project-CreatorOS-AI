import { createAdapter } from "@/lib/adapters/base";
// YouTube Data API. Set YOUTUBE_ACCESS_TOKEN to enable real publishing.
export const youtube = createAdapter("youtube", "YOUTUBE_ACCESS_TOKEN");
