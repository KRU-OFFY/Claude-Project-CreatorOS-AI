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
}));

vi.mock("@/lib/tiktok", () => ({
  publishVideo: vi.fn(),
}));

import { executePublish } from "@/lib/publish";
import { getMetaConnection, getConnection } from "@/lib/connections";
import { publishFacebook, publishInstagram } from "@/lib/meta";
import { publishVideo } from "@/lib/tiktok";

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
  vi.mocked(publishVideo).mockReset();
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
  it("uses the generic getConnection (not getMetaConnection)", async () => {
    vi.mocked(getConnection).mockResolvedValue(conn("tt-token"));
    vi.mocked(publishVideo).mockResolvedValue("pub_1");
    const out = await executePublish(
      { workspace_id: "ws", platform: "tiktok" },
      { ...variantBase, media_url: "https://x.test/v.mp4" }
    );
    expect(getConnection).toHaveBeenCalledWith("ws", "tiktok");
    expect(getMetaConnection).not.toHaveBeenCalled();
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
});

describe("executePublish — unsupported platform", () => {
  it("returns copy-to-post hint (no throw) for a stub platform", async () => {
    const out = await executePublish({ workspace_id: "ws", platform: "shopee_video" }, variantBase);
    expect(out.error).toContain("copy-to-post");
    expect(out.publishedUrl).toBeUndefined();
  });
});
