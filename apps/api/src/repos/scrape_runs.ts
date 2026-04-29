import type { ScrapeRun, ScrapeRunStatus } from "@app/shared";
import { many, one } from "../lib/db.js";

export interface CreateScrapeRunInput {
  query: string;
  city: string | null;
  business_type: string | null;
}

export async function createScrapeRun(
  db: D1Database,
  input: CreateScrapeRunInput,
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO scrape_runs (query, city, business_type, status)
       VALUES (?, ?, ?, 'running')`,
    )
    .bind(input.query, input.city, input.business_type)
    .run();
  return Number(result.meta.last_row_id);
}

export async function getScrapeRun(db: D1Database, id: number): Promise<ScrapeRun | null> {
  return one<ScrapeRun>(db.prepare(`SELECT * FROM scrape_runs WHERE id = ?`).bind(id));
}

export async function listScrapeRuns(db: D1Database, limit = 20): Promise<ScrapeRun[]> {
  return many<ScrapeRun>(
    db.prepare(`SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT ?`).bind(limit),
  );
}

export async function updateScrapeRunProgress(
  db: D1Database,
  id: number,
  patch: { results_found?: number; new_leads_added?: number; duplicates_skipped?: number },
): Promise<void> {
  const fragments: string[] = [];
  const args: unknown[] = [];
  if (patch.results_found != null) {
    fragments.push("results_found = ?");
    args.push(patch.results_found);
  }
  if (patch.new_leads_added != null) {
    fragments.push("new_leads_added = ?");
    args.push(patch.new_leads_added);
  }
  if (patch.duplicates_skipped != null) {
    fragments.push("duplicates_skipped = ?");
    args.push(patch.duplicates_skipped);
  }
  if (fragments.length === 0) return;
  args.push(id);
  await db
    .prepare(`UPDATE scrape_runs SET ${fragments.join(", ")} WHERE id = ?`)
    .bind(...args)
    .run();
}

export async function finishScrapeRun(
  db: D1Database,
  id: number,
  status: Exclude<ScrapeRunStatus, "running">,
  errorMessage?: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE scrape_runs
         SET status = ?, error_message = ?, completed_at = unixepoch()
       WHERE id = ?`,
    )
    .bind(status, errorMessage ?? null, id)
    .run();
}
