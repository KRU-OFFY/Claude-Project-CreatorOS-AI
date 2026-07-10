import { describe, it, expect } from "vitest";
import {
  generateInviteToken,
  isInvitableRole,
  normalizeEmail,
  inviteUrl,
} from "@/lib/team";

describe("invite token", () => {
  it("is url-safe and long enough", () => {
    const t = generateInviteToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    // 32 bytes → 43 base64url chars.
    expect(t.length).toBeGreaterThanOrEqual(43);
  });

  it("is unique across many calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateInviteToken());
    expect(seen.size).toBe(1000);
  });
});

describe("role validation", () => {
  it("accepts the four canonical roles", () => {
    for (const r of ["owner", "editor", "approver", "viewer"]) {
      expect(isInvitableRole(r)).toBe(true);
    }
  });
  it("rejects nonsense", () => {
    expect(isInvitableRole("admin")).toBe(false);
    expect(isInvitableRole("")).toBe(false);
    expect(isInvitableRole("Editor")).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("lowercases + trims", () => {
    expect(normalizeEmail("  ALICE@Example.COM ")).toBe("alice@example.com");
  });
});

describe("inviteUrl", () => {
  it("percent-encodes the token", () => {
    const url = inviteUrl({ origin: "https://x.test", token: "abc/def+ghi" });
    expect(url).toBe("https://x.test/invite/abc%2Fdef%2Bghi");
  });
});
