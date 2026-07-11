import { PageHeader, Card } from "@/components/ui";
import { getActiveContext } from "@/lib/workspace";
import {
  SETTINGS_REGISTRY,
  WORKFLOW_KEYS,
  getAllSettings,
  maskSecret,
  type ResolvedSetting,
  type SettingDef,
} from "@/lib/settings";
import { saveSystemSetting, clearSystemSetting, toggleWorkflow } from "../../actions";

// Track L — ศูนย์รวมการตั้งค่าระบบ (owner แก้ไขได้, role อื่นดูอย่างเดียว)
// ค่า secret ไม่เคยถูกส่งมาหน้านี้แบบเต็ม — แสดงเป็น mask (•••• + 4 ตัวท้าย)

const ORIGIN_LABEL: Record<string, { text: string; cls: string }> = {
  db: { text: "ตั้งในแอป", cls: "bg-emerald-100 text-emerald-700" },
  env: { text: "จาก env", cls: "bg-sky-100 text-sky-700" },
  default: { text: "ค่าเริ่มต้น", cls: "bg-black/5 text-black/50" },
  missing: { text: "ยังไม่ตั้ง", cls: "bg-amber-100 text-amber-700" },
};

function OriginBadge({ origin }: { origin: string }) {
  const o = ORIGIN_LABEL[origin] ?? ORIGIN_LABEL.missing;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${o.cls}`}>{o.text}</span>
  );
}

// กลุ่มการ์ด integration + คำแนะนำตั้งค่า (ย่อจาก docs/deploy.md)
interface GroupSpec {
  title: string;
  keys: string[];
  guide: { intro: string; steps: string[]; redirectUri?: string };
}

const GROUPS: GroupSpec[] = [
  {
    title: "🤖 Anthropic AI",
    keys: ["anthropic_api_key", "ai_model"],
    guide: {
      intro: "ขับเคลื่อน AI จริง (สร้างบรีฟ/แคปชั่น/advisor) — ไม่ตั้งจะใช้ rule-based demo",
      steps: [
        "สมัคร/เข้าสู่ระบบที่ console.anthropic.com → API Keys → สร้าง key ใหม่",
        "วาง key ในช่องด้านบนแล้วกดบันทึก (โมเดลเริ่มต้น: claude-sonnet-5)",
      ],
    },
  },
  {
    title: "📘 Meta (Facebook Pages + Instagram)",
    keys: ["meta_app_id", "meta_app_secret"],
    guide: {
      intro: "โพสต์ FB/IG อัตโนมัติ + ดึง insights",
      steps: [
        "สร้างแอปประเภท Business ที่ developers.facebook.com",
        "เพิ่ม product Facebook Login แล้วตั้ง Valid OAuth Redirect URI ตามด้านล่าง",
        "ขอ Advanced Access ผ่าน App Review (pages_manage_posts, instagram_content_publish ฯลฯ)",
      ],
      redirectUri: "/api/connect/meta/callback",
    },
  },
  {
    title: "🎵 TikTok (Content Posting API)",
    keys: ["tiktok_client_key", "tiktok_client_secret", "tiktok_default_privacy_level"],
    guide: {
      intro: "โพสต์วิดีโอ TikTok อัตโนมัติ — แอปที่ยังไม่ผ่าน audit โพสต์ได้แบบ SELF_ONLY เท่านั้น",
      steps: [
        "สร้างแอปที่ developers.tiktok.com → เพิ่ม Login Kit + Content Posting API",
        "ตั้ง Redirect URI ตามด้านล่าง แล้วคัดลอก Client Key/Secret มาบันทึก",
      ],
      redirectUri: "/api/connect/tiktok/callback",
    },
  },
  {
    title: "▶️ Google / YouTube (Data API v3)",
    keys: ["google_client_id", "google_client_secret", "youtube_default_privacy"],
    guide: {
      intro: "อัปโหลดวิดีโอขึ้น YouTube อัตโนมัติ",
      steps: [
        "สร้างโปรเจกต์ใน Google Cloud Console → enable YouTube Data API v3",
        "ตั้ง OAuth consent screen แล้วสร้าง OAuth Client ID (Web) พร้อม Redirect URI ด้านล่าง",
        "scope youtube.upload เป็น sensitive — ใช้จริงต้องยื่น verification กับ Google",
      ],
      redirectUri: "/api/connect/youtube/callback",
    },
  },
  {
    title: "✉️ Resend (อีเมลคำเชิญทีม)",
    keys: ["resend_api_key", "resend_from_email"],
    guide: {
      intro: "ส่งอีเมลเชิญสมาชิกทีมอัตโนมัติ — ไม่ตั้งก็ copy ลิงก์เชิญเองได้",
      steps: ["สมัครที่ resend.com → verify โดเมนผู้ส่ง (SPF/DKIM) → สร้าง API key"],
    },
  },
  {
    title: "🐞 Sentry (error reporting)",
    keys: ["sentry_dsn"],
    guide: {
      intro: "รายงาน error จาก cron/boundary — ต้อง npm install @sentry/node ใน deployment ด้วย",
      steps: ["สร้างโปรเจกต์ Sentry แล้วคัดลอก DSN มาบันทึก"],
    },
  },
];

const RENDER_GROUP: GroupSpec = {
  title: "🎬 Workflow Render Video (external worker)",
  keys: ["render_worker_url", "render_worker_secret"],
  guide: {
    intro:
      "แอปไม่ render วิดีโอเอง — ต้อง deploy worker แยก (Fly.io / Railway / Cloud Run) ตาม contract ใน docs/render-worker.md แล้วใช้ secret เดียวกันทั้งสองฝั่ง (HMAC)",
    steps: [
      "Deploy worker จาก skeleton workers/render/server.ts",
      "สร้าง secret ด้วย openssl rand -hex 32 แล้วตั้งค่าเดียวกันทั้งฝั่งแอปและ worker",
      "ตั้ง APP_URL บน Vercel ให้เป็น origin จริง (worker ใช้ callback กลับมา)",
    ],
  },
};

function SettingRow({
  def,
  resolved,
  isOwner,
}: {
  def: SettingDef;
  resolved: ResolvedSetting;
  isOwner: boolean;
}) {
  const display = def.secret ? maskSecret(resolved.value) : (resolved.value ?? "");
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-black/5 py-2 last:border-0">
      <div className="min-w-48 flex-1">
        <div className="text-sm font-medium">{def.label}</div>
        <div className="flex items-center gap-2 text-xs text-black/50">
          <code className="rounded bg-black/5 px-1">{def.key}</code>
          <OriginBadge origin={resolved.origin} />
          {display ? <span className="font-mono">{display}</span> : null}
        </div>
      </div>
      {isOwner ? (
        <div className="flex items-center gap-2">
          <form action={saveSystemSetting} className="flex items-center gap-2">
            <input type="hidden" name="key" value={def.key} />
            <input
              type={def.secret ? "password" : "text"}
              name="value"
              placeholder={def.secret ? "วางค่าใหม่ (เว้นว่าง = คงเดิม)" : "ค่าใหม่"}
              autoComplete="off"
              className="w-56 rounded-lg border border-black/15 px-2 py-1 text-sm"
            />
            <button className="rounded-lg bg-black px-3 py-1 text-sm font-medium text-white">
              บันทึก
            </button>
          </form>
          {resolved.origin === "db" ? (
            <form action={clearSystemSetting}>
              <input type="hidden" name="key" value={def.key} />
              <button className="rounded-lg border border-black/15 px-2 py-1 text-xs text-black/60">
                ล้างค่า
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function GroupCard({
  spec,
  all,
  isOwner,
  appUrl,
}: {
  spec: GroupSpec;
  all: Map<string, ResolvedSetting>;
  isOwner: boolean;
  appUrl: string;
}) {
  const defs = spec.keys
    .map((k) => SETTINGS_REGISTRY.find((d) => d.key === k))
    .filter((d): d is SettingDef => Boolean(d));
  return (
    <Card>
      <h2 className="mb-1 font-semibold">{spec.title}</h2>
      <p className="mb-2 text-xs text-black/50">{spec.guide.intro}</p>
      {defs.map((def) => (
        <SettingRow
          key={def.key}
          def={def}
          resolved={all.get(def.key) ?? { value: null, origin: "missing" }}
          isOwner={isOwner}
        />
      ))}
      <details className="mt-2 text-xs text-black/60">
        <summary className="cursor-pointer font-medium">📖 คำแนะนำตั้งค่า</summary>
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          {spec.guide.steps.map((st) => (
            <li key={st}>{st}</li>
          ))}
        </ol>
        {spec.guide.redirectUri ? (
          <p className="mt-1">
            Redirect URI:{" "}
            <code className="rounded bg-black/5 px-1">
              {appUrl}
              {spec.guide.redirectUri}
            </code>
          </p>
        ) : null}
      </details>
    </Card>
  );
}

export default async function SystemSettingsPage() {
  const ctx = await getActiveContext();
  const isOwner = ctx?.role === "owner";
  const all = ctx?.workspaceId
    ? await getAllSettings(ctx.workspaceId)
    : new Map<string, ResolvedSetting>();
  const appUrl = process.env.APP_URL || "https://your-app.vercel.app";

  // Bootstrap env — configurable only on the hosting side (Vercel), never in-app.
  const bootstrap: { label: string; ok: boolean }[] = [
    { label: "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY", ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) },
    { label: "SUPABASE_SERVICE_ROLE_KEY", ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
    { label: "TOKEN_ENCRYPTION_KEY", ok: Boolean(process.env.TOKEN_ENCRYPTION_KEY) },
    { label: "CRON_SECRET", ok: Boolean(process.env.CRON_SECRET) },
    { label: "APP_URL", ok: Boolean(process.env.APP_URL) },
  ];

  return (
    <div>
      <PageHeader
        title="ตั้งค่าระบบ"
        subtitle="ศูนย์รวมการตั้งค่า API, integration และ workflow — ค่าที่บันทึกในแอปจะชนะค่า env (secret เข้ารหัสก่อนเก็บเสมอ)"
      />

      {!isOwner ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          คุณอยู่ในโหมดดูอย่างเดียว — เฉพาะ owner ของ workspace เท่านั้นที่แก้การตั้งค่าระบบได้
        </div>
      ) : null}

      {/* ===== workflows ===== */}
      <Card className="mb-4">
        <h2 className="mb-1 font-semibold">⚙️ เปิด/ปิด Workflows</h2>
        <p className="mb-2 text-xs text-black/50">
          มีผลเฉพาะ workspace นี้ — งานที่ถูกปิดจะถูกข้าม (คิวไม่หาย กลับมาทำงานเมื่อเปิดใหม่)
        </p>
        {WORKFLOW_KEYS.map((key) => {
          const def = SETTINGS_REGISTRY.find((d) => d.key === key);
          if (!def) return null;
          const resolved = all.get(key) ?? { value: "true", origin: "default" as const };
          const enabled = resolved.value !== "false";
          return (
            <div
              key={key}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 py-2 last:border-0"
            >
              <div>
                <div className="text-sm font-medium">{def.label}</div>
                <code className="text-xs text-black/40">{key}</code>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    enabled ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {enabled ? "เปิดอยู่" : "ปิดอยู่"}
                </span>
                {isOwner ? (
                  <form action={toggleWorkflow}>
                    <input type="hidden" name="key" value={key} />
                    <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
                    <button className="rounded-lg border border-black/15 px-3 py-1 text-xs font-medium">
                      {enabled ? "ปิด" : "เปิด"}
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          );
        })}
      </Card>

      {/* ===== render workflow ===== */}
      <div className="mb-4">
        <GroupCard spec={RENDER_GROUP} all={all} isOwner={isOwner} appUrl={appUrl} />
      </div>

      {/* ===== integrations ===== */}
      <div className="grid gap-4 md:grid-cols-2">
        {GROUPS.map((g) => (
          <GroupCard key={g.title} spec={g} all={all} isOwner={isOwner} appUrl={appUrl} />
        ))}
      </div>

      {/* ===== bootstrap (read-only) ===== */}
      <Card className="mt-4">
        <h2 className="mb-1 font-semibold">🔐 ตั้งค่าที่แก้ในแอปไม่ได้ (bootstrap)</h2>
        <p className="mb-2 text-xs text-black/50">
          ค่าเหล่านี้แอปต้องใช้ก่อนจะอ่านฐานข้อมูลได้ จึงตั้งได้ที่ Vercel → Settings →
          Environment Variables เท่านั้น (ดูขั้นตอนละเอียดใน docs/deploy.md และ env.example)
        </p>
        {bootstrap.map((b) => (
          <div
            key={b.label}
            className="flex items-center justify-between border-b border-black/5 py-2 text-sm last:border-0"
          >
            <code className="text-xs">{b.label}</code>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                b.ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {b.ok ? "ตั้งแล้ว" : "ยังไม่ตั้ง"}
            </span>
          </div>
        ))}
        <p className="mt-2 text-xs text-black/40">
          สร้าง secret ด้วย <code className="rounded bg-black/5 px-1">openssl rand -hex 32</code>{" "}
          — เปลี่ยน TOKEN_ENCRYPTION_KEY จะทำให้ token/secret เดิมถอดรหัสไม่ได้
        </p>
      </Card>
    </div>
  );
}
