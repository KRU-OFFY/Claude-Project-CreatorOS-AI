import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/workspace";

// Thin server-side query helpers scoped to the active workspace. Every helper
// returns a safe empty value when Supabase is unconfigured or there is no
// workspace, so pages render without crashing in demo mode.

async function scoped() {
  const supabase = await createClient();
  const ctx = await getActiveContext();
  if (!supabase || !ctx?.workspaceId) return null;
  return { supabase, ws: ctx.workspaceId, ctx };
}

export async function listProducts() {
  const s = await scoped();
  if (!s) return [];
  const { data } = await s.supabase
    .from("products")
    .select("id, name, source_platform, price, commission_rate, score, tier, created_at")
    .eq("workspace_id", s.ws)
    .order("score", { ascending: false });
  return data ?? [];
}

export async function listCampaigns() {
  const s = await scoped();
  if (!s) return [];
  const { data } = await s.supabase
    .from("campaigns")
    .select("id, name, goal, status, target_platforms, target_revenue, created_at, products(name)")
    .eq("workspace_id", s.ws)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function listContentVariants() {
  const s = await scoped();
  if (!s) return [];
  const { data } = await s.supabase
    .from("content_variants")
    .select("id, platform, variant_body, hashtags, cta, status, created_at, content_items(title)")
    .eq("workspace_id", s.ws)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function listApprovedVariants() {
  const s = await scoped();
  if (!s) return [];
  const { data } = await s.supabase
    .from("content_variants")
    .select("id, platform, variant_body, status")
    .eq("workspace_id", s.ws)
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function listPublishJobs() {
  const s = await scoped();
  if (!s) return [];
  const { data } = await s.supabase
    .from("publish_queue")
    .select("id, platform, status, scheduled_at, retry_count, error_message, published_url, published_at, created_at")
    .eq("workspace_id", s.ws)
    .order("scheduled_at", { ascending: true, nullsFirst: false });
  return data ?? [];
}

export async function listAnalytics() {
  const s = await scoped();
  if (!s) return [];
  const { data } = await s.supabase
    .from("analytics_metrics")
    .select("platform, views, reach, engagement, clicks, orders, revenue, commission, roi, metric_date")
    .eq("workspace_id", s.ws)
    .order("metric_date", { ascending: false })
    .limit(500);
  return data ?? [];
}

export async function listComplianceItems() {
  const s = await scoped();
  if (!s) return [];
  const { data } = await s.supabase
    .from("content_variants")
    .select(
      "id, platform, variant_body, status, compliance_checks(status, claim_risk_score, issues, disclosure_ok, ai_label_ok, human_approved_at, checked_at)"
    )
    .eq("workspace_id", s.ws)
    .in("status", ["pending_compliance", "needs_review", "fail", "pass", "approved"])
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getSettings() {
  const s = await scoped();
  if (!s) return null;
  const { data } = await s.supabase
    .from("settings")
    .select("data")
    .eq("workspace_id", s.ws)
    .maybeSingle();
  return (data?.data as Record<string, unknown>) ?? {};
}

export async function listChannelConnections() {
  const s = await scoped();
  if (!s) return [];
  const { data } = await s.supabase
    .from("channel_connections")
    .select("id, platform, account_name, status, expires_at")
    .eq("workspace_id", s.ws);
  return data ?? [];
}

export async function listAuditLogs() {
  const s = await scoped();
  if (!s) return [];
  const { data } = await s.supabase
    .from("audit_logs")
    .select("action, entity_type, created_at")
    .eq("workspace_id", s.ws)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

// Team members with profile info (Team page).
export async function listWorkspaceMembers() {
  const s = await scoped();
  if (!s) return [];
  const { data } = await s.supabase
    .from("workspace_members")
    .select("id, user_id, role, created_at, profiles(email, full_name)")
    .eq("workspace_id", s.ws)
    .order("created_at", { ascending: true });
  return data ?? [];
}

// Pending (not accepted / not revoked / not expired) invites for the Team page.
export async function listPendingInvitations() {
  const s = await scoped();
  if (!s) return [];
  const nowIso = new Date().toISOString();
  const { data } = await s.supabase
    .from("workspace_invitations")
    .select("id, email, role, token, expires_at, created_at")
    .eq("workspace_id", s.ws)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false });
  return data ?? [];
}
