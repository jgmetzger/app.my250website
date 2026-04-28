import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  LEAD_STATUSES,
  WEBSITE_STATUSES,
  type Lead,
  type LeadStatus,
  type WebsiteStatus,
} from "@app/shared";
import { Layout } from "../components/Layout.js";
import { StatusBadge, WebsiteBadge } from "../components/Badge.js";
import { api } from "../lib/api.js";
import { formatRelative } from "../lib/format.js";

interface ListResponse {
  leads: Array<Lead & { last_activity_at: number | null }>;
  total: number;
  page: number;
  limit: number;
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

const WEBSITE_LABEL: Record<WebsiteStatus, string> = {
  none: "No website",
  real: "Has website",
  instagram: "Instagram only",
  facebook: "Facebook only",
  tiktok: "TikTok only",
  twitter: "X / Twitter only",
  linktree: "Linktree",
  other_social: "Other social only",
};

export function LeadsListPage() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cities, setCities] = useState<string[]>([]);

  const selectedStatuses = useMemo(
    () => params.get("status")?.split(",").filter(Boolean) ?? [],
    [params],
  );
  const selectedWebsiteStatuses = useMemo(
    () => params.get("website_status")?.split(",").filter(Boolean) ?? [],
    [params],
  );
  const city = params.get("city") ?? "";
  const search = params.get("search") ?? "";
  const page = Number(params.get("page") ?? 1);

  useEffect(() => {
    api.get<{ cities: string[] }>("/api/leads/cities").then((r) => setCities(r.cities)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (selectedStatuses.length) qs.set("status", selectedStatuses.join(","));
    if (selectedWebsiteStatuses.length) qs.set("website_status", selectedWebsiteStatuses.join(","));
    if (city) qs.set("city", city);
    if (search) qs.set("search", search);
    qs.set("page", String(page));
    qs.set("limit", "50");

    api
      .get<ListResponse>(`/api/leads?${qs}`)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedStatuses.join(","), selectedWebsiteStatuses.join(","), city, search, page]);

  function toggle(arrName: "status" | "website_status", value: string) {
    const current = (params.get(arrName) ?? "").split(",").filter(Boolean);
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    const np = new URLSearchParams(params);
    if (next.length) np.set(arrName, next.join(","));
    else np.delete(arrName);
    np.delete("page");
    setParams(np);
  }

  function setSingle(name: string, value: string) {
    const np = new URLSearchParams(params);
    if (value) np.set(name, value);
    else np.delete(name);
    np.delete("page");
    setParams(np);
  }

  function gotoPage(p: number) {
    const np = new URLSearchParams(params);
    np.set("page", String(p));
    setParams(np);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <Layout>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl">
            <span className="italic">Leads</span>
          </h1>
          <p className="text-sm text-muted mt-1">
            {data ? `${data.total.toLocaleString()} total` : "Loading…"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/leads/import" className="btn-secondary text-sm">
            Import CSV
          </Link>
          <Link to="/leads/new" className="btn-primary text-sm">
            + Add lead manually
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-12 md:col-span-3 space-y-5">
          <div>
            <label className="label">Search</label>
            <input
              className="input"
              placeholder="name / phone / email"
              defaultValue={search}
              onBlur={(e) => setSingle("search", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setSingle("search", (e.target as HTMLInputElement).value);
              }}
            />
          </div>

          <div>
            <label className="label">City</label>
            <input
              list="cities"
              className="input"
              placeholder="Any city"
              defaultValue={city}
              onBlur={(e) => setSingle("city", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setSingle("city", (e.target as HTMLInputElement).value);
              }}
            />
            <datalist id="cities">
              {cities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <fieldset>
            <legend className="label">Status</legend>
            <div className="space-y-1">
              {LEAD_STATUSES.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(s)}
                    onChange={() => toggle("status", s)}
                  />
                  {STATUS_LABEL[s]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="label">Website</legend>
            <div className="space-y-1">
              {WEBSITE_STATUSES.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedWebsiteStatuses.includes(s)}
                    onChange={() => toggle("website_status", s)}
                  />
                  {WEBSITE_LABEL[s]}
                </label>
              ))}
            </div>
          </fieldset>

          {(selectedStatuses.length ||
            selectedWebsiteStatuses.length ||
            city ||
            search) ? (
            <button
              onClick={() => setParams(new URLSearchParams())}
              className="text-xs text-muted underline"
            >
              Clear all filters
            </button>
          ) : null}
        </aside>

        <section className="col-span-12 md:col-span-9">
          {error ? (
            <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {loading && !data ? (
            <div className="text-sm text-muted">Loading leads…</div>
          ) : data && data.leads.length === 0 ? (
            <div className="card text-center text-muted">
              No leads match these filters.
            </div>
          ) : data ? (
            <>
              <div className="card overflow-hidden p-0">
                <table className="w-full text-sm">
                  <thead className="bg-ink/5 text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3">Business</th>
                      <th className="px-4 py-3">City</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Website</th>
                      <th className="px-4 py-3">Rating</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Last activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leads.map((l) => (
                      <tr key={l.id} className="border-t border-ink/5 hover:bg-ink/[0.02]">
                        <td className="px-4 py-3">
                          <Link
                            to={`/leads/${l.id}`}
                            className="font-medium text-ink hover:underline"
                          >
                            {l.business_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted">{l.city ?? "—"}</td>
                        <td className="px-4 py-3 text-muted">{l.phone ?? "—"}</td>
                        <td className="px-4 py-3">
                          <WebsiteBadge status={l.website_status as WebsiteStatus | null} />
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {l.google_rating != null
                            ? `${l.google_rating.toFixed(1)} (${l.google_review_count ?? 0})`
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={l.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted">
                          {formatRelative(l.last_activity_at ?? l.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 ? (
                <div className="mt-4 flex items-center justify-between text-sm">
                  <button
                    className="btn-secondary text-xs"
                    disabled={page <= 1}
                    onClick={() => gotoPage(page - 1)}
                  >
                    ← Previous
                  </button>
                  <span className="text-muted">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    className="btn-secondary text-xs"
                    disabled={page >= totalPages}
                    onClick={() => gotoPage(page + 1)}
                  >
                    Next →
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </Layout>
  );
}
