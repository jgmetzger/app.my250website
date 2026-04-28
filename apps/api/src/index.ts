import { Hono } from "hono";
import type { AppBindings } from "./env.js";
import { requireAuth } from "./middleware/auth.js";
import { authRoutes } from "./routes/auth.js";
import { callsRoutes } from "./routes/calls.js";
import { emailRoutes } from "./routes/email.js";
import { leadsRoutes } from "./routes/leads.js";
import { scrapeRoutes } from "./routes/scrape.js";
import { statsRoutes } from "./routes/stats.js";
import { webhookRoutes } from "./routes/webhooks.js";

const app = new Hono<AppBindings>();

// Health check — handy for uptime probes.
app.get("/api/health", (c) => c.json({ ok: true, ts: Date.now() }));

// Public auth + webhooks (Twilio/Resend sign their own requests; we verify in phase 4+).
app.route("/api/auth", authRoutes);
app.route("/api/webhooks", webhookRoutes);

// Everything else requires a valid session cookie.
app.use("/api/leads/*", requireAuth);
app.use("/api/scrape/*", requireAuth);
app.use("/api/email/*", requireAuth);
app.use("/api/calls/*", requireAuth);
app.use("/api/stats/*", requireAuth);

app.route("/api/leads", leadsRoutes);
app.route("/api/scrape", scrapeRoutes);
app.route("/api/email", emailRoutes);
app.route("/api/calls", callsRoutes);
app.route("/api/stats", statsRoutes);

app.onError((err, c) => {
  console.error("worker error", err);
  return c.json({ error: "internal_error", message: err.message }, 500);
});

app.notFound((c) => c.json({ error: "not_found", path: new URL(c.req.url).pathname }, 404));

export default app;
