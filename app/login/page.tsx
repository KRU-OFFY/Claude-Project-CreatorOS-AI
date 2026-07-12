import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  if (!isSupabaseConfigured()) redirect("/setup");
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-xl font-bold text-white shadow-[0_12px_32px_-8px_rgba(139,92,246,0.75)]">
            C
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient">CreatorOS AI</h1>
          <p className="text-sm text-foreground/50">One AI. Every Platform.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-6 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_24px_60px_-30px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-foreground/35">
          omnichannel affiliate growth OS
        </p>
      </div>
    </main>
  );
}
