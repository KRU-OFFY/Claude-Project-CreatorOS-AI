import { PageHeader, Card, StatusBadge, Th, Td } from "@/components/ui";
import { listChannelConnections } from "@/lib/data";
import { getActiveContext } from "@/lib/workspace";
import { PLATFORMS, PLATFORM_KEYS } from "@/lib/platforms";
import { getAdapter } from "@/lib/adapters";

const metaBanners: Record<string, { text: string; ok: boolean }> = {
  connected: { text: "เชื่อมบัญชี Meta (Facebook/Instagram) สำเร็จ", ok: true },
  cancelled: { text: "ยกเลิกการเชื่อมบัญชี Meta", ok: false },
  no_pages: { text: "ไม่พบเพจที่จัดการได้ในบัญชีนี้", ok: false },
  bad_state: { text: "state ไม่ถูกต้อง กรุณาลองใหม่", ok: false },
  not_configured: { text: "ยังไม่ได้ตั้งค่า META_APP_ID/SECRET บนเซิร์ฟเวอร์", ok: false },
  error: { text: "เกิดข้อผิดพลาดระหว่างเชื่อมบัญชี", ok: false },
};

const tiktokBanners: Record<string, { text: string; ok: boolean }> = {
  connected: { text: "เชื่อมบัญชี TikTok สำเร็จ", ok: true },
  cancelled: { text: "ยกเลิกการเชื่อมบัญชี TikTok", ok: false },
  bad_state: { text: "state ไม่ถูกต้อง กรุณาลองใหม่", ok: false },
  not_configured: { text: "ยังไม่ได้ตั้งค่า TIKTOK_CLIENT_KEY/SECRET บนเซิร์ฟเวอร์", ok: false },
  error: { text: "เกิดข้อผิดพลาดระหว่างเชื่อมบัญชี TikTok", ok: false },
};

const youtubeBanners: Record<string, { text: string; ok: boolean }> = {
  connected: { text: "เชื่อมช่อง YouTube สำเร็จ", ok: true },
  cancelled: { text: "ยกเลิกการเชื่อมบัญชี YouTube", ok: false },
  bad_state: { text: "state ไม่ถูกต้อง กรุณาลองใหม่", ok: false },
  missing_scope: {
    text: "YouTube: ต้องอนุญาต youtube.upload จึงจะโพสต์ได้ — เชื่อมใหม่และเลือกอนุญาตทุกสิทธิ์",
    ok: false,
  },
  not_configured: {
    text: "ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID/SECRET บนเซิร์ฟเวอร์",
    ok: false,
  },
  error: { text: "เกิดข้อผิดพลาดระหว่างเชื่อมบัญชี YouTube", ok: false },
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ meta?: string; tiktok?: string; youtube?: string; msg?: string }>;
}) {
  const [connections, ctx, sp] = await Promise.all([
    listChannelConnections(),
    getActiveContext(),
    searchParams,
  ]);

  const byPlatform = new Map(connections.map((c) => [c.platform, c]));
  const banner = sp.meta
    ? metaBanners[sp.meta]
    : sp.tiktok
      ? tiktokBanners[sp.tiktok]
      : sp.youtube
        ? youtubeBanners[sp.youtube]
        : null;

  return (
    <div>
      <PageHeader
        title="ตั้งค่า"
        subtitle="เชื่อมบัญชีแพลตฟอร์ม · บทบาทผู้ใช้ · การตั้งค่าเวิร์กสเปซ"
      />

      {banner && (
        <div
          className={`mb-4 rounded-lg px-4 py-2 text-sm ${
            banner.ok ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {banner.text}
          {sp.msg && <span className="ml-2 text-xs opacity-70">({decodeURIComponent(sp.msg)})</span>}
        </div>
      )}

      <div className="mb-4">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">เชื่อมบัญชี Meta (Facebook / Instagram)</h2>
              <p className="mt-1 text-xs text-black/50">
                เชื่อมเพจเพื่อโพสต์จริงผ่าน Graph API — token จะถูกเข้ารหัสและเก็บฝั่ง server
                {byPlatform.get("facebook")?.status === "connected" && (
                  <span className="ml-1 text-green-600">
                    (เชื่อมแล้ว: {byPlatform.get("facebook")?.account_name})
                  </span>
                )}
              </p>
            </div>
            <a
              href="/api/connect/meta/start"
              className="rounded-lg bg-gradient-to-r from-brand to-brand-2 px-4 py-2 text-sm font-semibold text-white"
            >
              {byPlatform.get("facebook")?.status === "connected"
                ? "เชื่อมใหม่ / เปลี่ยนเพจ"
                : "เชื่อมบัญชี Meta"}
            </a>
          </div>
        </Card>
      </div>

      <div className="mb-4">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">เชื่อมบัญชี TikTok</h2>
              <p className="mt-1 text-xs text-black/50">
                เชื่อมบัญชีเพื่อโพสต์วิดีโอผ่าน Content Posting API — token เข้ารหัสฝั่ง server
                {byPlatform.get("tiktok")?.status === "connected" && (
                  <span className="ml-1 text-green-600">
                    (เชื่อมแล้ว: {byPlatform.get("tiktok")?.account_name})
                  </span>
                )}
              </p>
            </div>
            <a
              href="/api/connect/tiktok/start"
              className="rounded-lg bg-gradient-to-r from-brand to-brand-2 px-4 py-2 text-sm font-semibold text-white"
            >
              {byPlatform.get("tiktok")?.status === "connected"
                ? "เชื่อมใหม่"
                : "เชื่อมบัญชี TikTok"}
            </a>
          </div>
        </Card>
      </div>

      <div className="mb-4">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">เชื่อมช่อง YouTube</h2>
              <p className="mt-1 text-xs text-black/50">
                เชื่อมช่องเพื่ออัปโหลดวิดีโอผ่าน YouTube Data API v3 — token เข้ารหัสฝั่ง server
                {byPlatform.get("youtube")?.status === "connected" && (
                  <span className="ml-1 text-green-600">
                    (เชื่อมแล้ว: {byPlatform.get("youtube")?.account_name})
                  </span>
                )}
              </p>
              <p className="mt-1 text-[11px] text-black/40">
                Privacy เริ่มต้น: private (ตั้ง YOUTUBE_DEFAULT_PRIVACY เป็น unlisted/public เมื่อพร้อม)
              </p>
            </div>
            <a
              href="/api/connect/youtube/start"
              className="rounded-lg bg-gradient-to-r from-brand to-brand-2 px-4 py-2 text-sm font-semibold text-white"
            >
              {byPlatform.get("youtube")?.status === "connected"
                ? "เชื่อมใหม่ / เปลี่ยนช่อง"
                : "เชื่อมช่อง YouTube"}
            </a>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">เวิร์กสเปซ</h2>
          <dl className="space-y-1.5 text-sm">
            <Row label="ชื่อ" value={ctx?.workspaceName || "—"} />
            <Row label="อีเมล" value={ctx?.email || "—"} />
            <Row label="บทบาทของคุณ" value={ctx?.role || "—"} />
          </dl>
          <div className="mt-4 rounded-lg bg-black/5 p-3 text-xs text-black/60">
            บทบาท: owner (จัดการทั้งหมด) · editor (สร้าง/แก้) · approver (อนุมัติ compliance) ·
            viewer (ดูอย่างเดียว)
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">การเชื่อมต่อแพลตฟอร์ม</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>แพลตฟอร์ม</Th>
                  <Th>สถานะ</Th>
                  <Th>API</Th>
                </tr>
              </thead>
              <tbody>
                {PLATFORM_KEYS.map((p) => {
                  const conn = byPlatform.get(p);
                  const adapter = getAdapter(p);
                  return (
                    <tr key={p}>
                      <Td>{PLATFORMS[p].label}</Td>
                      <Td>
                        <StatusBadge status={conn?.status ?? "disconnected"} />
                      </Td>
                      <Td>
                        <span className="text-xs text-black/50">
                          {adapter.isConfigured() ? "พร้อมใช้" : "ยังไม่ตั้งค่า"}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-black/40">
            การเชื่อมบัญชีจริงต้องใช้ OAuth ของแต่ละแพลตฟอร์ม — token จะถูกเข้ารหัสและเก็บฝั่ง
            server เท่านั้น (ไม่ส่งกลับ client)
          </p>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-black/50">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
