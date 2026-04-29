import type { LeadStatus, WebsiteStatus } from "@app/shared";

const STATUS_STYLES: Record<LeadStatus, string> = {
  sourced: "bg-slate-100 text-slate-700",
  researched: "bg-blue-50 text-blue-700",
  contacted: "bg-amber-50 text-amber-800",
  replied: "bg-emerald-50 text-emerald-800",
  form_submitted: "bg-emerald-100 text-emerald-900",
  building: "bg-violet-50 text-violet-800",
  live: "bg-accent text-ink",
  lost: "bg-zinc-100 text-zinc-500 line-through",
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  sourced: "Sourced",
  researched: "Researched",
  contacted: "Contacted",
  replied: "Replied",
  form_submitted: "Form submitted",
  building: "Building",
  live: "Live",
  lost: "Lost",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

const WEBSITE_STYLES: Record<WebsiteStatus, string> = {
  none: "bg-rose-50 text-rose-700",
  real: "bg-zinc-100 text-zinc-500",
  instagram: "bg-pink-50 text-pink-700",
  facebook: "bg-blue-50 text-blue-700",
  tiktok: "bg-zinc-900 text-white",
  twitter: "bg-sky-50 text-sky-700",
  linktree: "bg-emerald-50 text-emerald-700",
  other_social: "bg-orange-50 text-orange-700",
};

const WEBSITE_LABELS: Record<WebsiteStatus, string> = {
  none: "No website",
  real: "Has website",
  instagram: "Instagram only",
  facebook: "Facebook only",
  tiktok: "TikTok only",
  twitter: "X / Twitter only",
  linktree: "Linktree",
  other_social: "Social only",
};

export function WebsiteBadge({ status }: { status: WebsiteStatus | null }) {
  if (!status) return <span className="text-xs text-muted">—</span>;
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${WEBSITE_STYLES[status]}`}
    >
      {WEBSITE_LABELS[status]}
    </span>
  );
}
