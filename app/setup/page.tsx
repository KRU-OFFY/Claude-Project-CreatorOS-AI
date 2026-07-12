// Shown when Supabase env is not configured. Keeps the app from crashing and
// tells the operator exactly what to set.
export default function SetupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-bold">ตั้งค่า CreatorOS AI</h1>
      <p className="text-sm text-foreground/60">
        ระบบยังไม่ได้เชื่อมต่อ Supabase — กรุณาตั้งค่า environment variables
        ต่อไปนี้แล้วรีสตาร์ทแอป
      </p>
      <pre className="overflow-x-auto rounded-lg bg-black/90 p-4 text-xs text-green-200">
{`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # server-only
ANTHROPIC_API_KEY=...                # optional (AI features)
AI_MODEL=claude-sonnet-5             # optional
TOKEN_ENCRYPTION_KEY=...             # 32-byte hex/base64 (social tokens)
RENDER_WORKER_URL=...                # optional (external MP4 render worker)`}
      </pre>
      <p className="text-xs text-foreground/50">
        ดูรายละเอียดเพิ่มเติมที่ <code>README.md</code> และ{" "}
        <code>.env.local.example</code>
      </p>
    </main>
  );
}
