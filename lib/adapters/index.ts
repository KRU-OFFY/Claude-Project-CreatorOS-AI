import type { PlatformKey } from "@/lib/platforms";
import type { PlatformAdapter } from "@/lib/adapters/types";
import { facebook } from "@/lib/adapters/facebook";
import { instagram } from "@/lib/adapters/instagram";
import { tiktok } from "@/lib/adapters/tiktok";
import { x } from "@/lib/adapters/x";
import { youtube } from "@/lib/adapters/youtube";
import { lemon8 } from "@/lib/adapters/lemon8";
import { shopeeVideo } from "@/lib/adapters/shopee-video";
import { shopeeLive } from "@/lib/adapters/shopee-live";

export const adapters: Record<PlatformKey, PlatformAdapter> = {
  facebook,
  instagram,
  tiktok,
  x,
  youtube,
  lemon8,
  shopee_video: shopeeVideo,
  shopee_live: shopeeLive,
};

export function getAdapter(platform: PlatformKey): PlatformAdapter {
  return adapters[platform];
}
