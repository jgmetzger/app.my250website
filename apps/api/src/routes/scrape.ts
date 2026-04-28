import { Hono } from "hono";
import { ScrapeRunInput } from "@app/shared";
import type { AppBindings } from "../env.js";
import {
  createScrapeRun,
  getScrapeRun,
  listScrapeRuns,
} from "../repos/scrape_runs.js";
import { runScrape } from "../scrape/run.js";

export const scrapeRoutes = new Hono<AppBindings>()
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
  });
