import { PageHeader, Card, StatTile, EmptyState, Th, Td } from "@/components/ui";
import { listAnalytics } from "@/lib/data";
import { aggregate } from "@/lib/analytics/normalize";
import { recordMetrics } from "../actions";
import { PLATFORMS, PLATFORM_KEYS, platformLabel } from "@/lib/platforms";

export default async function AnalyticsPage() {
  const rows = await listAnalytics();
  const mapped = rows.map((a) => ({
    platform: a.platform,
    views: Number(a.views),
    reach: Number(a.reach),
    engagement: Number(a.engagement),
    clicks: Number(a.clicks),
    orders: Number(a.orders),
    revenue: Number(a.revenue),
    commission: Number(a.commission),
  }));
  const { totals, byPlatform } = aggregate(mapped);

  return (
    <div>
      <PageHeader
        title="Analytics Center"
        subtitle="รวมข้อมูลทุกแพลตฟอร์ม: views · reach · engagement · clicks · orders · revenue · commission · ROI"
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Views" value={totals.views.toLocaleString()} />
        <StatTile label="Clicks" value={totals.clicks.toLocaleString()} />
        <StatTile label="Orders" value={totals.orders.toLocaleString()} />
        <StatTile label="รายได้ (บาท)" value={totals.revenue.toLocaleString()} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <h2 className="mb-3 font-semibold">แยกตามแพลตฟอร์ม</h2>
          {byPlatform.length === 0 ? (
            <EmptyState>ยังไม่มีข้อมูล — บันทึกเมตริกทางขวา (หรือรอ connector ดึงจริง)</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>แพลตฟอร์ม</Th>
                    <Th>Views</Th>
                    <Th>Clicks</Th>
                    <Th>Orders</Th>
                    <Th>รายได้</Th>
                    <Th>คอม</Th>
                  </tr>
                </thead>
                <tbody>
                  {byPlatform.map((p) => (
                    <tr key={p.platform}>
                      <Td>{platformLabel(p.platform)}</Td>
                      <Td>{p.views.toLocaleString()}</Td>
                      <Td>{p.clicks.toLocaleString()}</Td>
                      <Td>{p.orders.toLocaleString()}</Td>
                      <Td>{p.revenue.toLocaleString()}</Td>
                      <Td>{p.commission.toLocaleString()}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">บันทึกเมตริก (manual)</h2>
          <form action={recordMetrics} className="space-y-2">
            <select
              name="platform"
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
            >
              {PLATFORM_KEYS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORMS[p].label}
                </option>
              ))}
            </select>
            {[
              ["views", "Views"],
              ["clicks", "Clicks"],
              ["orders", "Orders"],
              ["revenue", "รายได้"],
              ["commission", "คอมมิชชั่น"],
            ].map(([n, l]) => (
              <input
                key={n}
                name={n}
                type="number"
                step="any"
                placeholder={l}
                className="w-full rounded-lg border border-black/15 px-3 py-1.5 text-sm"
              />
            ))}
            <button className="w-full rounded-lg bg-gradient-to-r from-brand to-brand-2 px-3 py-2 text-sm font-semibold text-white">
              บันทึก
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
