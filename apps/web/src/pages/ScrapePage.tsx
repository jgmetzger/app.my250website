import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BUSINESS_TYPES, type BusinessType, type ScrapeRun } from "@app/shared";
import { Layout } from "../components/Layout.js";
import { api } from "../lib/api.js";
import { formatRelative } from "../lib/format.js";

interface ScrapeRunResponse {
  run_id: number;
}
interface RunsResponse {
  runs: ScrapeRun[];
}

export function ScrapePage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentRuns, setRecentRuns] = useState<ScrapeRun[]>([]);

  const [form, setForm] = useState({
    query: "",
    city: "",
    business_type: "" as BusinessType | "",
    min_reviews: 10,
    min_rating: 4.0,
  });

  useEffect(() => {
    api.get<RunsResponse>("/api/scrape/runs").then((r) => setRecentRuns(r.runs)).catch(() => {});
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.query.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        query: form.query.trim(),
        min_reviews: form.min_reviews,
        min_rating: form.min_rating,
      };
      if (form.city.trim()) payload.city = form.city.trim();
      if (form.business_type) payload.business_type = form.business_type;
      const r = await api.post<ScrapeRunResponse>("/api/scrape/run", payload);
      navigate(`/scrape/runs/${r.run_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scrape failed to start");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <header className="mb-6">
        <h1 className="font-serif text-3xl">
          <span className="italic">Find leads</span>
        </h1>
        <p className="text-sm text-muted mt-1">
          Headless Google Maps search — applies your filters and dedupes against existing leads.
        </p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-7">
          <form onSubmit={onSubmit} className="card space-y-4">
            <div>
              <label className="label" htmlFor="query">
                Query *
              </label>
              <input
                id="query"
                className="input"
                required
                autoFocus
                placeholder='e.g. "pubs in Manchester" or "gastropubs Leeds"'
                value={form.query}
                onChange={(e) => setForm((f) => ({ ...f, query: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="city">
                  City
                </label>
                <input
                  id="city"
                  className="input"
                  placeholder="Manchester"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div>
                <label className="label" htmlFor="business_type">
                  Business type
                </label>
                <select
                  id="business_type"
                  className="input"
                  value={form.business_type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      business_type: e.target.value as BusinessType | "",
                    }))
                  }
                >
                  <option value="">Any</option>
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="min_reviews">
                  Min reviews
                </label>
                <input
                  id="min_reviews"
                  type="number"
                  min={0}
                  className="input"
                  value={form.min_reviews}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, min_reviews: Number(e.target.value) || 0 }))
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="min_rating">
                  Min rating
                </label>
                <input
                  id="min_rating"
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  className="input"
                  value={form.min_rating}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, min_rating: Number(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>

            <div className="rounded-md bg-ink/5 p-3 text-xs text-muted">
              Filters applied before saving: skip if reviews &lt; {form.min_reviews}, rating
              &lt; {form.min_rating}, or the business already has a real website. Place IDs
              are deduped against existing leads.
            </div>

            {error ? (
              <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex justify-end">
              <button
                type="submit"
                className="btn-primary text-sm"
                disabled={submitting || !form.query.trim()}
              >
                {submitting ? "Starting…" : "Run scrape"}
              </button>
            </div>
          </form>

          <div className="mt-4 text-xs text-muted">
            Worker CPU time is finite; very long scrapes may timeout. The UI shows incremental
            progress and you can re-run — duplicates are auto-skipped.
          </div>
        </section>

        <aside className="col-span-12 lg:col-span-5">
          <div className="card">
            <h2 className="font-serif text-xl mb-3">Recent runs</h2>
            {recentRuns.length === 0 ? (
              <div className="text-sm text-muted">No scrapes yet.</div>
            ) : (
              <ul className="divide-y divide-ink/5">
                {recentRuns.map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/scrape/runs/${r.id}`}
                      className="block py-3 hover:bg-ink/[0.02] -mx-2 px-2 rounded"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-ink truncate max-w-[16rem]">
                          {r.query}
                        </span>
                        <RunBadge status={r.status} />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-muted">
                        <span>
                          {r.new_leads_added} new · {r.duplicates_skipped} dup
                        </span>
                        <span>{formatRelative(r.started_at)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </Layout>
  );
}

function RunBadge({ status }: { status: string }) {
  const cls =
    status === "completed"
      ? "bg-emerald-50 text-emerald-700"
      : status === "failed"
        ? "bg-red-50 text-red-700"
        : "bg-amber-50 text-amber-700 animate-pulse";
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${cls}`}>
      {status}
    </span>
  );
}
