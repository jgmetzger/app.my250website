import { Hono } from "hono";
import { LeadListQuery, LeadUpdate, NoteInput, StatusChangeInput } from "@app/shared";
import type { AppBindings } from "../env.js";

// Phase 2 will fill these in. Routes are wired up so the frontend can already
// negotiate shape — they all return 501 for now.

export const leadsRoutes = new Hono<AppBindings>()
  .get("/", async (c) => {
    const parsed = LeadListQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
    if (!parsed.success) return c.json({ error: "invalid_query" }, 400);
    return c.json({ error: "not_implemented", phase: 2 }, 501);
  })
  .get("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid_id" }, 400);
    return c.json({ error: "not_implemented", phase: 2 }, 501);
  })
  .patch("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid_id" }, 400);
    const body = await c.req.json().catch(() => ({}));
    const parsed = LeadUpdate.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.issues }, 400);
    return c.json({ error: "not_implemented", phase: 2 }, 501);
  })
  .delete("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid_id" }, 400);
    return c.json({ error: "not_implemented", phase: 2 }, 501);
  })
  .post("/:id/status", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = StatusChangeInput.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
    return c.json({ error: "not_implemented", phase: 2 }, 501);
  })
  .post("/:id/note", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = NoteInput.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
    return c.json({ error: "not_implemented", phase: 2 }, 501);
  })
  .post("/import-csv", async (c) => {
    return c.json({ error: "not_implemented", phase: 7 }, 501);
  });
