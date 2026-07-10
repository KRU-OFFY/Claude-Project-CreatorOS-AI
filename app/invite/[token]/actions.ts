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

  // Atomic claim: only the first click flips accepted_at → null becomes now().
  // .select() returns the row only if the update actually matched, so a
  // concurrent second click sees zero rows and short-circuits.
  const { data: claimed } = await admin
    .from("workspace_invitations")
    .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq("id", invite.id)
    .is("accepted_at", null)
    .select("id");
  if (!claimed || claimed.length === 0) redirect("/dashboard");

  // Upsert the membership. If the user is already a member (e.g. re-invited
  // to change role) we bump their role to the invite's role.
  await admin
    .from("workspace_members")
    .upsert(
      {
        workspace_id: invite.workspace_id,
        user_id: user.id,
        role: invite.role,
      },
      { onConflict: "workspace_id,user_id" }
    );

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
