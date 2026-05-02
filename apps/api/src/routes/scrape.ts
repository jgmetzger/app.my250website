import { Hono } from "hono";
import { ScrapeRunInput } from "@app/shared";
import type { AppBindings } from "../env.js";
import {
  cancelScrapeRun,
  clearFinishedScrapeRuns,
  createScrapeRun,
  deleteScrapeRun,
  getScrapeRun,
  listScrapeRuns,
} from "../repos/scrape_runs.js";
import { runScrape } from "../scrape/run.js";

export const scrapeRoutes = new Hono<AppBindings>()
  // Quick connectivity test: hits Places API with a tiny query and returns the
  // raw response so we can see exactly what Google says when scrape jobs hang.
  // Useful when a background runScrape silently dies and never writes a failure
  // row to D1. Authed (mounted under requireAuth in index.ts).
  .get("/probe", async (c) => {
    const key = c.env.GOOGLE_PLACES_API_KEY;
    if (!key) {
      return c.json({ ok: false, where: "secret_check", error: "GOOGLE_PLACES_API_KEY not set" }, 500);
    }
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "places.id,places.displayName",
        },
        body: JSON.stringify({ textQuery: "pubs in Bath", pageSize: 1 }),
      });
      const text = await res.text();
      return c.json({
        ok: res.ok,
        status: res.status,
        body_preview: text.slice(0, 1000),
      });
    } catch (err) {
      return c.json({
        ok: false,
        where: "fetch_threw",
        error: err instanceof Error ? err.message : String(err),
      }, 500);
    }
  })

  .post("/run", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = ScrapeRunInput.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_input", issues: parsed.error.issues }, 400);
    }
    const { query, city, business_type, min_reviews, min_rating } = parsed.data;

    const runId = await createScrapeRun(c.env.DB, {
      query,
      city: city ?? null,
      business_type: business_type ?? null,
    });

    // Hand off to background. Worker wall-clock is finite — long scrapes may not
    // finish in one go; the UI surfaces partial progress and the user can rerun.
    c.executionCtx.waitUntil(
      runScrape(c.env, {
        runId,
        query,
        city: city ?? null,
        business_type: business_type ?? null,
        min_reviews,
        min_rating,
      }),
    );

    return c.json({ run_id: runId }, 202);
  })

  .get("/runs", async (c) => {
    const runs = await listScrapeRuns(c.env.DB, 30);
    return c.json({ runs });
  })

  .get("/runs/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid_id" }, 400);
    const run = await getScrapeRun(c.env.DB, id);
    if (!run) return c.json({ error: "not_found" }, 404);
    return c.json({ run });
  })

  .post("/runs/:id/cancel", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid_id" }, 400);
    const cancelled = await cancelScrapeRun(c.env.DB, id);
    return c.json({ ok: true, cancelled });
  })

  .delete("/runs/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid_id" }, 400);
    const deleted = await deleteScrapeRun(c.env.DB, id);
    if (!deleted) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  })

  .delete("/runs", async (c) => {
    const removed = await clearFinishedScrapeRuns(c.env.DB);
    return c.json({ ok: true, removed });
  });
