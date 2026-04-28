import { Hono } from "hono";
import { EmailTemplateInput, SendEmailInput } from "@app/shared";
import type { AppBindings } from "../env.js";

export const emailRoutes = new Hono<AppBindings>()
  .get("/templates", async (c) => {
    return c.json({ error: "not_implemented", phase: 4 }, 501);
  })
  .post("/templates", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = EmailTemplateInput.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
    return c.json({ error: "not_implemented", phase: 4 }, 501);
  })
  .put("/templates/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid_id" }, 400);
    const body = await c.req.json().catch(() => ({}));
    const parsed = EmailTemplateInput.partial().safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
    return c.json({ error: "not_implemented", phase: 4 }, 501);
  })
  .delete("/templates/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid_id" }, 400);
    return c.json({ error: "not_implemented", phase: 4 }, 501);
  })
  .post("/send", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = SendEmailInput.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
    return c.json({ error: "not_implemented", phase: 4 }, 501);
  });
