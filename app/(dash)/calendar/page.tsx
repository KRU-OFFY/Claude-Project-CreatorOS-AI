import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/ui";
import { listPublishJobs } from "@/lib/data";
import { platformLabel } from "@/lib/platforms";

// Unified calendar — groups queued/scheduled/published/failed jobs by date.
export default async function CalendarPage() {
  const jobs = await listPublishJobs();

  const byDate = new Map<string, typeof jobs>();
  for (const j of jobs) {
    const d = j.scheduled_at
      ? new Date(j.scheduled_at as string).toLocaleDateString("th-TH")
      : "ยังไม่กำหนดเวลา";
    byDate.set(d, [...(byDate.get(d) ?? []), j]);
  }
  const dates = Array.from(byDate.keys());

  const counts = {
    draft: jobs.filter((j) => j.status === "draft").length,
    queued: jobs.filter((j) => j.status === "queued").length,
    published: jobs.filter((j) => j.status === "published").length,
    failed: jobs.filter((j) => j.status === "failed" || j.status === "retry").length,
  };

  return (
    <div>
      <PageHeader
        title="Unified Calendar"
        subtitle="ปฏิทินเดียวรวม draft · scheduled · published · failed · retry"
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Legend label="ร่าง" value={counts.draft} color="bg-gray-100 text-gray-600" />
        <Legend label="ในคิว/กำหนดเวลา" value={counts.queued} color="bg-blue-100 text-blue-700" />
        <Legend label="เผยแพร่แล้ว" value={counts.published} color="bg-green-100 text-green-700" />
        <Legend label="ล้มเหลว/retry" value={counts.failed} color="bg-red-100 text-red-700" />
      </div>

      {dates.length === 0 ? (
        <EmptyState>ยังไม่มีงานในปฏิทิน — จัดคิวจากศูนย์เผยแพร่</EmptyState>
      ) : (
        <div className="space-y-3">
          {dates.map((d) => (
            <Card key={d}>
              <h3 className="mb-2 text-sm font-semibold text-black/70">{d}</h3>
              <div className="space-y-1.5">
                {byDate.get(d)!.map((j) => (
                  <div
                    key={j.id}
                    className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2 text-sm"
                  >
                    <span>{platformLabel(j.platform)}</span>
                    <div className="flex items-center gap-2">
                      {j.scheduled_at && (
                        <span className="text-xs text-black/40">
                          {new Date(j.scheduled_at as string).toLocaleTimeString("th-TH", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                      <StatusBadge status={j.status} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Legend({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-3">
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
        {label}
      </span>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
