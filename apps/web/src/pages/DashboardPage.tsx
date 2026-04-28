import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LEAD_STATUSES, type LeadStatus } from "@app/shared";
import { Layout } from "../components/Layout.js";
import { api } from "../lib/api.js";

interface LeadListResponse {
  total: number;
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
  const [counts, setCounts] = useState<Partial<Record<LeadStatus, number>>>({});
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // Phase 6 will add /api/stats/dashboard. For now, derive from /api/leads
        // (one HEAD-ish call per status is wasteful but simple).
        const [allRes, ...statusRes] = await Promise.all([
          api.get<LeadListResponse>(`/api/leads?limit=1`),
          ...LEAD_STATUSES.map((s) =>
            api.get<LeadListResponse>(`/api/leads?status=${s}&limit=1`),
          ),
        ]);
        if (cancelled) return;
        setTotal(allRes.total);
        const next: Partial<Record<LeadStatus, number>> = {};
        LEAD_STATUSES.forEach((s, i) => {
          next[s] = statusRes[i]?.total ?? 0;
        });
        setCounts(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
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
            {loading ? "Loading…" : `${(total ?? 0).toLocaleString()} leads in the pipeline`}
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
              <div className="font-serif text-3xl mt-1">{counts[s] ?? 0}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="font-serif text-xl mb-2">Phase status</h2>
        <ul className="text-sm space-y-1 text-muted">
          <li>✓ Phase 1 — Foundation (auth, schema, deploy)</li>
          <li>✓ Phase 2 — Leads CRUD (list, detail, edit, status, notes)</li>
          <li>· Phase 3 — Scraping</li>
          <li>· Phase 4 — Email</li>
          <li>· Phase 5 — Calls</li>
          <li>· Phase 6 — Dashboard stats endpoint</li>
          <li>· Phase 7 — CSV import</li>
        </ul>
      </section>
    </Layout>
  );
}
