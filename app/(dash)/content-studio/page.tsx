import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/ui";
import { listCampaigns, listContentVariants } from "@/lib/data";
import { generateContentForCampaign, renderVariantMedia } from "../actions";
import { platformLabel } from "@/lib/platforms";
import { aiMode } from "@/lib/ai";
import { renderConfigured } from "@/lib/render";

export default async function ContentStudioPage() {
  const [campaigns, variants] = await Promise.all([
    listCampaigns(),
    listContentVariants(),
  ]);
  const renderReady = renderConfigured();

  return (
    <div>
      <PageHeader
        title="AI Content Studio"
        subtitle="สร้างบรีฟ → แคปชั่น/แฮชแท็ก/CTA → content variant ต่อแพลตฟอร์ม (ตรวจ Compliance อัตโนมัติ)"
      />

      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <h2 className="mb-3 font-semibold">สร้างคอนเทนต์จากแคมเปญ</h2>
          {campaigns.length === 0 ? (
            <EmptyState>ยังไม่มีแคมเปญ — สร้างในหน้า Campaign ก่อน</EmptyState>
          ) : (
            <form action={generateContentForCampaign} className="space-y-3">
              <select
                name="campaign_id"
                required
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button className="w-full rounded-lg bg-gradient-to-r from-brand to-brand-2 px-3 py-2 text-sm font-semibold text-white">
                สร้าง variant ครบทุกแพลตฟอร์มเป้าหมาย
              </button>
              <p className="text-xs text-black/40">
                โหมด AI: {aiMode() === "anthropic" ? "Anthropic (Claude)" : "Rule-based (demo)"}
              </p>
            </form>
          )}
        </Card>

        <Card className="md:col-span-2">
          <h2 className="mb-3 font-semibold">Content Variants ({variants.length})</h2>
          {variants.length === 0 ? (
            <EmptyState>ยังไม่มี variant — สร้างจากแคมเปญทางซ้าย</EmptyState>
          ) : (
            <div className="space-y-3">
              {variants.map((v) => (
                <div key={v.id} className="rounded-lg border border-black/10 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium">{platformLabel(v.platform)}</span>
                    <StatusBadge status={v.status} />
                  </div>
                  <p className="text-sm text-black/70">{v.variant_body}</p>
                  {(v.hashtags as string[])?.length > 0 && (
                    <p className="mt-1 text-xs text-brand">
                      {(v.hashtags as string[]).map((h) => `#${h}`).join(" ")}
                    </p>
                  )}
                  {v.cta && <p className="mt-1 text-xs text-black/50">CTA: {v.cta}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {renderReady ? (
                      <form action={renderVariantMedia}>
                        <input type="hidden" name="variant_id" value={v.id} />
                        <button className="rounded-lg border border-black/15 px-3 py-1 text-xs hover:bg-black/5">
                          🎬 สั่ง render วิดีโอ
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-black/40">
                        (render worker ยังไม่ตั้งค่า —
                        ตั้ง RENDER_WORKER_URL/RENDER_WORKER_SECRET เพื่อเปิดปุ่มนี้)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
