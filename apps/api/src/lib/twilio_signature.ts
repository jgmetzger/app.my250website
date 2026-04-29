// Twilio webhook signature verification.
// https://www.twilio.com/docs/usage/webhooks/webhooks-security
//
// Signed string is: full URL + sorted-form-param key+value concatenation.
// HMAC-SHA1 with auth token, base64-encoded, compared to X-Twilio-Signature.

const enc = new TextEncoder();

async function hmacSha1(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  let s = "";
  for (const b of sig) s += String.fromCharCode(b);
  return btoa(s);
}

export async function verifyTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const k of sortedKeys) data += k + (params[k] ?? "");
  const expected = await hmacSha1(authToken, data);
  return constantTimeEq(expected, signatureHeader);
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
