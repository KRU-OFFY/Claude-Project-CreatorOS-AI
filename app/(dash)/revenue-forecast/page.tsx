import { PageHeader, Card, StatTile } from "@/components/ui";
import { listAnalytics, getSettings } from "@/lib/data";

export default async function RevenueForecastPage() {
  const [rows, settings] = await Promise.all([listAnalytics(), getSettings()]);
  const target = Number((settings?.monthly_revenue_target as number) ?? 30000);

  // Sum revenue in the last 30 days and project a simple run-rate.
  const now = Date.now();
  const last30 = rows.filter(
    (r) => now - new Date(r.metric_date as string).getTime() <= 30 * 864e5
  );
  const revenue30 = last30.reduce((a, r) => a + Number(r.revenue), 0);
  const commission30 = last30.reduce((a, r) => a + Number(r.commission), 0);

  const dayCount = Math.max(1, new Date().getDate());
  const dailyRate = revenue30 / dayCount;
  const projectedMonth = Math.round(dailyRate * 30);
  const gap = target - projectedMonth;
  const pct = target > 0 ? Math.min(100, Math.round((projectedMonth / target) * 100)) : 0;

  return (
    <div>
      <PageHeader
        title="Revenue Forecast"
        subtitle="คาดการณ์รายได้จาก run-rate และช่องว่างจากเป้าหมาย"
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="รายได้ 30 วัน" value={`฿${revenue30.toLocaleString()}`} />
        <StatTile label="คอมมิชชั่น 30 วัน" value={`฿${commission30.toLocaleString()}`} />
        <StatTile label="คาดการณ์ทั้งเดือน" value={`฿${projectedMonth.toLocaleString()}`} />
        <StatTile label="เป้าหมาย/เดือน" value={`฿${target.toLocaleString()}`} />
      </div>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">ความคืบหน้าสู่เป้าหมาย</h2>
          <span className="text-sm font-semibold text-brand">{pct}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-black/70">
          {gap > 0 ? (
            <>
              ยังต้องเพิ่มอีก{" "}
              <span className="font-semibold text-red-600">฿{gap.toLocaleString()}</span>{" "}
              เพื่อถึงเป้าหมายเดือนนี้
            </>
          ) : (
            <span className="font-semibold text-green-600">คาดว่าจะถึงเป้าหมายแล้ว 🎉</span>
          )}
        </p>
        <p className="mt-2 text-xs text-black/40">
          ประมาณการเบื้องต้นจาก run-rate เชิงเส้น — ดูคำแนะนำเพิ่มเติมได้ที่ AI Advisor
        </p>
      </Card>
    </div>
  );
}
