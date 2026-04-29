export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-busy="true" className="flex items-center gap-2 text-sm text-muted">
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="animate-spin"
      >
        <circle cx={12} cy={12} r={10} className="opacity-20" />
        <path d="M22 12a10 10 0 0 0-10-10" strokeLinecap="round" />
      </svg>
      <span>{label}…</span>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card text-center py-10">
      <p className="font-medium text-ink">{title}</p>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
