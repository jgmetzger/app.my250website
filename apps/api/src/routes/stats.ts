import { Hono } from "hono";
import type { AppBindings } from "../env.js";

export const statsRoutes = new Hono<AppBindings>().get("/dashboard", async (c) => {
  return c.json({ error: "not_implemented", phase: 6 }, 501);
});
