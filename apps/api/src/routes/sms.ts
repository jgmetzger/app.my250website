import { Hono } from "hono";
import { SendSmsInput } from "@app/shared";
import type { AppBindings } from "../env.js";
import { insertActivity } from "../repos/activities.js";
import { getLeadById, updateLead } from "../repos/leads.js";
import { countryHint, normalizePhoneForSms } from "../lib/phone.js";
import { TwilioApiError, twilioSendSms } from "../lib/twilio_sms.js";

// SMS sending only needs the core Twilio credentials — NOT the API key /
// TwiML app the browser softphone uses. Keep the checks separate so a
// half-configured voice setup doesn't block SMS (and vice versa).
function missingSmsSecrets(e: {
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
}): string[] {
  const missing: string[] = [];
  if (!e.TWILIO_ACCOUNT_SID) missing.push("TWILIO_ACCOUNT_SID");
  if (!e.TWILIO_AUTH_TOKEN) missing.push("TWILIO_AUTH_TOKEN");
  if (!e.TWILIO_PHONE_NUMBER) missing.push("TWILIO_PHONE_NUMBER");
  return missing;
}

export const smsRoutes = new Hono<AppBindings>().post("/send", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = SendSmsInput.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid_input", issues: parsed.error.issues }, 400);
  }

  const missing = missingSmsSecrets(c.env);
  if (missing.length > 0) {
    return c.json(
      {
        error: "twilio_not_configured",
        message: `Missing Twilio secrets: ${missing.join(", ")}. Set each with \`wrangler secret put <NAME>\`.`,
      },
      503,
    );
  }

  const lead = await getLeadById(c.env.DB, parsed.data.lead_id);
  if (!lead) return c.json({ error: "lead_not_found" }, 404);

  const rawPhone = parsed.data.to_override ?? lead.phone;
  const phone = normalizePhoneForSms(rawPhone, countryHint(lead.country));
  if (!phone.ok) {
    const errorByReason = {
      empty: "lead_has_no_phone",
      landline: "landline_not_sms_capable",
      invalid: "invalid_phone_number",
    } as const;
    return c.json({ error: errorByReason[phone.reason], message: phone.detail }, 400);
  }

  let sid: string;
  try {
    const result = await twilioSendSms({
      accountSid: c.env.TWILIO_ACCOUNT_SID,
      authToken: c.env.TWILIO_AUTH_TOKEN,
      from: c.env.TWILIO_PHONE_NUMBER,
      to: phone.e164,
      body: parsed.data.body,
    });
    sid = result.sid;
  } catch (err) {
    if (err instanceof TwilioApiError) {
      const mapped = mapTwilioError(err);
      return c.json(mapped.body, mapped.status);
    }
    // Network-level failure reaching Twilio.
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: "twilio_unreachable", message }, 502);
  }

  await insertActivity(c.env.DB, {
    lead_id: lead.id,
    type: "sms_sent",
    direction: "outbound",
    body: parsed.data.body,
    metadata: { twilio_sid: sid, to: phone.e164 },
  });

  // Auto-bump status: researched -> contacted on first outreach (same as email/calls).
  if (lead.status === "researched") {
    await updateLead(c.env.DB, lead.id, { status: "contacted" });
    await insertActivity(c.env.DB, {
      lead_id: lead.id,
      type: "status_change",
      body: "Status: researched → contacted (auto, first SMS)",
      metadata: { from: "researched", to: "contacted", auto: true },
    });
  }

  return c.json({ ok: true, twilio_sid: sid, to: phone.e164 });
});

// Map Twilio error codes to readable, actionable responses. Config problems
// come back 502 (our side), bad destination numbers 400 (this lead).
// Codes: https://www.twilio.com/docs/api/errors
function mapTwilioError(err: TwilioApiError): {
  body: Record<string, unknown>;
  status: 400 | 502;
} {
  const base = { twilio_code: err.code, message: err.message };
  switch (err.code) {
    case 20003:
      return {
        status: 502,
        body: {
          error: "twilio_auth_failed",
          ...base,
          message:
            "Twilio rejected our credentials. Re-set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN " +
            "(Twilio Console → Account Info) with `wrangler secret put`.",
        },
      };
    case 21606:
    case 21659:
    case 21212:
      return {
        status: 502,
        body: {
          error: "twilio_from_number_invalid",
          ...base,
          message: `The From number is not a valid, SMS-capable Twilio number on this account: ${err.message}. Check TWILIO_PHONE_NUMBER (must be E.164, e.g. +447700900123).`,
        },
      };
    case 21408:
      return {
        status: 400,
        body: {
          error: "sms_region_not_enabled",
          ...base,
          message: `Twilio blocked the destination region: ${err.message}. Enable it under Twilio Console → Messaging → Settings → Geo permissions.`,
        },
      };
    case 21211:
    case 21614:
      return { status: 400, body: { error: "recipient_not_sms_capable", ...base } };
    case 21608:
      return {
        status: 400,
        body: {
          error: "trial_account_restriction",
          ...base,
          message: `Twilio trial accounts can only message verified numbers: ${err.message}`,
        },
      };
    default:
      return {
        status: err.httpStatus >= 500 || err.httpStatus === 401 ? 502 : 400,
        body: { error: "twilio_error", ...base, http_status: err.httpStatus },
      };
  }
}
