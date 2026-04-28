import { useMemo, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout.js";
import { ApiError, api } from "../lib/api.js";

interface ImportSummary {
  total_rows: number;
  inserted: number;
  error_count: number;
  errors: Array<{ row: number; message: string }>;
}

const SUPPORTED_COLUMNS = [
  "business_name (required)",
  "business_type",
  "address",
  "city",
  "region",
  "postcode",
  "country",
  "phone",
  "website_url",
  "google_rating",
  "google_review_count",
  "email",
  "email_source",
  "notes",
];

export function ImportLeadsPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setError(null);
    if (!f) {
      setCsvText("");
      return;
    }
    f.text().then((t) => setCsvText(t));
  }

  const preview = useMemo(() => {
    if (!csvText) return null;
    const lines = csvText.split(/\r?\n/).slice(0, 11);
    return lines;
  }, [csvText]);

  async function submit() {
    if (!file) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/leads/import-csv", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      const json = (await res.json()) as ImportSummary | { error: string };
      if (!res.ok) {
        throw new ApiError(res.status, "error" in json ? json.error : `http_${res.status}`);
      }
      setResult(json as ImportSummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <header className="mb-6">
        <Link to="/leads" className="text-xs text-muted hover:underline">
          ← All leads
        </Link>
        <h1 className="font-serif text-3xl mt-1">
          <span className="italic">Import leads from CSV</span>
        </h1>
        <p className="text-sm text-muted mt-1">
          Bulk-add leads you've already collected. Rows that fail validation are
          listed below; the rest are inserted.
        </p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-7 space-y-4">
          <div className="card space-y-3">
            <label className="label" htmlFor="csv">
              CSV file
            </label>
            <input
              id="csv"
              type="file"
              accept=".csv,text/csv"
              onChange={onFile}
              className="block w-full text-sm"
            />
            {file ? (
              <div className="text-xs text-muted">
                {file.name} · {(file.size / 1024).toFixed(1)} KB
              </div>
            ) : null}
            {preview ? (
              <div className="rounded-md bg-ink/5 p-3">
                <div className="text-xs text-muted mb-1">First 10 rows</div>
                <pre className="overflow-x-auto whitespace-pre text-xs">
                  {preview.join("\n")}
                </pre>
              </div>
            ) : null}
            {error ? (
              <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Link to="/leads" className="btn-secondary text-sm">
                Cancel
              </Link>
              <button
                onClick={submit}
                disabled={!file || submitting}
                className="btn-primary text-sm"
              >
                {submitting ? "Importing…" : "Import"}
              </button>
            </div>
          </div>

          {result ? (
            <div className="card space-y-3">
              <h2 className="font-serif text-xl">Import complete</h2>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Rows" value={result.total_rows} />
                <Stat label="Inserted" value={result.inserted} />
                <Stat
                  label="Errors"
                  value={result.error_count}
                  highlight={result.error_count > 0}
                />
              </div>
              {result.errors.length > 0 ? (
                <details>
                  <summary className="text-sm cursor-pointer text-muted">
                    {result.error_count > 50
                      ? `First 50 of ${result.error_count} errors`
                      : `${result.error_count} errors`}
                  </summary>
                  <ul className="mt-2 max-h-72 overflow-y-auto text-xs space-y-1">
                    {result.errors.map((e, i) => (
                      <li key={i} className="rounded bg-red-50 px-2 py-1 text-red-800">
                        Row {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <button onClick={() => navigate("/leads")} className="btn-primary text-sm">
                View leads →
              </button>
            </div>
          ) : null}
        </section>

        <aside className="col-span-12 lg:col-span-5">
          <div className="card">
            <h2 className="font-serif text-xl mb-3">Supported columns</h2>
            <ul className="text-sm space-y-1">
              {SUPPORTED_COLUMNS.map((c) => (
                <li key={c}>
                  <code className="rounded bg-ink/5 px-1 text-xs">{c}</code>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted">
              Header row required. Unknown columns are ignored. Empty cells leave
              the corresponding field unset (defaults applied).
            </p>
          </div>
        </aside>
      </div>
    </Layout>
  );
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
    <div className={`rounded-md border ${highlight ? "border-red-300 bg-red-50" : "border-ink/10"} p-3`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="font-serif text-2xl mt-1">{value.toLocaleString()}</div>
    </div>
  );
}
