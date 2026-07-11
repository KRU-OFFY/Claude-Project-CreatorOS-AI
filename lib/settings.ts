import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken, decryptToken } from "@/lib/tokens";

// Track L — workspace settings registry + resolution.
//
// Single source of truth for everything editable at /settings/system.
// Resolution order for each key: DB (workspace_settings) → process.env
// fallback → registry default. Deployments that keep everything in Vercel
// env work unchanged; values saved in-app win over env.
//
// Secrets are stored AES-256-GCM-encrypted (lib/tokens.ts) in the
// value_encrypted column, which is not client-selectable (migration 0018) —
// all reads/writes go through the service-role admin client here.

export type SettingGroup = "integrations" | "defaults" | "workflows";

export interface SettingDef {
  key: string;
  group: SettingGroup;
  /** Stored encrypted; UI must only ever show a mask. */
  secret: boolean;
  /** process.env fallback name (resolution step 2). */
  envVar?: string;
  /** Registry default (resolution step 3). */
  defaultValue?: string;
  /** Thai label for the settings UI. */
  label: string;
}

export const WORKFLOW_KEYS = [
  "workflow_publish",
  "workflow_ingest",
  "workflow_refresh_tokens",
  "workflow_render",
  "workflow_affiliate_comment",
] as const;
export type WorkflowKey = (typeof WORKFLOW_KEYS)[number];

export const SETTINGS_REGISTRY: SettingDef[] = [
  // ===== integrations =====
  { key: "anthropic_api_key", group: "integrations", secret: true, envVar: "ANTHROPIC_API_KEY", label: "Anthropic API Key" },
  { key: "meta_app_id", group: "integrations", secret: false, envVar: "META_APP_ID", label: "Meta App ID" },
  { key: "meta_app_secret", group: "integrations", secret: true, envVar: "META_APP_SECRET", label: "Meta App Secret" },
  { key: "tiktok_client_key", group: "integrations", secret: false, envVar: "TIKTOK_CLIENT_KEY", label: "TikTok Client Key" },
  { key: "tiktok_client_secret", group: "integrations", secret: true, envVar: "TIKTOK_CLIENT_SECRET", label: "TikTok Client Secret" },
  { key: "google_client_id", group: "integrations", secret: false, envVar: "GOOGLE_CLIENT_ID", label: "Google Client ID" },
  { key: "google_client_secret", group: "integrations", secret: true, envVar: "GOOGLE_CLIENT_SECRET", label: "Google Client Secret" },
  { key: "resend_api_key", group: "integrations", secret: true, envVar: "RESEND_API_KEY", label: "Resend API Key" },
  { key: "resend_from_email", group: "integrations", secret: false, envVar: "RESEND_FROM_EMAIL", label: "อีเมลผู้ส่ง (Resend)" },
  { key: "sentry_dsn", group: "integrations", secret: false, envVar: "SENTRY_DSN", label: "Sentry DSN" },
  { key: "render_worker_url", group: "integrations", secret: false, envVar: "RENDER_WORKER_URL", label: "Render Worker URL" },
  { key: "render_worker_secret", group: "integrations", secret: true, envVar: "RENDER_WORKER_SECRET", label: "Render Worker Secret (HMAC)" },
  // ===== defaults =====
  { key: "ai_model", group: "defaults", secret: false, envVar: "AI_MODEL", defaultValue: "claude-sonnet-5", label: "โมเดล AI" },
  { key: "tiktok_default_privacy_level", group: "defaults", secret: false, envVar: "TIKTOK_DEFAULT_PRIVACY_LEVEL", label: "TikTok privacy level เริ่มต้น" },
  { key: "youtube_default_privacy", group: "defaults", secret: false, envVar: "YOUTUBE_DEFAULT_PRIVACY", defaultValue: "private", label: "YouTube privacy เริ่มต้น" },
  // ===== workflows (boolean "true"/"false", default on) =====
  { key: "workflow_publish", group: "workflows", secret: false, defaultValue: "true", label: "โพสต์อัตโนมัติตามคิว (publish cron)" },
  { key: "workflow_ingest", group: "workflows", secret: false, defaultValue: "true", label: "ดึงสถิติโพสต์อัตโนมัติ (ingest cron)" },
  { key: "workflow_refresh_tokens", group: "workflows", secret: false, defaultValue: "true", label: "ต่ออายุ token อัตโนมัติ" },
  { key: "workflow_render", group: "workflows", secret: false, defaultValue: "true", label: "Render วิดีโอผ่าน worker" },
  { key: "workflow_affiliate_comment", group: "workflows", secret: false, defaultValue: "true", label: "คอมเมนต์ลิงก์ Affiliate อัตโนมัติ (Facebook)" },
];

const BY_KEY = new Map(SETTINGS_REGISTRY.map((d) => [d.key, d]));

export function settingDef(key: string): SettingDef | undefined {
  return BY_KEY.get(key);
}

export type SettingOrigin = "db" | "env" | "default" | "missing";

export interface ResolvedSetting {
  value: string | null;
  origin: SettingOrigin;
}

// Pure resolution step — exported for tests.
export function resolveSetting(
  def: SettingDef,
  dbValue: string | null | undefined
): ResolvedSetting {
  if (dbValue != null && dbValue !== "") return { value: dbValue, origin: "db" };
  const envValue = def.envVar ? (process.env[def.envVar] ?? "") : "";
  if (envValue) return { value: envValue, origin: "env" };
  if (def.defaultValue != null) return { value: def.defaultValue, origin: "default" };
  return { value: null, origin: "missing" };
}

type SettingsRow = { key: string; value: string | null; value_encrypted: string | null };

// Load every stored row for a workspace via the service-role client
// (value_encrypted is not client-selectable). Returns decrypted values.
// Demo mode (no Supabase/service key) → empty map, so env/defaults apply.
export async function loadWorkspaceSettings(
  workspaceId: string
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!workspaceId) return out;
  const admin = createAdminClient();
  if (!admin) return out;
  const { data, error } = await admin
    .from("workspace_settings")
    .select("key, value, value_encrypted")
    .eq("workspace_id", workspaceId);
  if (error || !data) return out;
  for (const row of data as SettingsRow[]) {
    const def = BY_KEY.get(row.key);
    if (!def) continue; // ignore unknown keys (stale rows)
    if (def.secret) {
      const dec = row.value_encrypted ? decryptToken(row.value_encrypted) : null;
      if (dec) out.set(row.key, dec);
    } else if (row.value != null && row.value !== "") {
      out.set(row.key, row.value);
    }
  }
  return out;
}

export async function getSetting(
  workspaceId: string,
  key: string
): Promise<string | null> {
  const def = BY_KEY.get(key);
  if (!def) return null;
  const stored = await loadWorkspaceSettings(workspaceId);
  return resolveSetting(def, stored.get(key)).value;
}

// Resolve the full registry at once (one DB round-trip) — used by the
// settings page and by call sites that need several values.
export async function getAllSettings(
  workspaceId: string
): Promise<Map<string, ResolvedSetting>> {
  const stored = await loadWorkspaceSettings(workspaceId);
  const out = new Map<string, ResolvedSetting>();
  for (const def of SETTINGS_REGISTRY) {
    out.set(def.key, resolveSetting(def, stored.get(def.key)));
  }
  return out;
}

// One-round-trip resolver for integration call sites (OAuth routes, publish,
// crons, render, team). Values are fully resolved (DB → env → default).
export interface IntegrationConfig {
  meta: { appId: string; appSecret: string };
  tiktok: { clientKey: string; clientSecret: string };
  google: { clientId: string; clientSecret: string };
  resend: { apiKey: string; fromEmail: string };
  render: { url: string; secret: string };
  ai: { apiKey: string; model: string };
  defaults: { tiktokPrivacyLevel: string; youtubePrivacy: string };
}

export async function getIntegrationConfig(
  workspaceId: string
): Promise<IntegrationConfig> {
  const all = await getAllSettings(workspaceId);
  const v = (key: string) => all.get(key)?.value ?? "";
  return {
    meta: { appId: v("meta_app_id"), appSecret: v("meta_app_secret") },
    tiktok: { clientKey: v("tiktok_client_key"), clientSecret: v("tiktok_client_secret") },
    google: { clientId: v("google_client_id"), clientSecret: v("google_client_secret") },
    resend: { apiKey: v("resend_api_key"), fromEmail: v("resend_from_email") },
    render: { url: v("render_worker_url"), secret: v("render_worker_secret") },
    ai: { apiKey: v("anthropic_api_key"), model: v("ai_model") },
    defaults: {
      tiktokPrivacyLevel: v("tiktok_default_privacy_level"),
      youtubePrivacy: v("youtube_default_privacy"),
    },
  };
}

export async function isWorkflowEnabled(
  workspaceId: string,
  workflow: WorkflowKey
): Promise<boolean> {
  const v = await getSetting(workspaceId, workflow);
  return v !== "false";
}

// Display helper — never send full secrets to the client. "sk-ant-…x7Kq"
// style: keep the last 4 chars, mask the rest at fixed width.
export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `••••••••${value.slice(-4)}`;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

// Owner check happens in the server action (application role check) before
// calling this — writes use the admin client because value_encrypted is not
// writable through the anon-key client's column grants.
export async function saveWorkspaceSetting(
  workspaceId: string,
  key: string,
  rawValue: string,
  updatedBy: string | null
): Promise<SaveResult> {
  const def = BY_KEY.get(key);
  if (!def) return { ok: false, error: "unknown setting key" };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Supabase ยังไม่ถูกตั้งค่า" };

  const value = rawValue.trim();
  if (value === "") return deleteWorkspaceSetting(workspaceId, key);

  let row: Record<string, unknown>;
  if (def.secret) {
    const enc = encryptToken(value);
    if (!enc) {
      return {
        ok: false,
        error: "TOKEN_ENCRYPTION_KEY ยังไม่ถูกตั้งค่าบนเซิร์ฟเวอร์ — บันทึกค่า secret ไม่ได้",
      };
    }
    row = { value: null, value_encrypted: enc };
  } else {
    row = { value, value_encrypted: null };
  }

  const { error } = await admin.from("workspace_settings").upsert(
    {
      workspace_id: workspaceId,
      key,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
      ...row,
    },
    { onConflict: "workspace_id,key" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteWorkspaceSetting(
  workspaceId: string,
  key: string
): Promise<SaveResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Supabase ยังไม่ถูกตั้งค่า" };
  const { error } = await admin
    .from("workspace_settings")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("key", key);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
