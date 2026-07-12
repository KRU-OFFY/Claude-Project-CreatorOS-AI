import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gradient">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-foreground/55">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_18px_40px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_18px_40px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl">
      {/* accent glow in the corner */}
      <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-brand/25 blur-2xl" />
      <p className="text-xs font-medium uppercase tracking-wide text-foreground/45">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-foreground/40">{hint}</p>}
    </div>
  );
}

const tierColors: Record<string, string> = {
  hero: "bg-purple-500/15 text-purple-300 ring-1 ring-inset ring-purple-400/25",
  growth: "bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-400/25",
  test: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/25",
  watchlist: "bg-white/10 text-foreground/60 ring-1 ring-inset ring-white/15",
};

export function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        tierColors[tier] ?? tierColors.watchlist
      }`}
    >
      {tier}
    </span>
  );
}

const statusColors: Record<string, string> = {
  pass: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/25",
  approved: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/25",
  published: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/25",
  fail: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-400/25",
  failed: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-400/25",
  needs_review: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/25",
  pending_compliance: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/25",
  draft: "bg-white/10 text-foreground/60 ring-1 ring-inset ring-white/15",
  queued: "bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-400/25",
  publishing: "bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-400/25",
  retry: "bg-orange-500/15 text-orange-300 ring-1 ring-inset ring-orange-400/25",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        statusColors[status] ?? statusColors.draft
      }`}
    >
      {status}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-sm text-foreground/50">
      {children}
    </div>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th className="border-b border-white/10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-foreground/45">
      {children}
    </th>
  );
}

export function Td({ children }: { children: ReactNode }) {
  return <td className="border-b border-white/5 px-3 py-2 text-sm">{children}</td>;
}
