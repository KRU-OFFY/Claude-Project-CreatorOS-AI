import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  if (!isSupabaseConfigured()) redirect("/setup");
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-2 text-lg font-bold text-white">
            C
          </div>
          <h1 className="text-xl font-bold">CreatorOS AI</h1>
          <p className="text-sm text-black/50">One AI. Every Platform.</p>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
