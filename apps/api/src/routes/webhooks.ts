import { Hono } from "hono";
import type { AppBindings } from "../env.js";
import { insertActivity } from "../repos/activities.js";
import type { ActivityType } from "@app/shared";
import { verifyTwilioSignature } from "../lib/twilio_signature.js";

// Public routes — Twilio + Resend sign their requests; we verify
// Twilio signatures on voice + status. Twilio voice webhook must return TwiML XML.

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function readForm(req: Request): Promise<Record<string, string>> {
  const form = await req.formData();
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) out[k] = typeof v === "string" ? v : "";
  return out;
}

export const webhookRoutes = new Hono<AppBindings>()
  .post("/twilio/voice", async (c) => {
    const params = await readForm(c.req.raw);
    const ok = await verifyTwilioSignature(
      c.env.TWILIO_AUTH_TOKEN,
      c.req.url,
      params,
      c.req.header("x-twilio-signature") ?? null,
    );
    if (!ok) {
      return new Response("forbidden", { status: 403 });
    }

    // Browser SDK sends `To` as the dial target.
    const to = params.To ?? "";
    const callerId = c.env.TWILIO_PHONE_NUMBER;
    if (!to || !callerId) {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Say>Missing target number.</Say></Response>`;
      return new Response(xml, { headers: { "Content-Type": "text/xml" } });
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Dial callerId="${escapeXml(callerId)}" answerOnBridge="true"><Number>${escapeXml(to)}</Number></Dial></Response>`;
    return new Response(xml, { headers: { "Content-Type": "text/xml" } });
  })
  .post("/twilio/status", async (c) => {
    const params = await readForm(c.req.raw);
    const ok = await verifyTwilioSignature(
      c.env.TWILIO_AUTH_TOKEN,
      c.req.url,
      params,
      c.req.header("x-twilio-signature") ?? null,
    );
    if (!ok) return new Response("forbidden", { status: 403 });
    // We log call activities client-side after the call ends; Twilio status
    // callbacks just confirm the call lifecycle. Nothing to persist here.
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
