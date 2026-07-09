import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface ActiveContext {
  userId: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
  role: string;
}

// Resolve the logged-in user's active workspace + role (first membership).
// Returns null when not configured or not authenticated.
export async function getActiveContext(): Promise<ActiveContext | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return {
      userId: user.id,
      email: user.email ?? "",
      workspaceId: "",
      workspaceName: "",
      role: "viewer",
    };
  }

  const ws = membership.workspaces as unknown as { name: string } | null;
  return {
    userId: user.id,
    email: user.email ?? "",
    workspaceId: membership.workspace_id as string,
    workspaceName: ws?.name ?? "",
    role: (membership.role as string) ?? "viewer",
  };
}
