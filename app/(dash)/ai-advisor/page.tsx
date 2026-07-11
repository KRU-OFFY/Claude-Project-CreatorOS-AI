import { PageHeader, Card, EmptyState } from "@/components/ui";
import { listAnalytics, listAnalyticsWindow, listProducts } from "@/lib/data";
import { aggregate } from "@/lib/analytics/normalize";
import {
  summarize,
  linearForecast,
  dailyTotals,
  todayInBangkok,
} from "@/lib/analytics/trends";
import { adviseNextCycle, aiMode } from "@/lib/ai";
import { getActiveContext } from "@/lib/workspace";
import { getIntegrationConfig } from "@/lib/settings";

const priorityColor: Record<string, string> = {
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-gray-300",
};

const TREND_WINDOW = 14;
const FORECAST_HORIZON = 7;

export default async function AiAdvisorPage() {
  const [rows, products, windowRows] = await Promise.all([
    listAnalytics(),
    listProducts(),
    listAnalyticsWindow(TREND_WINDOW),
  ]);
  const { totals, byPlatform } = aggregate(
    rows.map((a) => ({
      platform: a.platform,
      views: Number(a.views),
      reach: Number(a.reach),
      engagement: Number(a.engagement),
      clicks: Number(a.clicks),
      orders: Number(a.orders),
      revenue: Number(a.revenue),
      commission: Number(a.commission),
    }))
  );

  const trendRows = windowRows.map((r) => ({
    platform: r.platform,
    metric_date: r.metric_date,
    views: Number(r.views),
    reach: Number(r.reach),
    engagement: Number(r.engagement),
    clicks: Number(r.clicks),
    orders: Number(r.orders),
    revenue: Number(r.revenue),
    commission: Number(r.commission),
  }));
  // Anchor summarize + forecast to the same Bangkok "today" so tiles and
  // the forecast table agree on where the window ends.
  const todayIso = todayInBangkok();
  const trends = summarize(trendRows, TREND_WINDOW, todayIso);
  const forecast = linearForecast(
    dailyTotals(trendRows, TREND_WINDOW, todayIso),
    FORECAST_HORIZON,
    "revenue"
  );

  const ctx = await getActiveContext();
  const aiCfg = ctx?.workspaceId ? (await getIntegrationConfig(ctx.workspaceId)).ai : null;
  const recommendations = await adviseNextCycle({
    totals: { revenue: totals.revenue, clicks: totals.clicks, orders: totals.orders },
    byPlatform: byPlatform.map((p) => ({
      platform: p.platform,
      views: p.views,
      clicks: p.clicks,
      revenue: p.revenue,
      commission: p.commission,
    })),
    topProducts: products.slice(0, 5).map((p) => ({ name: p.name, revenue: p.score ?? 0 })),
    trends,
  }, aiCfg);

  return (
    <div>
      <PageHeader
        title="AI Optimization Loop"
        subtitle="AI วิเคราะห์ผลรอบที่ผ่านมา แล้วแนะนำสินค้า/เวลาโพสต์/รูปแบบคอนเทนต์/แพลตฟอร์มรอบถัดไป"
      />

      <p className="mb-3 text-xs text-black/40">
        โหมด AI: {aiMode(aiCfg) === "anthropic" ? "Anthropic (Claude)" : "Rule-based (demo)"}
        {" · "}วิเคราะห์จากข้อมูล {TREND_WINDOW} วันล่าสุด
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label={`รายได้ ${TREND_WINDOW} วัน`}
          value={`฿${trends.revenue14d.toLocaleString()}`}
          delta={trends.revenueTrendPct}
        />
        <Stat
          label={`คลิก ${TREND_WINDOW} วัน`}
          value={trends.clicks14d.toLocaleString()}
          delta={trends.clicksTrendPct}
        />
        <Stat
          label="แพลตฟอร์มหลัก"
          value={trends.topPlatform ?? "—"}
          hint={trends.topPlatform ? `${trends.topPlatformShare}% ของรายได้` : undefined}
        />
        <Stat
          label={`คาดการณ์ ${FORECAST_HORIZON} วันหน้า`}
          value={`฿${trends.forecast7dRevenue.toLocaleString()}`}
          hint={trends.hasSignal ? "เชื่อถือได้" : "ข้อมูลน้อย — คาดการณ์คร่าวๆ"}
        />
      </div>

      {forecast.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-2 font-semibold text-sm">คาดการณ์รายได้ราย 7 วัน</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-black/50">
                  <th className="pb-1">วันที่</th>
                  <th className="pb-1">คาดการณ์ (฿)</th>
                  <th className="pb-1">ช่วงล่าง</th>
                  <th className="pb-1">ช่วงบน</th>
                </tr>
              </thead>
              <tbody>
                {forecast.map((f) => (
                  <tr key={f.date} className="border-t border-black/5">
                    <td className="py-1">{f.date}</td>
                    <td className="py-1 font-medium">{f.revenue.toLocaleString()}</td>
                    <td className="py-1 text-black/50">{f.lower.toLocaleString()}</td>
                    <td className="py-1 text-black/50">{f.upper.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-black/40">
            คาดการณ์ด้วย OLS linear regression + ±1σ band บนข้อมูล {TREND_WINDOW} วันล่าสุด
          </p>
        </Card>
      )}

      {recommendations.length === 0 ? (
        <EmptyState>ยังไม่มีคำแนะนำ</EmptyState>
      ) : (
        <div className="space-y-3">
          {recommendations.map((r, i) => (
            <Card key={i} className={`border-l-4 ${priorityColor[r.priority] ?? ""}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{r.topic}</span>
                <span className="text-xs uppercase text-black/40">{r.priority}</span>
              </div>
              <p className="mt-1 text-sm text-black/70">{r.recommendation}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
}) {
  const deltaColor =
    delta === undefined
      ? ""
      : delta > 0
        ? "text-green-600"
        : delta < 0
          ? "text-red-600"
          : "text-black/40";
  return (
    <Card>
      <p className="text-[11px] text-black/50">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {delta !== undefined && (
        <p className={`text-xs ${deltaColor}`}>
          {delta > 0 ? "+" : ""}
          {delta}% เทียบครึ่งแรก
        </p>
      )}
      {hint && <p className="text-[11px] text-black/40">{hint}</p>}
    </Card>
  );
}
