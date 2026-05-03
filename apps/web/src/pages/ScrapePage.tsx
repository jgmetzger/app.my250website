import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BUSINESS_TYPES, type BusinessType, type ScrapeRun } from "@app/shared";
import { Layout } from "../components/Layout.js";
import { api } from "../lib/api.js";
import { capitalize, formatRelative } from "../lib/format.js";

interface ScrapeRunResponse {
  run_id: number;
}
interface RunsResponse {
  runs: ScrapeRun[];
}

const RECENT_LIMIT = 8;

type Mode = "query" | "parts";

export function ScrapePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("query");
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

  async function refreshRuns() {
    try {
      const r = await api.get<RunsResponse>("/api/scrape/runs");
      setRecentRuns(r.runs);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refreshRuns();
  }, []);

  const partsQueryPreview =
    form.business_type && form.city
      ? `${form.business_type}s in ${form.city.trim()}`
      : form.business_type
        ? `${form.business_type}s`
        : form.city
          ? `${form.city.trim()}`
          : "";

  function effectiveQuery(): string {
    return mode === "query" ? form.query.trim() : partsQueryPreview;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const query = effectiveQuery();
    if (!query) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        query,
        min_reviews: form.min_reviews,
        min_rating: form.min_rating,
      };
      if (mode === "parts") {
        if (form.city.trim()) payload.city = form.city.trim();
        if (form.business_type) payload.business_type = form.business_type;
      }
      const r = await api.post<ScrapeRunResponse>("/api/scrape/run", payload);
      navigate(`/scrape/runs/${r.run_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scrape failed to start");
    } finally {
      setSubmitting(false);
    }
  }

  async function stopRun(id: number) {
    if (!confirm("Force-stop this run? It will be marked failed.")) return;
    try {
      await api.post(`/api/scrape/runs/${id}/cancel`, {});
      await refreshRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stop failed");
    }
  }

  async function deleteRun(id: number) {
    if (!confirm("Delete this run from history?")) return;
    try {
      await api.delete(`/api/scrape/runs/${id}`);
      await refreshRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function clearFinished() {
    if (!confirm("Clear all completed and failed runs from history?")) return;
    try {
      await api.delete("/api/scrape/runs");
      await refreshRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clear failed");
    }
  }

  const visibleRuns = recentRuns.slice(0, RECENT_LIMIT);
  const hasFinished = recentRuns.some(
    (r) => r.status === "completed" || r.status === "failed",
  );

  return (
    <Layout>
      <header className="mb-6">
        <h1 className="font-serif text-3xl">
          <span className="italic">Find leads</span>
        </h1>
        <p className="text-sm text-muted mt-1">
          Google Places search — applies your filters and dedupes against existing leads.
        </p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-7">
          <form onSubmit={onSubmit} className="card space-y-4">
            <div className="flex gap-1 rounded-md bg-ink/5 p-1 text-xs">
              <button
                type="button"
                className={`flex-1 rounded px-3 py-1.5 transition ${
                  mode === "query"
                    ? "bg-cream text-ink shadow-sm"
                    : "text-ink/60 hover:text-ink"
                }`}
                onClick={() => setMode("query")}
              >
                Free-text query
              </button>
              <button
                type="button"
                className={`flex-1 rounded px-3 py-1.5 transition ${
                  mode === "parts"
                    ? "bg-cream text-ink shadow-sm"
                    : "text-ink/60 hover:text-ink"
                }`}
                onClick={() => setMode("parts")}
              >
                Build from parts
              </button>
            </div>

            {mode === "query" ? (
              <div>
                <label className="label" htmlFor="query">
                  Query *
                </label>
                <input
                  id="query"
                  className="input"
                  required
                  autoFocus
                  placeholder='e.g. "village pubs in Cotswolds" or "independent cafes Devon"'
                  value={form.query}
                  onChange={(e) => setForm((f) => ({ ...f, query: e.target.value }))}
                />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="business_type">
                      Business type *
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
                      <option value="">— pick type —</option>
                      {BUSINESS_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {capitalize(t)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="city">
                      Location *
                    </label>
                    <input
                      id="city"
                      className="input"
                      placeholder="Brighton, Cumbria, etc."
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    />
                  </div>
                </div>
                {partsQueryPreview ? (
                  <div className="text-xs text-muted">
                    Will search: <span className="font-mono text-ink">{partsQueryPreview}</span>
                  </div>
                ) : null}
              </>
            )}

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
                disabled={submitting || !effectiveQuery()}
              >
                {submitting ? "Starting…" : "Run scrape"}
              </button>
            </div>
          </form>
        </section>

        <aside className="col-span-12 lg:col-span-5">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-xl">Recent runs</h2>
              {hasFinished ? (
                <button
                  onClick={clearFinished}
                  className="text-xs text-ink/60 hover:text-ink underline"
                  title="Remove completed and failed runs from history"
                >
                  Clear history
                </button>
              ) : null}
            </div>
            {visibleRuns.length === 0 ? (
              <div className="text-sm text-muted">No scrapes yet.</div>
            ) : (
              <ul className="divide-y divide-ink/5">
                {visibleRuns.map((r) => (
                  <li key={r.id} className="group">
                    <div className="flex items-stretch">
                      <Link
                        to={`/scrape/runs/${r.id}`}
                        className="flex-1 block py-3 hover:bg-ink/[0.02] -mx-2 px-2 rounded"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-ink truncate max-w-[14rem]">
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
                      <div className="flex flex-col justify-center pl-2 gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                        {r.status === "running" ? (
                          <button
                            onClick={() => stopRun(r.id)}
                            className="text-xs text-amber-700 hover:underline"
                            title="Force-stop this run (mark it failed)"
                          >
                            Stop
                          </button>
                        ) : null}
                        <button
                          onClick={() => deleteRun(r.id)}
                          className="text-xs text-red-700 hover:underline"
                          title="Delete this run from history"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {recentRuns.length > RECENT_LIMIT ? (
              <div className="mt-3 text-xs text-muted">
                Showing latest {RECENT_LIMIT} of {recentRuns.length}.
              </div>
            ) : null}
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
