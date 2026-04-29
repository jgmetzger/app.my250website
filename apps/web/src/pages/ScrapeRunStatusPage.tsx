import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ScrapeRun } from "@app/shared";
import { Layout } from "../components/Layout.js";
import { api } from "../lib/api.js";
import { formatDateTime, formatRelative } from "../lib/format.js";

interface RunResponse {
  run: ScrapeRun;
}

export function ScrapeRunStatusPage() {
  const { id } = useParams<{ id: string }>();
  const runId = Number(id);
  const [run, setRun] = useState<ScrapeRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    let timer: number | undefined;

    async function tick() {
      if (stoppedRef.current) return;
      try {
        const r = await api.get<RunResponse>(`/api/scrape/runs/${runId}`);
        setRun(r.run);
        if (r.run.status === "running") {
          timer = window.setTimeout(tick, 3000);
        } else {
          stoppedRef.current = true;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load run");
        stoppedRef.current = true;
      }
    }
    tick();
    return () => {
      stoppedRef.current = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [runId]);

  if (error) {
    return (
      <Layout>
        <div className="card">
          <p className="text-red-700">{error}</p>
          <Link to="/scrape" className="btn-secondary text-sm mt-4">
            ← Back to scrape
          </Link>
        </div>
      </Layout>
    );
  }
  if (!run) {
    return <Layout><div className="text-muted">Loading run…</div></Layout>;
  }

  const isRunning = run.status === "running";
  const isFailed = run.status === "failed";
  const isCompleted = run.status === "completed";

  return (
    <Layout>
      <header className="mb-6">
        <Link to="/scrape" className="text-xs text-muted hover:underline">
          ← All runs
        </Link>
        <h1 className="font-serif text-3xl mt-1 break-words">
          <span className="italic">{run.query}</span>
        </h1>
        <p className="text-sm text-muted mt-1">
          Started {formatRelative(run.started_at)}{" "}
          {run.completed_at ? `· finished ${formatRelative(run.completed_at)}` : null}
        </p>
      </header>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Results found" value={run.results_found} hi={isRunning} />
        <Stat label="New leads" value={run.new_leads_added} hi={false} />
        <Stat label="Duplicates skipped" value={run.duplicates_skipped} hi={false} />
      </div>

      <div className="card mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Status</span>
          <span
            className={`text-sm font-medium ${
              isCompleted
                ? "text-emerald-700"
                : isFailed
                  ? "text-red-700"
                  : "text-amber-700"
            }`}
          >
            {isRunning ? "Running…" : run.status}
          </span>
        </div>
        {isRunning ? (
          <div className="mt-3 h-1 w-full overflow-hidden rounded bg-ink/5">
            <div className="h-full w-1/3 animate-pulse bg-accent" />
          </div>
        ) : null}
        {run.error_message ? (
          <pre className="mt-3 whitespace-pre-wrap rounded-md bg-red-50 p-3 text-xs text-red-800">
            {run.error_message}
          </pre>
        ) : null}
      </div>

      <div className="card text-xs text-muted space-y-1">
        <div>Run id: #{run.id}</div>
        {run.city ? <div>City: {run.city}</div> : null}
        {run.business_type ? <div>Type: {run.business_type}</div> : null}
        <div>Started: {formatDateTime(run.started_at)}</div>
        {run.completed_at ? <div>Finished: {formatDateTime(run.completed_at)}</div> : null}
      </div>

      {isCompleted ? (
        <div className="mt-6">
          <Link to="/leads" className="btn-primary text-sm">
            View added leads →
          </Link>
        </div>
      ) : null}
      {isFailed ? (
        <div className="mt-6">
          <Link to="/scrape" className="btn-secondary text-sm">
            Try again with different filters
          </Link>
        </div>
      ) : null}
    </Layout>
  );
}

function Stat({ label, value, hi }: { label: string; value: number; hi: boolean }) {
  return (
    <div className={`card ${hi ? "ring-1 ring-accent" : ""}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="font-serif text-3xl mt-1">{value.toLocaleString()}</div>
    </div>
  );
}
