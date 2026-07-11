// Track K — Auto Affiliate Link placement.
//
// Pure functions (no server-only imports) that decide, per platform, where a
// product's affiliate URL goes when publishing:
// - facebook: keep the caption clean (links in captions hurt reach) and post
//   the link as an automatic first comment after the post succeeds.
// - instagram / tiktok / youtube: append the link to the caption/description.
// - anything else (or an invalid/missing URL): passthrough unchanged.

export interface AffiliatePlacement {
  caption: string;
  firstComment: string | null;
}

// Only http(s) URLs qualify — rejects javascript:, ftp:, data:, and garbage.
export function isValidAffiliateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function placeAffiliateLink(
  caption: string,
  url: string | null | undefined,
  platform: string
): AffiliatePlacement {
  if (!url || !isValidAffiliateUrl(url)) {
    return { caption, firstComment: null };
  }
  if (platform === "facebook") {
    // Link goes into the first comment, not the caption (preserves reach).
    return { caption, firstComment: `🔥 สนใจสั่งซื้อ คลิกเลย! ${url}` };
  }
  if (platform === "instagram" || platform === "tiktok" || platform === "youtube") {
    return { caption: `${caption}\n\n🛒 ${url}`, firstComment: null };
  }
  return { caption, firstComment: null };
}
