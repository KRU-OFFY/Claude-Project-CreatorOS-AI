import { describe, it, expect } from "vitest";
import { hasUploadScope, authUrl, youtubeRedirectUri } from "@/lib/youtube";

describe("YouTube helpers", () => {
  describe("hasUploadScope", () => {
    it("accepts a full URL scope containing youtube.upload", () => {
      expect(
        hasUploadScope(
          "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly"
        )
      ).toBe(true);
    });
    it("rejects a scope string without upload", () => {
      expect(hasUploadScope("https://www.googleapis.com/auth/youtube.readonly")).toBe(false);
    });
    it("rejects empty string", () => {
      expect(hasUploadScope("")).toBe(false);
    });
  });

  describe("youtubeRedirectUri", () => {
    it("defaults to origin + callback path", () => {
      const oldEnv = process.env.GOOGLE_REDIRECT_URI;
      delete process.env.GOOGLE_REDIRECT_URI;
      try {
        expect(youtubeRedirectUri("https://x.test")).toBe(
          "https://x.test/api/connect/youtube/callback"
        );
      } finally {
        if (oldEnv) process.env.GOOGLE_REDIRECT_URI = oldEnv;
      }
    });
    it("honors explicit env override", () => {
      process.env.GOOGLE_REDIRECT_URI = "https://prod.example/oauth/callback";
      try {
        expect(youtubeRedirectUri("https://ignored.test")).toBe(
          "https://prod.example/oauth/callback"
        );
      } finally {
        delete process.env.GOOGLE_REDIRECT_URI;
      }
    });
  });

  describe("authUrl", () => {
    it("includes offline access + consent prompt so refresh_token is returned", () => {
      process.env.GOOGLE_CLIENT_ID = "cid";
      try {
        const url = authUrl("https://x.test", "state-abc");
        expect(url).toContain("accounts.google.com");
        expect(url).toContain("access_type=offline");
        expect(url).toContain("prompt=consent");
        expect(url).toContain("state=state-abc");
        expect(url).toContain("client_id=cid");
        expect(url).toContain(encodeURIComponent("youtube.upload"));
      } finally {
        delete process.env.GOOGLE_CLIENT_ID;
      }
    });
  });
});
