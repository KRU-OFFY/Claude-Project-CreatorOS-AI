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
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-black/60">{subtitle}</p>}
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
      className={`rounded-xl border border-black/10 bg-white p-5 shadow-sm ${className}`}
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
    <Card>
      <p className="text-xs text-black/50">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-black/40">{hint}</p>}
    </Card>
  );
}

const tierColors: Record<string, string> = {
  hero: "bg-purple-100 text-purple-700",
  growth: "bg-blue-100 text-blue-700",
  test: "bg-amber-100 text-amber-700",
  watchlist: "bg-gray-100 text-gray-600",
};

export function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        tierColors[tier] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {tier}
    </span>
  );
}

const statusColors: Record<string, string> = {
  pass: "bg-green-100 text-green-700",
  approved: "bg-green-100 text-green-700",
  published: "bg-green-100 text-green-700",
  fail: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
  needs_review: "bg-amber-100 text-amber-700",
  pending_compliance: "bg-amber-100 text-amber-700",
  draft: "bg-gray-100 text-gray-600",
  queued: "bg-blue-100 text-blue-700",
  publishing: "bg-blue-100 text-blue-700",
  retry: "bg-orange-100 text-orange-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        statusColors[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {status}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-black/15 bg-white/50 p-8 text-center text-sm text-black/50">
      {children}
    </div>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th className="border-b border-black/10 px-3 py-2 text-left text-xs font-semibold text-black/50">
      {children}
    </th>
  );
}

export function Td({ children }: { children: ReactNode }) {
  return <td className="border-b border-black/5 px-3 py-2 text-sm">{children}</td>;
}
