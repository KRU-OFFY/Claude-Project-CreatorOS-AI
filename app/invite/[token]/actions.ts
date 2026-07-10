"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import {
  fetchLiveInvite,
  normalizeEmail,
  TEAM_ACTIONS,
} from "@/lib/team";

// Accept an invite. Guarantees:
// - The caller is signed in AND the signed-in email matches the invite's email
//   (a forwarded link cannot be redeemed by someone else).
// - The invite is atomically marked `accepted_at` — a second click is a no-op.
// - The workspace_members row is upserted (already-a-member is harmless).
export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/login");

  const supabase = await createClient();
  if (!supabase) redirect("/setup");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/invite/${encodeURIComponent(token)}`);

  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase admin client ยังไม่ตั้งค่า");

  const invite = await fetchLiveInvite(admin, token);
  if (!invite) throw new Error("คำเชิญนี้ใช้งานไม่ได้");
  if (normalizeEmail(user.email ?? "") !== normalizeEmail(invite.email)) {
    throw new Error("อีเมลที่เข้าสู่ระบบไม่ตรงกับคำเชิญ");
  }

  // Two writes need to land as one transaction: mark the invite consumed AND
  // upsert the membership. A half-applied accept would lock the invitee out
  // because the invite is marked accepted but they aren't a member.
  // Migration 0016 wraps them in a Postgres function.
  const { error: rpcError } = await admin.rpc("accept_workspace_invite", {
    p_invite_id: invite.id,
    p_user_id: user.id,
  });
  if (rpcError) {
    // Someone else already claimed it (race) → send to dashboard silently.
    // Any other error (constraint / connection) surfaces so the user sees it.
    if (rpcError.message.includes("not accepting new members")) {
      redirect("/dashboard");
    }
    throw new Error(rpcError.message);
  }

  await logAudit(admin, {
    workspaceId: invite.workspace_id,
    userId: user.id,
    action: TEAM_ACTIONS.inviteAccept,
    entityType: "workspace_invitations",
    entityId: invite.id,
    metadata: { role: invite.role },
  });

  // Set the newly-joined workspace as active so the dashboard shows it.
  const { cookies } = await import("next/headers");
  const c = await cookies();
  c.set("active_workspace_id", invite.workspace_id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/dashboard");
}
