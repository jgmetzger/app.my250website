import { Hono } from "hono";
import type { AppBindings } from "../env.js";
import { getDashboardStats, listRecentActivity } from "../repos/stats.js";

export const statsRoutes = new Hono<AppBindings>().get("/dashboard", async (c) => {
  const cap = Number(c.env.DAILY_EMAIL_CAP) || 15;
  const [stats, recent] = await Promise.all([
    getDashboardStats(c.env.DB, cap),
    listRecentActivity(c.env.DB, 20),
  ]);
  return c.json({ stats, recent_activity: recent });
});
