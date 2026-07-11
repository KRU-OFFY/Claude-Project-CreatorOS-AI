import { describe, it, expect } from "vitest";

import { isValidAffiliateUrl, placeAffiliateLink } from "@/lib/affiliate";

// Track K — per-platform affiliate link placement. Pure functions, no mocks.

describe("isValidAffiliateUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isValidAffiliateUrl("https://s.shopee.co.th/xxx")).toBe(true);
    expect(isValidAffiliateUrl("http://example.com/aff?id=1")).toBe(true);
  });

  it("rejects non-http(s) protocols and garbage", () => {
    expect(isValidAffiliateUrl("javascript:alert(1)")).toBe(false);
    expect(isValidAffiliateUrl("ftp://example.com/file")).toBe(false);
    expect(isValidAffiliateUrl("not a url")).toBe(false);
    expect(isValidAffiliateUrl("")).toBe(false);
  });
});

describe("placeAffiliateLink — facebook", () => {
  it("keeps the caption unchanged and returns the link as a first comment", () => {
    const out = placeAffiliateLink("hello\n#a", "https://s.shopee.co.th/xxx", "facebook");
    expect(out.caption).toBe("hello\n#a");
    expect(out.firstComment).toBe("🔥 สนใจสั่งซื้อ คลิกเลย! https://s.shopee.co.th/xxx");
  });
});

describe("placeAffiliateLink — caption-append platforms", () => {
  it.each(["instagram", "tiktok", "youtube"])(
    "appends the link to the caption for %s",
    (platform) => {
      const out = placeAffiliateLink("hello", "https://example.com/p", platform);
      expect(out.caption).toBe("hello\n\n🛒 https://example.com/p");
      expect(out.firstComment).toBeNull();
    }
  );
});

describe("placeAffiliateLink — passthrough", () => {
  it.each(["javascript:alert(1)", "ftp://example.com/x", "garbage"])(
    "passes through unchanged for invalid URL %s",
    (url) => {
      const out = placeAffiliateLink("hello", url, "facebook");
      expect(out).toEqual({ caption: "hello", firstComment: null });
    }
  );

  it("passes through for null / undefined / empty URL", () => {
    expect(placeAffiliateLink("hello", null, "instagram")).toEqual({
      caption: "hello",
      firstComment: null,
    });
    expect(placeAffiliateLink("hello", undefined, "tiktok")).toEqual({
      caption: "hello",
      firstComment: null,
    });
    expect(placeAffiliateLink("hello", "", "youtube")).toEqual({
      caption: "hello",
      firstComment: null,
    });
  });

  it("passes through for unknown platforms even with a valid URL", () => {
    const out = placeAffiliateLink("hello", "https://example.com/p", "shopee_video");
    expect(out).toEqual({ caption: "hello", firstComment: null });
  });
});
