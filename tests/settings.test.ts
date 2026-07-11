import { describe, it, expect, beforeEach, vi } from "vitest";

// lib/settings resolution is exercised with the Supabase admin client and the
// token crypto mocked, so the DB → env → default ladder is verifiable without
// a database or a real TOKEN_ENCRYPTION_KEY.

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/tokens", () => ({
  encryptToken: vi.fn((v: string) => `enc:${v}`),
  decryptToken: vi.fn((v: string) => (v.startsWith("enc:") ? v.slice(4) : null)),
}));

import {
  resolveSetting,
  settingDef,
  maskSecret,
  getSetting,
  isWorkflowEnabled,
  saveWorkspaceSetting,
} from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

type Row = { key: string; value: string | null; value_encrypted: string | null };

function adminWithRows(rows: Row[]) {
  return {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: rows, error: null }),
      }),
    }),
  } as unknown as ReturnType<typeof createAdminClient>;
}

beforeEach(() => {
  vi.mocked(createAdminClient).mockReset();
  vi.mocked(createAdminClient).mockReturnValue(null);
  delete process.env.AI_MODEL;
});

describe("resolveSetting — DB → env → default ladder", () => {
  const def = settingDef("ai_model")!; // envVar AI_MODEL, default claude-sonnet-5

  it("DB value wins over env and default", () => {
    process.env.AI_MODEL = "env-model";
    expect(resolveSetting(def, "db-model")).toEqual({ value: "db-model", origin: "db" });
  });

  it("env wins when DB is empty", () => {
    process.env.AI_MODEL = "env-model";
    expect(resolveSetting(def, null)).toEqual({ value: "env-model", origin: "env" });
  });

  it("falls back to the registry default", () => {
    expect(resolveSetting(def, undefined)).toEqual({
      value: "claude-sonnet-5",
      origin: "default",
    });
  });

  it("reports missing when nothing is set anywhere", () => {
    const secretDef = settingDef("anthropic_api_key")!;
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(resolveSetting(secretDef, null)).toEqual({ value: null, origin: "missing" });
    if (saved) process.env.ANTHROPIC_API_KEY = saved;
  });
});

describe("maskSecret", () => {
  it("keeps only the last 4 characters", () => {
    expect(maskSecret("sk-ant-abcdef7Kq9")).toBe("••••••••7Kq9");
  });
  it("fully masks short values", () => {
    expect(maskSecret("abcd")).toBe("••••");
  });
  it("returns empty for empty input", () => {
    expect(maskSecret("")).toBe("");
    expect(maskSecret(null)).toBe("");
  });
});

describe("getSetting / isWorkflowEnabled with stored rows", () => {
  it("returns the DB value for a non-secret key", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      adminWithRows([{ key: "ai_model", value: "claude-x", value_encrypted: null }])
    );
    expect(await getSetting("ws1", "ai_model")).toBe("claude-x");
  });

  it("decrypts secrets stored in value_encrypted", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      adminWithRows([
        { key: "anthropic_api_key", value: null, value_encrypted: "enc:sk-live-1234" },
      ])
    );
    expect(await getSetting("ws1", "anthropic_api_key")).toBe("sk-live-1234");
  });

  it("workflows default to enabled with no rows (and in demo mode)", async () => {
    expect(await isWorkflowEnabled("ws1", "workflow_publish")).toBe(true);
    vi.mocked(createAdminClient).mockReturnValue(adminWithRows([]));
    expect(await isWorkflowEnabled("ws1", "workflow_affiliate_comment")).toBe(true);
  });

  it("a stored 'false' disables the workflow", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      adminWithRows([{ key: "workflow_publish", value: "false", value_encrypted: null }])
    );
    expect(await isWorkflowEnabled("ws1", "workflow_publish")).toBe(false);
  });
});

describe("saveWorkspaceSetting", () => {
  it("encrypts secret values into value_encrypted", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createAdminClient).mockReturnValue({
      from: () => ({ upsert }),
    } as unknown as ReturnType<typeof createAdminClient>);
    const res = await saveWorkspaceSetting("ws1", "anthropic_api_key", "sk-live-1234", "u1");
    expect(res.ok).toBe(true);
    const row = upsert.mock.calls[0][0];
    expect(row.value).toBeNull();
    expect(row.value_encrypted).toBe("enc:sk-live-1234");
  });

  it("stores non-secret values in plain value", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createAdminClient).mockReturnValue({
      from: () => ({ upsert }),
    } as unknown as ReturnType<typeof createAdminClient>);
    const res = await saveWorkspaceSetting("ws1", "ai_model", "claude-x", "u1");
    expect(res.ok).toBe(true);
    const row = upsert.mock.calls[0][0];
    expect(row.value).toBe("claude-x");
    expect(row.value_encrypted).toBeNull();
  });

  it("rejects unknown keys", async () => {
    const res = await saveWorkspaceSetting("ws1", "nope", "x", "u1");
    expect(res.ok).toBe(false);
  });
});
