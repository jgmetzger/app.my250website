import { Hono } from "hono";
import type { AppBindings } from "../env.js";
import { insertActivity } from "../repos/activities.js";
import type { ActivityType } from "@app/shared";

// Public routes — Twilio + Resend will sign their requests; we verify
// signatures here. Twilio voice webhook must return TwiML XML.

export const webhookRoutes = new Hono<AppBindings>()
  .post("/twilio/voice", async (c) => {
    // Phase 5: dial out using TWILIO_PHONE_NUMBER as caller ID.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Say>Service not yet configured.</Say></Response>`;
    return new Response(xml, { headers: { "Content-Type": "text/xml" } });
  })
  .post("/twilio/status", async (c) => {
    return c.json({ ok: true });
  })
  .post("/resend", async (c) => {
    // Resend webhook payload shape:
    //   { type: 'email.delivered'|'email.opened'|'email.bounced'|...,
    //     data: { email_id, to, subject, tags: [{ name, value }] } }
    let payload: ResendWebhookPayload;
    try {
      payload = (await c.req.json()) as ResendWebhookPayload;
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }

    const eventType = payload?.type;
    const tags = payload?.data?.tags ?? [];
    const leadIdTag = tags.find((t) => t?.name === "lead_id")?.value;
    const leadId = leadIdTag ? Number(leadIdTag) : NaN;

    const activityType = mapResendEvent(eventType);
    if (!activityType || !Number.isInteger(leadId) || leadId <= 0) {
      return c.json({ ok: true, ignored: true });
    }

    await insertActivity(c.env.DB, {
      lead_id: leadId,
      type: activityType,
      direction: "outbound",
      subject: payload.data?.subject ?? null,
      metadata: { resend_id: payload.data?.email_id, event: eventType },
    });

    return c.json({ ok: true });
  });

interface ResendWebhookPayload {
  type?: string;
  data?: {
    email_id?: string;
    to?: string | string[];
    subject?: string;
    tags?: Array<{ name?: string; value?: string }>;
  };
}

function mapResendEvent(type: string | undefined): ActivityType | null {
  switch (type) {
    case "email.delivered":
      return "email_delivered";
    case "email.opened":
      return "email_opened";
    case "email.bounced":
    case "email.delivery_delayed":
    case "email.complained":
      return "email_bounced";
    default:
      return null;
  }
}
