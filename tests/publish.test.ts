import { describe, it, expect, beforeEach, vi } from "vitest";

// executePublish is exercised via the publishNow action + cron worker in
// production. This suite mocks the connector layer so the routing logic
// (platform → connector, missing-conn / missing-media guards, error
// swallowing) is verifiable without hitting Meta/TikTok in tests.

vi.mock("@/lib/connections", () => ({
  getMetaConnection: vi.fn(),
  getConnection: vi.fn(),
}));

vi.mock("@/lib/meta", () => ({
  publishFacebook: vi.fn(),
  publishInstagram: vi.fn(),
  commentOnPost: vi.fn(),
}));

vi.mock("@/lib/tiktok", () => ({
  publishVideo: vi.fn(),
  creatorInfo: vi.fn(),
}));

vi.mock("@/lib/youtube", () => ({
  publishVideo: vi.fn(),
}));

// Workspace settings (Track L): the default in these tests is "nothing
// stored" — workflows enabled, no per-workspace overrides — matching a fresh
// workspace / demo mode.
vi.mock("@/lib/settings", () => ({
  getSetting: vi.fn(),
  isWorkflowEnabled: vi.fn(),
}));

import { executePublish } from "@/lib/publish";
import { getMetaConnection, getConnection } from "@/lib/connections";
import { publishFacebook, publishInstagram, commentOnPost } from "@/lib/meta";
import { publishVideo, creatorInfo } from "@/lib/tiktok";
import { publishVideo as publishYouTubeVideo } from "@/lib/youtube";
import { getSetting, isWorkflowEnabled } from "@/lib/settings";

const conn = (token: string, metadata: Record<string, unknown> = {}) => ({
  accountName: "acct",
  token,
  refreshToken: null,
  metadata,
});

beforeEach(() => {
  vi.mocked(getMetaConnection).mockReset();
  vi.mocked(getConnection).mockReset();
  vi.mocked(publishFacebook).mockReset();
  vi.mocked(publishInstagram).mockReset();
  vi.mocked(commentOnPost).mockReset();
  vi.mocked(publishVideo).mockReset();
  vi.mocked(creatorInfo).mockReset();
  vi.mocked(publishYouTubeVideo).mockReset();
  vi.mocked(getSetting).mockReset();
  vi.mocked(isWorkflowEnabled).mockReset();
  vi.mocked(getSetting).mockResolvedValue(null);
  vi.mocked(isWorkflowEnabled).mockResolvedValue(true);
  // TikTok Direct Post requires privacy_level from creator_info; default the
  // mock to SELF_ONLY-capable so the happy path proceeds.
  vi.mocked(creatorInfo).mockResolvedValue({
    nickname: "tester",
    privacyLevelOptions: ["SELF_ONLY"],
  });
});

const variantBase = { variant_body: "hello", hashtags: null, cta: null, media_url: null };

describe("executePublish — facebook", () => {
  it("returns Thai error when no Facebook connection", async () => {
    vi.mocked(getMetaConnection).mockResolvedValue(null);
    const out = await executePublish({ workspace_id: "ws", platform: "facebook" }, variantBase);
    expect(out.error).toContain("Facebook");
    expect(out.publishedUrl).toBeUndefined();
  });

  it("posts with page id + caption + hashtags", async () => {
    vi.mocked(getMetaConnection).mockResolvedValue(conn("tok", { page_id: "123" }));
    vi.mocked(publishFacebook).mockResolvedValue("post_42");
    const out = await executePublish(
      { workspace_id: "ws", platform: "facebook" },
      { ...variantBase, hashtags: ["a", "b"] }
    );
    expect(publishFacebook).toHaveBeenCalledWith("123", "tok", "hello\n#a #b", null);
    expect(out.publishedUrl).toBe("https://facebook.com/post_42");
  });

  it("swallows connector errors into a human-readable error", async () => {
    vi.mocked(getMetaConnection).mockResolvedValue(conn("tok", { page_id: "123" }));
    vi.mocked(publishFacebook).mockRejectedValue(new Error("graph 500"));
    const out = await executePublish({ workspace_id: "ws", platform: "facebook" }, variantBase);
    expect(out.error).toBe("graph 500");
    expect(out.publishedUrl).toBeUndefined();
  });

  it("posts the affiliate link as an automatic first comment (caption untouched)", async () => {
    vi.mocked(getMetaConnection).mockResolvedValue(conn("tok", { page_id: "123" }));
    vi.mocked(publishFacebook).mockResolvedValue("post_42");
    vi.mocked(commentOnPost).mockResolvedValue("comment_1");
    const out = await executePublish(
      { workspace_id: "ws", platform: "facebook" },
      { ...variantBase, affiliate_url: "https://s.shopee.co.th/xxx" }
    );
    // Caption stays clean — the link never enters the FB post body.
    expect(publishFacebook).toHaveBeenCalledWith("123", "tok", "hello", null);
    expect(commentOnPost).toHaveBeenCalledWith(
      "post_42",
      "tok",
      "🔥 สนใจสั่งซื้อ คลิกเลย! https://s.shopee.co.th/xxx"
    );
    expect(out.publishedUrl).toBe("https://facebook.com/post_42");
  });

  it("still succeeds when the affiliate first comment fails", async () => {
    vi.mocked(getMetaConnection).mockResolvedValue(conn("tok", { page_id: "123" }));
    vi.mocked(publishFacebook).mockResolvedValue("post_42");
    vi.mocked(commentOnPost).mockRejectedValue(new Error("comment blocked"));
    const out = await executePublish(
      { workspace_id: "ws", platform: "facebook" },
      { ...variantBase, affiliate_url: "https://s.shopee.co.th/xxx" }
    );
    expect(commentOnPost).toHaveBeenCalled();
    expect(out.error).toBeUndefined();
    expect(out.publishedUrl).toBe("https://facebook.com/post_42");
  });

  it("skips the first comment when workflow_affiliate_comment is disabled", async () => {
    vi.mocked(getMetaConnection).mockResolvedValue(conn("tok", { page_id: "123" }));
    vi.mocked(publishFacebook).mockResolvedValue("post_42");
    vi.mocked(isWorkflowEnabled).mockResolvedValue(false);
    const out = await executePublish(
      { workspace_id: "ws", platform: "facebook" },
      { ...variantBase, affiliate_url: "https://s.shopee.co.th/xxx" }
    );
    expect(isWorkflowEnabled).toHaveBeenCalledWith("ws", "workflow_affiliate_comment");
    expect(commentOnPost).not.toHaveBeenCalled();
    expect(out.publishedUrl).toBe("https://facebook.com/post_42");
  });
});

describe("executePublish — instagram", () => {
  it("requires media_url", async () => {
    vi.mocked(getMetaConnection).mockResolvedValue(conn("tok", { ig_user_id: "9" }));
    const out = await executePublish({ workspace_id: "ws", platform: "instagram" }, variantBase);
    expect(out.error).toMatch(/media_url/);
    expect(publishInstagram).not.toHaveBeenCalled();
  });

  it("posts when media_url present", async () => {
    vi.mocked(getMetaConnection).mockResolvedValue(conn("tok", { ig_user_id: "9" }));
    vi.mocked(publishInstagram).mockResolvedValue("media_1");
    const out = await executePublish(
      { workspace_id: "ws", platform: "instagram" },
      { ...variantBase, media_url: "https://x.test/img.jpg" }
    );
    expect(publishInstagram).toHaveBeenCalledWith("9", "tok", "hello", "https://x.test/img.jpg");
    expect(out.publishedUrl).toBe("https://instagram.com/p/media_1");
  });
});

describe("executePublish — tiktok", () => {
  it("uses the generic getConnection and passes the allowed privacy level", async () => {
    vi.mocked(getConnection).mockResolvedValue(conn("tt-token"));
    vi.mocked(publishVideo).mockResolvedValue("pub_1");
    const out = await executePublish(
      { workspace_id: "ws", platform: "tiktok" },
      { ...variantBase, media_url: "https://x.test/v.mp4" }
    );
    expect(getConnection).toHaveBeenCalledWith("ws", "tiktok");
    expect(getMetaConnection).not.toHaveBeenCalled();
    expect(publishVideo).toHaveBeenCalledWith(
      "tt-token",
      "hello",
      "https://x.test/v.mp4",
      "SELF_ONLY"
    );
    expect(out.publishedUrl).toBe("tiktok:publish/pub_1");
  });

  it("requires media_url", async () => {
    vi.mocked(getConnection).mockResolvedValue(conn("tt-token"));
    const out = await executePublish(
      { workspace_id: "ws", platform: "tiktok" },
      variantBase
    );
    expect(out.error).toMatch(/วิดีโอ/);
    expect(publishVideo).not.toHaveBeenCalled();
  });

  it("errors when creator_info returns no allowed privacy levels", async () => {
    vi.mocked(getConnection).mockResolvedValue(conn("tt-token"));
    vi.mocked(creatorInfo).mockResolvedValue({ nickname: "t", privacyLevelOptions: [] });
    const out = await executePublish(
      { workspace_id: "ws", platform: "tiktok" },
      { ...variantBase, media_url: "https://x.test/v.mp4" }
    );
    expect(out.error).toMatch(/privacy_level/);
    expect(publishVideo).not.toHaveBeenCalled();
  });
});

describe("executePublish — youtube", () => {
  it("posts via the YouTube connector and returns the watch URL", async () => {
    vi.mocked(getConnection).mockResolvedValue(conn("yt-token"));
    vi.mocked(publishYouTubeVideo).mockResolvedValue("vid123");
    const out = await executePublish(
      { workspace_id: "ws", platform: "youtube" },
      { ...variantBase, media_url: "https://x.test/v.mp4" }
    );
    expect(getConnection).toHaveBeenCalledWith("ws", "youtube");
    expect(publishYouTubeVideo).toHaveBeenCalledWith(
      "yt-token",
      "hello",
      "https://x.test/v.mp4",
      "private"
    );
    expect(out.publishedUrl).toBe("https://youtube.com/watch?v=vid123");
  });

  it("requires media_url", async () => {
    vi.mocked(getConnection).mockResolvedValue(conn("yt-token"));
    const out = await executePublish(
      { workspace_id: "ws", platform: "youtube" },
      variantBase
    );
    expect(out.error).toMatch(/วิดีโอ/);
    expect(publishYouTubeVideo).not.toHaveBeenCalled();
  });
});

describe("executePublish — unsupported platform", () => {
  it("returns copy-to-post hint (no throw) for a stub platform", async () => {
    const out = await executePublish({ workspace_id: "ws", platform: "shopee_video" }, variantBase);
    expect(out.error).toContain("copy-to-post");
    expect(out.publishedUrl).toBeUndefined();
  });
});
