// Minimal Resend client. We only use one endpoint (POST /emails), so the SDK
// would be overkill — `fetch` is fine.

export interface ResendSendInput {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Tags get echoed back on webhook events — used to correlate to a lead. */
  tags?: Array<{ name: string; value: string }>;
}

export interface ResendSendResult {
  id: string;
}

export async function resendSend(input: ResendSendInput): Promise<ResendSendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      tags: input.tags,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`resend_error_${res.status}: ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("resend_no_id");
  return { id: json.id };
}
