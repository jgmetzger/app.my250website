import { Hono } from "hono";
import type { AppBindings } from "../env.js";

// Public routes — verify Twilio signature / Resend secret in phase 4 + 5.
// Twilio voice webhook must return TwiML XML.

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
    return c.json({ ok: true });
  });
