import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  LEAD_STATUSES,
  type Activity,
  type DashboardStats,
  type LeadStatus,
} from "@app/shared";
import { Layout } from "../components/Layout.js";
import { api } from "../lib/api.js";
import { formatRelative } from "../lib/format.js";

interface RecentActivityRow extends Activity {
  business_name: string;
}

interface DashboardResponse {
  stats: DashboardStats;
  recent_activity: RecentActivityRow[];
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  sourced: "Sourced",
  researched: "Researched",
  contacted: "Contacted",
  replied: "Replied",
  form_submitted: "Form submitted",
  building: "Building",
  live: "Live",
  lost: "Lost",
};

export function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<DashboardResponse>("/api/stats/dashboard")
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Layout>
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl">
            <span className="italic">Dashboard</span>
          </h1>
          <p className="text-sm text-muted mt-1">
            {loading
              ? "Loading…"
              : data
                ? `${totalOf(data.stats).toLocaleString()} leads in the pipeline`
                : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/leads/new" className="btn-secondary text-sm">
            + Add manually
          </Link>
          <Link to="/scrape" className="btn-primary text-sm">
            Find leads
          </Link>
        </div>
      </header>

      {error ? (
        <div role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {data ? (
        <>
          <section className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Leads added · 7d" value={data.stats.leads_added_this_week} />
            <Stat label="Emails sent · 7d" value={data.stats.emails_sent_this_week} />
            <Stat label="Calls made · 7d" value={data.stats.calls_made_this_week} />
            <Stat
              label={`Emails today (cap ${data.stats.daily_email_cap})`}
              value={data.stats.emails_sent_today}
              highlight={data.stats.emails_sent_today >= data.stats.daily_email_cap}
            />
          </section>

          <section className="mb-8">
            <h2 className="font-serif text-xl mb-3">Pipeline</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {LEAD_STATUSES.map((s) => (
                <Link
                  key={s}
                  to={`/leads?status=${s}`}
                  className="card hover:bg-ink/[0.02] transition"
                >
                  <div className="text-xs text-muted">{STATUS_LABEL[s]}</div>
                  <div className="font-serif text-3xl mt-1">
                    {data.stats.by_status[s] ?? 0}
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="card">
            <h2 className="font-serif text-xl mb-3">Recent activity</h2>
            {data.recent_activity.length === 0 ? (
              <p className="text-sm text-muted">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-ink/5">
                {data.recent_activity.map((a) => (
                  <li key={a.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/leads/${a.lead_id}`}
                        className="font-medium text-ink hover:underline truncate block"
                      >
                        {a.business_name}
                      </Link>
                      <div className="text-xs text-muted">
                        {labelFor(a)}
                        {a.body ? ` · ${truncate(a.body, 80)}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted">
                      {formatRelative(a.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </Layout>
  );
}

function totalOf(s: DashboardStats): number {
  return LEAD_STATUSES.reduce((acc, st) => acc + (s.by_status[st] ?? 0), 0);
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={`card ${highlight ? "ring-1 ring-amber-400" : ""}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="font-serif text-3xl mt-1">{value.toLocaleString()}</div>
    </div>
  );
}

function labelFor(a: Activity): string {
  switch (a.type) {
    case "email_sent":
      return "Email sent";
    case "email_delivered":
      return "Email delivered";
    case "email_opened":
      return "Email opened";
    case "email_bounced":
      return "Email bounced";
    case "email_replied":
      return "Reply received";
    case "call_made":
      return `Call · ${a.outcome ?? "logged"}`;
    case "call_received":
      return "Call received";
    case "note":
      return "Note";
    case "status_change":
      return "Status changed";
    case "form_submitted":
      return "Intake form submitted";
    default:
      return a.type;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
