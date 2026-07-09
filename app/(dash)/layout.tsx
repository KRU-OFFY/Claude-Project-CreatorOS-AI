import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/workspace";
import { isSupabaseConfigured } from "@/lib/env";
import { Sidebar } from "./Sidebar";

// Shell for all authenticated pages. Middleware already gates auth, but we
// re-check here so Server Components have the context (and no flash).
export default async function DashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) redirect("/setup");

  const ctx = await getActiveContext();
  if (!ctx) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar
        workspaceName={ctx.workspaceName}
        email={ctx.email}
        role={ctx.role}
      />
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
