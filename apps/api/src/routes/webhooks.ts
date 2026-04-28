import { Hono } from "hono";
import type { AppBindings } from "../env.js";
import { insertActivity } from "../repos/activities.js";
import type { ActivityType } from "@app/shared";
import { verifyResendWebhook } from "../lib/resend_signature.js";
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
  // Workers FormData supports forEach but not iterators on every type version.
  form.forEach((v, k) => {
    out[k] = typeof v === "string" ? v : "";
  });
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
    //
    // We must read the body as text for signature verification, then parse JSON.
    const rawBody = await c.req.text();
    if (c.env.RESEND_WEBHOOK_SECRET) {
      const ok = await verifyResendWebhook({
        rawBody,
        svixId: c.req.header("svix-id") ?? null,
        svixTimestamp: c.req.header("svix-timestamp") ?? null,
        svixSignature: c.req.header("svix-signature") ?? null,
        secret: c.env.RESEND_WEBHOOK_SECRET,
      });
      if (!ok) return new Response("forbidden", { status: 403 });
    }
    // If the secret is not set, we accept unsigned payloads — same behaviour as
    // before. Set RESEND_WEBHOOK_SECRET to enable verification.

    let payload: ResendWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as ResendWebhookPayload;
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
