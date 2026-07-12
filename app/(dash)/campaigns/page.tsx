import { PageHeader, Card, StatusBadge, EmptyState, Th, Td } from "@/components/ui";
import { listCampaigns, listProducts } from "@/lib/data";
import { createCampaign } from "../actions";
import { PLATFORMS, PLATFORM_KEYS } from "@/lib/platforms";
import { platformLabel } from "@/lib/platforms";

export default async function CampaignsPage() {
  const [campaigns, products] = await Promise.all([listCampaigns(), listProducts()]);
  const eligible = products.filter((p) => (p.score ?? 0) >= 40);

  return (
    <div>
      <PageHeader
        title="Campaign Manager"
        subtitle="ตั้งเป้าหมาย · เลือกสินค้า + แพลตฟอร์มเป้าหมาย"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <h2 className="mb-3 font-semibold">สร้างแคมเปญ</h2>
          <form action={createCampaign} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/60">ชื่อแคมเปญ</label>
              <input
                name="name"
                required
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/60">สินค้า</label>
              <select
                name="product_id"
                className="w-full rounded-lg border border-white/15 bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">— เลือกสินค้า —</option>
                {eligible.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (คะแนน {p.score ?? "—"})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/60">เป้าหมาย</label>
              <select
                name="goal"
                className="w-full rounded-lg border border-white/15 bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="conversion">Conversion (ยอดขาย)</option>
                <option value="awareness">Awareness (การรับรู้)</option>
                <option value="live_commerce">Live Commerce</option>
                <option value="retargeting">Retargeting</option>
              </select>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-foreground/60">แพลตฟอร์มเป้าหมาย</p>
              <div className="grid grid-cols-2 gap-1.5">
                {PLATFORM_KEYS.map((p) => (
                  <label key={p} className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" name={`platform_${p}`} />
                    {PLATFORMS[p].label}
                  </label>
                ))}
              </div>
            </div>
            <button className="w-full rounded-lg bg-gradient-to-r from-brand to-brand-2 px-3 py-2 text-sm font-semibold text-white">
              สร้างแคมเปญ
            </button>
          </form>
          {eligible.length === 0 && (
            <p className="mt-3 text-xs text-amber-600">
              ยังไม่มีสินค้าที่คะแนนถึงเกณฑ์ — เพิ่มสินค้าในหน้า Product ก่อน
            </p>
          )}
        </Card>

        <Card className="md:col-span-2">
          <h2 className="mb-3 font-semibold">แคมเปญ ({campaigns.length})</h2>
          {campaigns.length === 0 ? (
            <EmptyState>ยังไม่มีแคมเปญ</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>ชื่อ</Th>
                    <Th>เป้าหมาย</Th>
                    <Th>แพลตฟอร์ม</Th>
                    <Th>สถานะ</Th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id}>
                      <Td>{c.name}</Td>
                      <Td>{c.goal}</Td>
                      <Td>
                        <span className="text-xs text-foreground/60">
                          {((c.target_platforms as string[]) ?? [])
                            .map(platformLabel)
                            .join(", ") || "—"}
                        </span>
                      </Td>
                      <Td>
                        <StatusBadge status={c.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
