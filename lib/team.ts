import "server-only";

import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// Opaque, URL-safe invite token. 32 bytes of entropy is well beyond guessable
// and fits comfortably in a link/QR. The DB has a unique index — a collision
// bubbles up as a duplicate-key error the caller can retry.
export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export const INVITABLE_ROLES = ["owner", "editor", "approver", "viewer"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export function isInvitableRole(v: string): v is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(v);
}

// The single place role changes are allowed. Owners can grant any role — but
// we deliberately prevent an owner from demoting THEMSELVES via changeRole:
// the only way to hand off owner is transferOwnership (atomic swap), so a
// workspace can never end up with zero owners.
export function canOwnerAssignRole(role: string): role is InvitableRole {
  return isInvitableRole(role);
}

// Normalize emails so an invite for `ALICE@Example.com` matches the account
// signed in as `alice@example.com`. Comparison is done on the normalized form.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface InviteLinkInput {
  origin: string;
  token: string;
}

export function inviteUrl({ origin, token }: InviteLinkInput): string {
  return `${origin}/invite/${encodeURIComponent(token)}`;
}

// Log with a stable action taxonomy so the audit page can group Team events.
export const TEAM_ACTIONS = {
  invite: "team.invite",
  inviteRevoke: "team.invite_revoke",
  inviteAccept: "team.invite_accept",
  roleChange: "team.role_change",
  memberRemove: "team.member_remove",
  ownerTransfer: "team.owner_transfer",
} as const;

// Best-effort mail delivery. Resend is optional — when unset we log the link
// so the owner can copy it manually (dev mode) instead of the invite failing.
export async function sendInviteEmail(params: {
  to: string;
  inviterName: string;
  workspaceName: string;
  url: string;
}): Promise<{ delivered: boolean; via: "resend" | "log" }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "invites@creatoros.local";
  if (!key) {
    // No provider configured — the caller surfaces the URL in the UI.
    console.info(`[invite] ${params.to} → ${params.url}`);
    return { delivered: false, via: "log" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: `${params.inviterName} เชิญคุณเข้าร่วม ${params.workspaceName} บน CreatorOS AI`,
        html: `<p>${escapeHtml(params.inviterName)} เชิญคุณเข้าร่วมเวิร์กสเปซ <b>${escapeHtml(
          params.workspaceName
        )}</b>.</p><p><a href="${params.url}">คลิกเพื่อยอมรับคำเชิญ</a></p><p>ลิงก์นี้จะหมดอายุใน 7 วัน.</p>`,
      }),
    });
    return { delivered: res.ok, via: "resend" };
  } catch {
    return { delivered: false, via: "resend" };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
        ? "&lt;"
        : c === ">"
          ? "&gt;"
          : c === '"'
            ? "&quot;"
            : "&#39;"
  );
}

export interface InviteRow {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

// Fetch an invite by token using the admin client (no auth needed — the token
// IS the secret). Returns null on any state that blocks acceptance so the
// route handler can render a clean error.
export async function fetchLiveInvite(
  admin: SupabaseClient,
  token: string
): Promise<InviteRow | null> {
  const { data } = await admin
    .from("workspace_invitations")
    .select("id, workspace_id, email, role, token, expires_at, accepted_at, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  const row = data as InviteRow;
  if (row.accepted_at || row.revoked_at) return null;
  if (new Date(row.expires_at) <= new Date()) return null;
  return row;
}
