import { PageHeader, Card, StatusBadge, Th, Td } from "@/components/ui";
import { listChannelConnections } from "@/lib/data";
import { getActiveContext } from "@/lib/workspace";
import { PLATFORMS, PLATFORM_KEYS } from "@/lib/platforms";
import { getAdapter } from "@/lib/adapters";

export default async function SettingsPage() {
  const [connections, ctx] = await Promise.all([
    listChannelConnections(),
    getActiveContext(),
  ]);

  const byPlatform = new Map(connections.map((c) => [c.platform, c]));

  return (
    <div>
      <PageHeader
        title="ตั้งค่า"
        subtitle="เชื่อมบัญชีแพลตฟอร์ม · บทบาทผู้ใช้ · การตั้งค่าเวิร์กสเปซ"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">เวิร์กสเปซ</h2>
          <dl className="space-y-1.5 text-sm">
            <Row label="ชื่อ" value={ctx?.workspaceName || "—"} />
            <Row label="อีเมล" value={ctx?.email || "—"} />
            <Row label="บทบาทของคุณ" value={ctx?.role || "—"} />
          </dl>
          <div className="mt-4 rounded-lg bg-black/5 p-3 text-xs text-black/60">
            บทบาท: owner (จัดการทั้งหมด) · editor (สร้าง/แก้) · approver (อนุมัติ compliance) ·
            viewer (ดูอย่างเดียว)
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">การเชื่อมต่อแพลตฟอร์ม</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>แพลตฟอร์ม</Th>
                  <Th>สถานะ</Th>
                  <Th>API</Th>
                </tr>
              </thead>
              <tbody>
                {PLATFORM_KEYS.map((p) => {
                  const conn = byPlatform.get(p);
                  const adapter = getAdapter(p);
                  return (
                    <tr key={p}>
                      <Td>{PLATFORMS[p].label}</Td>
                      <Td>
                        <StatusBadge status={conn?.status ?? "disconnected"} />
                      </Td>
                      <Td>
                        <span className="text-xs text-black/50">
                          {adapter.isConfigured() ? "พร้อมใช้" : "ยังไม่ตั้งค่า"}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-black/40">
            การเชื่อมบัญชีจริงต้องใช้ OAuth ของแต่ละแพลตฟอร์ม — token จะถูกเข้ารหัสและเก็บฝั่ง
            server เท่านั้น (ไม่ส่งกลับ client)
          </p>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-black/50">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
