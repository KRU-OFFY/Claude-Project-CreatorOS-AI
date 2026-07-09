"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";

const groups = ["ภาพรวม", "เวิร์กโฟลว์", "ผลลัพธ์", "ระบบ"];

export function Sidebar({
  workspaceName,
  email,
  role,
}: {
  workspaceName: string;
  email: string;
  role: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-black/10 bg-white px-4 py-3 md:hidden">
        <Brand />
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-black/10 px-3 py-1.5 text-sm"
          aria-label="เมนู"
        >
          ☰ เมนู
        </button>
      </div>

      <aside
        className={`${
          open ? "block" : "hidden"
        } w-full shrink-0 border-b border-black/10 bg-white md:block md:w-64 md:border-b-0 md:border-r`}
      >
        <div className="hidden px-5 py-5 md:block">
          <Brand />
        </div>

        <nav className="px-3 pb-4">
          {groups.map((g) => (
            <div key={g} className="mb-3">
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-black/40">
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
                        ? "bg-brand/10 font-semibold text-brand"
                        : "text-black/70 hover:bg-black/5"
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

        <div className="border-t border-black/10 px-5 py-4 text-xs text-black/60">
          <p className="font-medium text-black/80">{workspaceName || "—"}</p>
          <p className="truncate">{email}</p>
          <p className="mt-1 inline-block rounded bg-black/5 px-1.5 py-0.5 text-[11px]">
            บทบาท: {role}
          </p>
          <form action="/api/auth/signout" method="post" className="mt-3">
            <button className="w-full rounded-lg border border-black/10 px-3 py-1.5 text-left hover:bg-black/5">
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
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-2 text-sm font-bold text-white">
        C
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold">CreatorOS AI</p>
        <p className="text-[10px] text-black/50">One AI. Every Platform.</p>
      </div>
    </div>
  );
}
