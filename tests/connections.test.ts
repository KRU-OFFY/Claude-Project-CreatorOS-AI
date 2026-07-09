import { describe, it, expect, beforeAll } from "vitest";

let signState: typeof import("@/lib/connections").signState;
let verifyState: typeof import("@/lib/connections").verifyState;

beforeAll(async () => {
  process.env.META_APP_SECRET = "test-secret-for-state-signing";
  const mod = await import("@/lib/connections");
  signState = mod.signState;
  verifyState = mod.verifyState;
});

describe("OAuth state signing (CSRF)", () => {
  it("round-trips the workspace id", () => {
    const state = signState("ws-123");
    const v = verifyState(state);
    expect(v?.workspaceId).toBe("ws-123");
  });

  it("rejects a tampered signature", () => {
    const state = signState("ws-123");
    const tampered = state.slice(0, -3) + "xxx";
    expect(verifyState(tampered)).toBeNull();
  });

  it("rejects malformed state", () => {
    expect(verifyState("not-a-state")).toBeNull();
    expect(verifyState("")).toBeNull();
  });
});
