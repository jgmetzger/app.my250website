import { Hono } from "hono";
import { SmsSendInput } from "@app/shared";
import type { AppBindings } from "../env.js";
import { insertActivity } from "../repos/activities.js";
import { getLeadById, updateLead } from "../repos/leads.js";

export const smsRoutes = new Hono<AppBindings>().post("/send", async (c) => {
  const e = c.env;
  if (!e.TWILIO_ACCOUNT_SID || !e.TWILIO_AUTH_TOKEN || !e.TWILIO_PHONE_NUMBER) {
    return c.json({ error: "twilio_sms_not_configured" }, 503);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = SmsSendInput.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid_input", issues: parsed.error.issues }, 400);
  }

  const lead = await getLeadById(c.env.DB, parsed.data.lead_id);
  if (!lead) return c.json({ error: "lead_not_found" }, 404);
  if (!lead.phone) return c.json({ error: "lead_has_no_phone" }, 400);

  // Twilio expects application/x-www-form-urlencoded for /Messages.
  const form = new URLSearchParams();
  form.set("From", e.TWILIO_PHONE_NUMBER);
  form.set("To", lead.phone);
  form.set("Body", parsed.data.body);

  const auth = btoa(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`);
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${e.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return c.json(
      { error: "send_failed", status: res.status, detail: detail.slice(0, 300) },
      502,
    );
  }
  const result = (await res.json().catch(() => ({}))) as { sid?: string };

  await insertActivity(c.env.DB, {
    lead_id: lead.id,
    type: "sms_sent",
    direction: "outbound",
    body: parsed.data.body,
    metadata: { twilio_sid: result.sid, to: lead.phone },
  });

  // Auto-bump status: researched -> contacted on first SMS.
  if (lead.status === "researched") {
    await updateLead(c.env.DB, lead.id, { status: "contacted" });
    await insertActivity(c.env.DB, {
      lead_id: lead.id,
      type: "status_change",
      body: "Status: researched → contacted (auto, first SMS)",
      metadata: { from: "researched", to: "contacted", auto: true },
    });
  }

  return c.json({ ok: true, twilio_sid: result.sid });
});
