import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// Record an audit-log entry. Called for important writes:
// login, publish, token connect/disconnect, compliance override, role change.
export async function logAudit(
  supabase: SupabaseClient,
  params: {
    workspaceId: string;
    userId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await supabase.from("audit_logs").insert({
      workspace_id: params.workspaceId,
      user_id: params.userId ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? {},
    });
  } catch {
    // Never let audit logging break the primary action.
  }
}
