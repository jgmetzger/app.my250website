import { Hono } from "hono";
import { CallLogInput } from "@app/shared";
import type { AppBindings } from "../env.js";

export const callsRoutes = new Hono<AppBindings>()
  .get("/token", async (c) => {
    return c.json({ error: "not_implemented", phase: 5 }, 501);
  })
  .post("/log", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = CallLogInput.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
    return c.json({ error: "not_implemented", phase: 5 }, 501);
  });
