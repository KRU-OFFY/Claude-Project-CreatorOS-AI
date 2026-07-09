import { PageHeader, Card, StatusBadge, EmptyState, Th, Td } from "@/components/ui";
import { listApprovedVariants, listPublishJobs } from "@/lib/data";
import { enqueueVariant, markPublished, retryJob, publishNow } from "../actions";
import { getAdapter } from "@/lib/adapters";
import { platformLabel, type PlatformKey } from "@/lib/platforms";

export default async function PublishCenterPage() {
  const [approved, jobs] = await Promise.all([
    listApprovedVariants(),
    listPublishJobs(),
  ]);

  return (
    <div>
      <PageHeader
        title="Omnichannel Publishing Hub"
        subtitle="เลือกช่องทาง · จัดคิว · retry/error · โหมด copy-to-post เมื่อยังไม่เชื่อม API"
      />

      <div className="mb-4">
        <Card>
          <h2 className="mb-3 font-semibold">พร้อมเผยแพร่ (อนุมัติแล้ว)</h2>
          {approved.length === 0 ? (
            <EmptyState>ยังไม่มีคอนเทนต์ที่อนุมัติ — อนุมัติในหน้า Compliance ก่อน</EmptyState>
          ) : (
            <div className="space-y-2">
              {approved.map((v) => {
                const adapter = getAdapter(v.platform as PlatformKey);
                return (
                  <div
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/10 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{platformLabel(v.platform)}</p>
                      <p className="truncate text-xs text-black/50">{v.variant_body}</p>
                    </div>
                    <form action={enqueueVariant} className="flex items-center gap-2">
                      <input type="hidden" name="variant_id" value={v.id} />
                      <input
                        type="datetime-local"
                        name="scheduled_at"
                        className="rounded-lg border border-black/15 px-2 py-1 text-xs"
                      />
                      <button className="rounded-lg bg-gradient-to-r from-brand to-brand-2 px-3 py-1.5 text-xs font-semibold text-white">
                        {adapter.isConfigured() ? "จัดคิวเผยแพร่" : "จัดคิว (copy-to-post)"}
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">คิวเผยแพร่ ({jobs.length})</h2>
        {jobs.length === 0 ? (
          <EmptyState>คิวว่าง</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>แพลตฟอร์ม</Th>
                  <Th>กำหนดเวลา</Th>
                  <Th>สถานะ</Th>
                  <Th>retry</Th>
                  <Th>จัดการ</Th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <Td>{platformLabel(j.platform)}</Td>
                    <Td>
                      {j.scheduled_at
                        ? new Date(j.scheduled_at as string).toLocaleString("th-TH")
                        : "ทันที"}
                    </Td>
                    <Td>
                      <StatusBadge status={j.status} />
                      {j.error_message && (
                        <span className="ml-1 text-xs text-red-500">{j.error_message}</span>
                      )}
                    </Td>
                    <Td>{j.retry_count}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        {(j.status === "queued" || j.status === "publishing" || j.status === "retry") &&
                          (j.platform === "facebook" || j.platform === "instagram") && (
                            <form action={publishNow}>
                              <input type="hidden" name="job_id" value={j.id} />
                              <button className="rounded bg-brand px-2 py-1 text-xs font-semibold text-white">
                                โพสต์เลย (API)
                              </button>
                            </form>
                          )}
                        {(j.status === "queued" || j.status === "publishing") && (
                          <form action={markPublished} className="flex items-center gap-1">
                            <input type="hidden" name="job_id" value={j.id} />
                            <input
                              name="published_url"
                              placeholder="ลิงก์โพสต์ (ถ้ามี)"
                              className="w-28 rounded border border-black/15 px-1.5 py-1 text-xs"
                            />
                            <button className="rounded bg-green-600 px-2 py-1 text-xs text-white">
                              ทำเครื่องหมายว่าโพสต์แล้ว
                            </button>
                          </form>
                        )}
                        {(j.status === "failed" ||
                          j.status === "retry" ||
                          j.status === "publishing") && (
                          <form action={retryJob}>
                            <input type="hidden" name="job_id" value={j.id} />
                            <button className="rounded border border-black/15 px-2 py-1 text-xs">
                              {j.status === "publishing" ? "รีเซ็ต (ค้าง)" : "retry"}
                            </button>
                          </form>
                        )}
                      </div>
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
