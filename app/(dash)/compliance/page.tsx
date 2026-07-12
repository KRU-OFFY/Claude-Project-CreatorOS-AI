import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/ui";
import { listComplianceItems } from "@/lib/data";
import { rewriteVariant, approveVariant } from "../actions";
import { canApprove } from "@/lib/roles";
import { getActiveContext } from "@/lib/workspace";
import { platformLabel } from "@/lib/platforms";

type Check = {
  status: string;
  claim_risk_score: number;
  issues: { label: string; message: string }[];
  disclosure_ok: boolean;
  ai_label_ok: boolean;
  human_approved_at: string | null;
};

export default async function CompliancePage() {
  const [items, ctx] = await Promise.all([listComplianceItems(), getActiveContext()]);
  const mayApprove = canApprove(ctx?.role ?? "viewer");

  return (
    <div>
      <PageHeader
        title="Compliance Gate"
        subtitle="ตรวจ disclosure · AI label · ข้อความต้องห้าม · กฎเฉพาะแพลตฟอร์ม — ต้องมีคนอนุมัติก่อนเผยแพร่"
      />

      {items.length === 0 ? (
        <EmptyState>ยังไม่มีคอนเทนต์ที่ต้องตรวจ — สร้างใน Content Studio ก่อน</EmptyState>
      ) : (
        <div className="space-y-3">
          {items.map((v) => {
            const checks = (v.compliance_checks as unknown as Check[]) ?? [];
            const latest = checks[checks.length - 1];
            const issues = latest?.issues ?? [];
            return (
              <Card key={v.id}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{platformLabel(v.platform)}</span>
                    <StatusBadge status={v.status} />
                    {latest && (
                      <span className="text-xs text-foreground/40">
                        ความเสี่ยง: {latest.claim_risk_score}/100
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {(v.status === "fail" || v.status === "needs_review") && (
                      <form action={rewriteVariant}>
                        <input type="hidden" name="variant_id" value={v.id} />
                        <button className="rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:bg-white/5">
                          🤖 AI แก้ให้ผ่าน
                        </button>
                      </form>
                    )}
                    {v.status !== "fail" && v.status !== "approved" && mayApprove && (
                      <form action={approveVariant}>
                        <input type="hidden" name="variant_id" value={v.id} />
                        <button className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white">
                          ✓ อนุมัติ
                        </button>
                      </form>
                    )}
                    {v.status !== "fail" && v.status !== "approved" && !mayApprove && (
                      <span className="text-xs text-foreground/40">
                        ต้องให้ owner/approver อนุมัติ
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-foreground/70">{v.variant_body}</p>
                {issues.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {issues.map((iss, i) => (
                      <li key={i} className="text-xs text-red-600">
                        ⚠ {iss.label}: {iss.message}
                      </li>
                    ))}
                  </ul>
                )}
                {v.status === "fail" && (
                  <p className="mt-2 text-xs font-medium text-red-600">
                    สถานะ fail — ไม่สามารถส่งเข้าคิวเผยแพร่ได้ (บังคับที่ระดับฐานข้อมูล)
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
