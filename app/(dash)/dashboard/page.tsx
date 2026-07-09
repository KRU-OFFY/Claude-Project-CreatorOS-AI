import Link from "next/link";
import { PageHeader, Card, StatTile, EmptyState, StatusBadge } from "@/components/ui";
import { aggregate } from "@/lib/analytics/normalize";
import {
  listProducts,
  listContentVariants,
  listPublishJobs,
  listAnalytics,
  listAuditLogs,
} from "@/lib/data";
import { aiMode } from "@/lib/ai";

export default async function DashboardPage() {
  const [products, variants, jobs, analytics, audits] = await Promise.all([
    listProducts(),
    listContentVariants(),
    listPublishJobs(),
    listAnalytics(),
    listAuditLogs(),
  ]);

  const { totals } = aggregate(
    analytics.map((a) => ({
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

  const pendingCompliance = variants.filter(
    (v) => v.status === "pending_compliance" || v.status === "needs_review"
  ).length;
  const queued = jobs.filter((j) => j.status === "queued" || j.status === "draft").length;
  const failed = jobs.filter((j) => j.status === "failed").length;

  return (
    <div>
      <PageHeader
        title="Command Center"
        subtitle="ภาพรวมระบบ · งานที่ต้องทำ · คำแนะนำจาก AI"
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="รายได้รวม (บาท)" value={totals.revenue.toLocaleString()} />
        <StatTile label="คอมมิชชั่น (บาท)" value={totals.commission.toLocaleString()} />
        <StatTile label="คลิกรวม" value={totals.clicks.toLocaleString()} />
        <StatTile label="สินค้าในระบบ" value={products.length} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">งานที่ต้องทำ</h2>
          <ul className="space-y-2 text-sm">
            <TaskRow
              label="คอนเทนต์รอตรวจ Compliance"
              count={pendingCompliance}
              href="/compliance"
            />
            <TaskRow label="งานรอเผยแพร่ในคิว" count={queued} href="/publish-center" />
            <TaskRow label="งานเผยแพร่ล้มเหลว (ต้อง retry)" count={failed} href="/publish-center" />
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">เริ่มเวิร์กโฟลว์</h2>
          <p className="mb-3 text-sm text-black/60">
            สินค้า → แคมเปญ → คอนเทนต์ → Compliance → เผยแพร่ → วิเคราะห์ผล
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/products"
              className="rounded-lg bg-gradient-to-r from-brand to-brand-2 px-4 py-2 text-sm font-semibold text-white"
            >
              เริ่มที่ค้นหาสินค้า
            </Link>
            <Link
              href="/ai-advisor"
              className="rounded-lg border border-black/10 px-4 py-2 text-sm"
            >
              ดูคำแนะนำ AI
            </Link>
          </div>
          <p className="mt-3 text-xs text-black/40">
            โหมด AI: {aiMode() === "anthropic" ? "Anthropic (Claude)" : "Rule-based (demo)"}
          </p>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <h2 className="mb-3 font-semibold">กิจกรรมล่าสุด (Audit)</h2>
          {audits.length === 0 ? (
            <EmptyState>ยังไม่มีกิจกรรม</EmptyState>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {audits.map((a, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span>
                    <StatusBadge status={a.action.split(".")[0]} />{" "}
                    <span className="text-black/70">{a.action}</span>
                  </span>
                  <span className="text-xs text-black/40">
                    {new Date(a.created_at as string).toLocaleString("th-TH")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function TaskRow({ label, count, href }: { label: string; count: number; href: string }) {
  return (
    <li className="flex items-center justify-between">
      <Link href={href} className="text-black/70 hover:text-brand">
        {label}
      </Link>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
          count > 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
        }`}
      >
        {count}
      </span>
    </li>
  );
}
