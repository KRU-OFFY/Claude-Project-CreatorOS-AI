import { PageHeader, Card, Th, Td, EmptyState } from "@/components/ui";
import { listWorkspaceMembers, listPendingInvitations } from "@/lib/data";
import { getActiveContext } from "@/lib/workspace";
import { INVITABLE_ROLES } from "@/lib/team";
import {
  inviteMember,
  revokeInvite,
  changeMemberRole,
  removeMember,
  transferOwnership,
} from "../../actions";

type MemberRow = {
  id: string;
  user_id: string;
  role: string;
  // Supabase types nested singletons as arrays — normalize at read time.
  profiles:
    | { email: string; full_name: string | null }
    | { email: string; full_name: string | null }[]
    | null;
};

function memberEmail(m: MemberRow): string {
  const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
  return p?.email ?? "—";
}

type InviteRow = {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const [members, invites, ctx, sp] = await Promise.all([
    listWorkspaceMembers(),
    listPendingInvitations(),
    getActiveContext(),
    searchParams,
  ]);
  const isOwner = ctx?.role === "owner";

  return (
    <div>
      <PageHeader
        title="ทีมและสมาชิก"
        subtitle="เชิญสมาชิก · เปลี่ยนบทบาท · โอนความเป็นเจ้าของเวิร์กสเปซ"
      />

      {sp.ok && (
        <div className="mb-4 rounded-lg bg-green-100 px-4 py-2 text-sm text-green-700">
          บันทึกเรียบร้อย
        </div>
      )}

      {isOwner && (
        <Card className="mb-4">
          <h2 className="mb-3 font-semibold">เชิญสมาชิกใหม่</h2>
          <form action={inviteMember} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="mb-1 block text-xs text-black/60">อีเมล</label>
              <input
                name="email"
                type="email"
                required
                placeholder="teammate@example.com"
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-black/60">บทบาท</label>
              <select
                name="role"
                defaultValue="editor"
                className="rounded-lg border border-black/15 px-3 py-2 text-sm"
              >
                {INVITABLE_ROLES.filter((r) => r !== "owner").map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <button className="rounded-lg bg-gradient-to-r from-brand to-brand-2 px-4 py-2 text-sm font-semibold text-white">
              ส่งคำเชิญ
            </button>
          </form>
          <p className="mt-2 text-xs text-black/40">
            ลิงก์คำเชิญจะหมดอายุใน 7 วัน · หาก RESEND_API_KEY ยังไม่ตั้งค่า
            ลิงก์จะปรากฏใน server log
          </p>
        </Card>
      )}

      <Card className="mb-4">
        <h2 className="mb-3 font-semibold">
          สมาชิก ({members.length}
          {members.length > 0 ? " คน" : ""})
        </h2>
        {members.length === 0 ? (
          <EmptyState>ยังไม่มีสมาชิก</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>อีเมล</Th>
                  <Th>บทบาท</Th>
                  <Th>การจัดการ</Th>
                </tr>
              </thead>
              <tbody>
                {(members as unknown as MemberRow[]).map((m) => {
                  const isSelf = ctx?.userId === m.user_id;
                  return (
                    <tr key={m.id}>
                      <Td>
                        <div className="text-sm">
                          {memberEmail(m)}
                          {isSelf && (
                            <span className="ml-2 text-xs text-black/40">(คุณ)</span>
                          )}
                        </div>
                      </Td>
                      <Td>
                        {isOwner && !isSelf && m.role !== "owner" ? (
                          <form action={changeMemberRole} className="flex gap-2">
                            <input type="hidden" name="member_id" value={m.id} />
                            <select
                              name="role"
                              defaultValue={m.role}
                              className="rounded border border-black/15 px-2 py-1 text-xs"
                            >
                              {INVITABLE_ROLES.filter((r) => r !== "owner").map(
                                (r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                )
                              )}
                            </select>
                            <button className="rounded border border-black/15 px-2 py-1 text-xs hover:bg-black/5">
                              บันทึก
                            </button>
                          </form>
                        ) : (
                          <span className="text-xs">{m.role}</span>
                        )}
                      </Td>
                      <Td>
                        {isOwner && !isSelf && m.role !== "owner" && (
                          <div className="flex flex-wrap gap-2">
                            <form action={transferOwnership}>
                              <input type="hidden" name="member_id" value={m.id} />
                              <button className="rounded border border-black/15 px-2 py-1 text-xs hover:bg-black/5">
                                โอนความเป็นเจ้าของ
                              </button>
                            </form>
                            <form action={removeMember}>
                              <input type="hidden" name="member_id" value={m.id} />
                              <button className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                                ลบสมาชิก
                              </button>
                            </form>
                          </div>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">คำเชิญที่รอตอบรับ ({invites.length})</h2>
        {invites.length === 0 ? (
          <EmptyState>ไม่มีคำเชิญที่รอตอบรับ</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>อีเมล</Th>
                  <Th>บทบาท</Th>
                  <Th>หมดอายุ</Th>
                  <Th>ลิงก์</Th>
                  <Th> </Th>
                </tr>
              </thead>
              <tbody>
                {(invites as InviteRow[]).map((inv) => (
                  <tr key={inv.id}>
                    <Td>
                      <span className="text-sm">{inv.email}</span>
                    </Td>
                    <Td>
                      <span className="text-xs">{inv.role}</span>
                    </Td>
                    <Td>
                      <span className="text-xs text-black/50">
                        {new Date(inv.expires_at).toLocaleDateString("th-TH")}
                      </span>
                    </Td>
                    <Td>
                      <a
                        href={`/invite/${encodeURIComponent(inv.token)}`}
                        className="text-xs text-brand underline"
                      >
                        เปิดลิงก์คำเชิญ
                      </a>
                    </Td>
                    <Td>
                      {isOwner && (
                        <form action={revokeInvite}>
                          <input type="hidden" name="invite_id" value={inv.id} />
                          <button className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                            ยกเลิก
                          </button>
                        </form>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
