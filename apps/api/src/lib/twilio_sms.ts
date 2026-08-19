// Minimal Twilio Messages client. One endpoint, so no SDK — the SDK doesn't
// run on Workers anyway. Auth is HTTP Basic with Account SID + Auth Token.

export interface TwilioSendSmsInput {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  body: string;
}

export interface TwilioSendSmsResult {
  sid: string;
  status: string;
}

/** Thrown for any non-2xx Twilio response, with the parsed error attached. */
export class TwilioApiError extends Error {
  readonly httpStatus: number;
  /** Twilio error code, e.g. 21614 (not a mobile), 20003 (auth failed). */
  readonly code: number | null;

  constructor(httpStatus: number, code: number | null, message: string) {
    super(message);
    this.name = "TwilioApiError";
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

export async function twilioSendSms(input: TwilioSendSmsInput): Promise<TwilioSendSmsResult> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(input.accountSid)}/Messages.json`;
  const form = new URLSearchParams({ To: input.to, From: input.from, Body: input.body });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${input.accountSid}:${input.authToken}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // Non-JSON body (proxy/HTML error page) — fall through with raw text.
  }

  if (!res.ok) {
    const code = typeof json.code === "number" ? json.code : null;
    const message =
      typeof json.message === "string" && json.message
        ? json.message
        : text.slice(0, 200) || `Twilio HTTP ${res.status}`;
    throw new TwilioApiError(res.status, code, message);
  }

  const sid = typeof json.sid === "string" ? json.sid : "";
  if (!sid) throw new TwilioApiError(res.status, null, "Twilio response missing message SID");
  return { sid, status: typeof json.status === "string" ? json.status : "queued" };
}
