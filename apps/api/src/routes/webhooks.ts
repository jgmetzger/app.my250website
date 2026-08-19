import { Hono } from "hono";
import type { AppBindings } from "../env.js";
import { insertActivity } from "../repos/activities.js";
import { extractTag, mapResendEvent } from "../lib/resend_events.js";
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
    // Resend webhook. Contract with Resend/Svix: answer 2xx fast, every time
    // the request is authentic — continuous non-2xx responses get the
    // endpoint disabled in the Resend dashboard. So after signature
    // verification, NOTHING may turn into a non-2xx: unknown event types,
    // schema surprises, and DB failures are logged and acked.
    //
    // Payload (shape has drifted across Resend versions — parse defensively):
    //   { type: 'email.delivered'|'email.opened'|...,
    //     data: { email_id, to, subject,
    //             tags: [{name,value}]  <- old shape
    //                 | {lead_id:"5"} } } <- new shape
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

    try {
      const payload = JSON.parse(rawBody) as ResendWebhookPayload;
      const eventType = payload?.type;
      const data = payload?.data;

      const activityType = mapResendEvent(eventType);
      if (!activityType) {
        console.log("resend webhook: ignoring event type", eventType ?? "(none)");
        return c.json({ ok: true, ignored: true });
      }

      const leadIdTag = extractTag(data?.tags, "lead_id");
      const leadId = leadIdTag ? Number(leadIdTag) : NaN;
      if (!Number.isInteger(leadId) || leadId <= 0) {
        console.log("resend webhook: no lead_id tag on", eventType);
        return c.json({ ok: true, ignored: true });
      }

      await insertActivity(c.env.DB, {
        lead_id: leadId,
        type: activityType,
        direction: "outbound",
        subject: typeof data?.subject === "string" ? data.subject : null,
        metadata: {
          resend_id: typeof data?.email_id === "string" ? data.email_id : undefined,
          event: eventType,
        },
      });
      return c.json({ ok: true });
    } catch (err) {
      // Ack anyway — a processing bug on our side must not disable the
      // endpoint. The event is in the logs for replay/diagnosis.
      console.error("resend webhook: processing failed", err, rawBody.slice(0, 500));
      return c.json({ ok: true, ignored: true, error: "processing_failed" });
    }
  });

interface ResendWebhookPayload {
  type?: string;
  data?: {
    email_id?: unknown;
    to?: unknown;
    subject?: unknown;
    tags?: unknown;
  };
}
