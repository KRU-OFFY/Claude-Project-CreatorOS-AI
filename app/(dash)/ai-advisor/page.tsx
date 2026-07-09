import { PageHeader, Card, EmptyState } from "@/components/ui";
import { listAnalytics, listProducts } from "@/lib/data";
import { aggregate } from "@/lib/analytics/normalize";
import { adviseNextCycle, aiMode } from "@/lib/ai";

const priorityColor: Record<string, string> = {
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-gray-300",
};

export default async function AiAdvisorPage() {
  const [rows, products] = await Promise.all([listAnalytics(), listProducts()]);
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
  });

  return (
    <div>
      <PageHeader
        title="AI Optimization Loop"
        subtitle="AI วิเคราะห์ผลรอบที่ผ่านมา แล้วแนะนำสินค้า/เวลาโพสต์/รูปแบบคอนเทนต์/แพลตฟอร์มรอบถัดไป"
      />

      <p className="mb-3 text-xs text-black/40">
        โหมด AI: {aiMode() === "anthropic" ? "Anthropic (Claude)" : "Rule-based (demo)"}
      </p>

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
