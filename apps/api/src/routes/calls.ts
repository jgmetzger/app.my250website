import { Hono } from "hono";
import { CallLogInput } from "@app/shared";
import type { AppBindings } from "../env.js";
import { insertActivity } from "../repos/activities.js";
import { getLeadById, updateLead } from "../repos/leads.js";
import { makeTwilioAccessToken } from "../lib/twilio_token.js";

export const callsRoutes = new Hono<AppBindings>()
  .get("/token", async (c) => {
    const e = c.env;
    if (
      !e.TWILIO_ACCOUNT_SID ||
      !e.TWILIO_API_KEY ||
      !e.TWILIO_API_SECRET ||
      !e.TWILIO_TWIML_APP_SID
    ) {
      return c.json({ error: "twilio_not_configured" }, 503);
    }
    const token = await makeTwilioAccessToken({
      accountSid: e.TWILIO_ACCOUNT_SID,
      apiKey: e.TWILIO_API_KEY,
      apiSecret: e.TWILIO_API_SECRET,
      identity: "james",
      outgoingApplicationSid: e.TWILIO_TWIML_APP_SID,
      ttlSeconds: 60 * 60,
    });
    return c.json({ token, identity: "james", expires_in: 3600 });
  })

  .post("/log", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = CallLogInput.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_input", issues: parsed.error.issues }, 400);
    }
    const lead = await getLeadById(c.env.DB, parsed.data.lead_id);
    if (!lead) return c.json({ error: "lead_not_found" }, 404);

    await insertActivity(c.env.DB, {
      lead_id: parsed.data.lead_id,
      type: "call_made",
      direction: "outbound",
      duration_seconds: parsed.data.duration_seconds,
      outcome: parsed.data.outcome,
      body: parsed.data.notes ?? null,
    });

    // Auto-bumps:
    //  - any first contact (researched -> contacted)
    //  - "interested" outcome -> replied
    if (lead.status === "researched") {
      await updateLead(c.env.DB, lead.id, { status: "contacted" });
      await insertActivity(c.env.DB, {
        lead_id: lead.id,
        type: "status_change",
        body: "Status: researched → contacted (auto, first call)",
        metadata: { from: "researched", to: "contacted", auto: true },
      });
    }
    if (parsed.data.outcome === "interested" && lead.status !== "replied") {
      await updateLead(c.env.DB, lead.id, { status: "replied" });
      await insertActivity(c.env.DB, {
        lead_id: lead.id,
        type: "status_change",
        body: `Status: ${lead.status} → replied (auto, "interested" call)`,
        metadata: { from: lead.status, to: "replied", auto: true },
      });
    }

    return c.json({ ok: true });
  });
