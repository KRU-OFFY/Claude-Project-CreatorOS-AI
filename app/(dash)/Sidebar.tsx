"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { switchWorkspace } from "./actions";

const groups = ["ภาพรวม", "เวิร์กโฟลว์", "ผลลัพธ์", "ระบบ"];

interface MembershipItem {
  workspaceId: string;
  workspaceName: string;
  role: string;
}

export function Sidebar({
  workspaceName,
  activeWorkspaceId,
  memberships,
  email,
  role,
}: {
  workspaceName: string;
  activeWorkspaceId: string;
  memberships: MembershipItem[];
  email: string;
  role: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-background/70 px-4 py-3 backdrop-blur-xl md:hidden">
        <Brand />
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm"
          aria-label="เมนู"
        >
          ☰ เมนู
        </button>
      </div>

      <aside
        className={`${
          open ? "block" : "hidden"
        } w-full shrink-0 border-b border-white/10 bg-white/[0.03] backdrop-blur-xl md:sticky md:top-0 md:block md:h-screen md:w-64 md:overflow-y-auto md:border-b-0 md:border-r`}
      >
        <div className="hidden px-5 py-5 md:block">
          <Brand />
        </div>

        {memberships.length > 1 && (
          <div className="px-4 pb-2 md:pb-3">
            <form action={switchWorkspace}>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
                เวิร์กสเปซ
              </label>
              <select
                name="workspace_id"
                defaultValue={activeWorkspaceId}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="w-full rounded-lg border border-white/15 bg-background px-2 py-1.5 text-sm text-foreground"
              >
                {memberships.map((m) => (
                  <option key={m.workspaceId} value={m.workspaceId}>
                    {m.workspaceName || "(ไม่มีชื่อ)"} · {m.role}
                  </option>
                ))}
              </select>
            </form>
          </div>
        )}

        <nav className="px-3 pb-4">
          {groups.map((g) => (
            <div key={g} className="mb-3">
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
                {g}
              </p>
              {NAV_ITEMS.filter((i) => i.group === g).map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                      active
                        ? "border border-white/10 bg-gradient-to-r from-brand/25 to-brand-2/15 font-semibold text-foreground shadow-[0_8px_24px_-12px_rgba(139,92,246,0.6)]"
                        : "border border-transparent text-foreground/65 hover:bg-white/5 hover:text-foreground"
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-5 py-4 text-xs text-foreground/60">
          <p className="font-medium text-foreground/80">{workspaceName || "—"}</p>
          <p className="truncate">{email}</p>
          <p className="mt-1 inline-block rounded bg-white/5 px-1.5 py-0.5 text-[11px]">
            บทบาท: {role}
          </p>
          <form action="/api/auth/signout" method="post" className="mt-3">
            <button className="w-full rounded-lg border border-white/10 px-3 py-1.5 text-left hover:bg-white/5">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-2 text-sm font-bold text-white shadow-[0_8px_20px_-6px_rgba(139,92,246,0.7)]">
        C
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold">CreatorOS AI</p>
        <p className="text-[10px] text-foreground/45">One AI. Every Platform.</p>
      </div>
    </div>
  );
}
