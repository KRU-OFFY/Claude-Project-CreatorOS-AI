import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/ui";
import { listCampaigns, listContentVariants } from "@/lib/data";
import { generateContentForCampaign, renderVariantMedia } from "../actions";
import { platformLabel } from "@/lib/platforms";
import { aiMode } from "@/lib/ai";
import { getActiveContext } from "@/lib/workspace";
import { getIntegrationConfig } from "@/lib/settings";
import { renderConfigured } from "@/lib/render";
import { placeAffiliateLink } from "@/lib/affiliate";

// Affiliate URL threaded through the content_items → campaigns → products
// join in listContentVariants; null when any link in the chain is missing.
function affiliateUrlOf(v: { content_items?: unknown }): string | null {
  const item = v.content_items as {
    campaigns?: { products?: { url?: string | null } | null } | null;
  } | null;
  return item?.campaigns?.products?.url ?? null;
}

// Preview where the publish flow will place the affiliate link. Reuses the
// real placement logic so the note never promises something publish won't do
// (invalid URL or unsupported platform → no note).
function affiliateNoteOf(v: { platform: string; content_items?: unknown }): {
  url: string;
  note: string;
} | null {
  const url = affiliateUrlOf(v);
  if (!url) return null;
  const placed = placeAffiliateLink("", url, v.platform);
  if (placed.firstComment) {
    return { url, note: "🔗 ลิงก์จะถูกโพสต์เป็นคอมเมนต์แรกอัตโนมัติ" };
  }
  if (placed.caption !== "") {
    return { url, note: "🔗 ลิงก์จะถูกต่อท้ายแคปชั่นอัตโนมัติ" };
  }
  return null;
}

export default async function ContentStudioPage() {
  const [campaigns, variants] = await Promise.all([
    listCampaigns(),
    listContentVariants(),
  ]);
  const ctx = await getActiveContext();
  const cfg = ctx?.workspaceId ? await getIntegrationConfig(ctx.workspaceId) : null;
  const renderReady = renderConfigured(cfg?.render);

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
                โหมด AI: {aiMode(cfg?.ai) === "anthropic" ? "Anthropic (Claude)" : "Rule-based (demo)"}
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
              {variants.map((v) => {
                const affiliate = affiliateNoteOf(v);
                return (
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
                  {affiliate && (
                    <p className="mt-1 text-xs text-black/50">
                      {affiliate.note}{" "}
                      <span className="break-all text-brand">{affiliate.url}</span>
                    </p>
                  )}
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
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
