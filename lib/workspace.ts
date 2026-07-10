import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export interface ActiveContext {
  userId: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
  role: string;
}

export interface Membership {
  workspaceId: string;
  workspaceName: string;
  role: string;
}

const ACTIVE_WS_COOKIE = "active_workspace_id";

// Resolve the logged-in user's active workspace + role. Prefers the cookie
// set by switchWorkspace; falls back to the first membership if the cookie is
// missing or points to a workspace the user is no longer a member of.
export async function getActiveContext(): Promise<ActiveContext | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(name)")
    .eq("user_id", user.id);

  // Supabase types nested selects as arrays even for foreign-key singletons;
  // narrow to the shape we actually receive at runtime.
  const rows = (memberships ?? []) as unknown as Array<{
    workspace_id: string;
    role: string;
    workspaces: { name: string } | { name: string }[] | null;
  }>;

  if (rows.length === 0) {
    return {
      userId: user.id,
      email: user.email ?? "",
      workspaceId: "",
      workspaceName: "",
      role: "viewer",
    };
  }

  const c = await cookies();
  const preferred = c.get(ACTIVE_WS_COOKIE)?.value;
  const active = rows.find((m) => m.workspace_id === preferred) ?? rows[0];
  const ws = Array.isArray(active.workspaces) ? active.workspaces[0] : active.workspaces;

  return {
    userId: user.id,
    email: user.email ?? "",
    workspaceId: active.workspace_id,
    workspaceName: ws?.name ?? "",
    role: active.role ?? "viewer",
  };
}

// All workspaces the current user belongs to (for the sidebar switcher).
export async function listMemberships(): Promise<Membership[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(name)")
    .eq("user_id", user.id);
  const rows = (data ?? []) as unknown as Array<{
    workspace_id: string;
    role: string;
    workspaces: { name: string } | { name: string }[] | null;
  }>;
  return rows.map((m) => {
    const ws = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces;
    return {
      workspaceId: m.workspace_id,
      workspaceName: ws?.name ?? "",
      role: m.role,
    };
  });
}
