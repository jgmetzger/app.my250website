import { Hono } from "hono";
import { ScrapeRunInput } from "@app/shared";
import type { AppBindings } from "../env.js";

export const scrapeRoutes = new Hono<AppBindings>()
  .post("/run", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = ScrapeRunInput.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
    return c.json({ error: "not_implemented", phase: 3 }, 501);
  })
  .get("/runs", async (c) => {
    return c.json({ error: "not_implemented", phase: 3 }, 501);
  })
  .get("/runs/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid_id" }, 400);
    return c.json({ error: "not_implemented", phase: 3 }, 501);
  });
