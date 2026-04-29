// Resend webhooks are signed via Svix. Header layout:
//   svix-id:        unique event id
//   svix-timestamp: unix seconds; reject if too old / too new
//   svix-signature: space-separated list of "v1,<base64-hmac>"
//
// Signed payload is `${id}.${timestamp}.${rawBody}` and the secret has a
// `whsec_` prefix that must be stripped — the remainder is base64-encoded.
//
// Docs: https://docs.svix.com/receiving/verifying-payloads/how-manual

const enc = new TextEncoder();

function base64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

async function hmacSha256(keyBytes: Uint8Array, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  return bytesToBase64(sig);
}

const TOLERANCE_SECONDS = 5 * 60;

export interface VerifyResendInput {
  /** raw request body (must NOT be parsed yet) */
  rawBody: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  /** webhook secret from the Resend dashboard, including the whsec_ prefix */
  secret: string;
}

export async function verifyResendWebhook(input: VerifyResendInput): Promise<boolean> {
  const { rawBody, svixId, svixTimestamp, svixSignature, secret } = input;
  if (!svixId || !svixTimestamp || !svixSignature || !secret) return false;

  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TOLERANCE_SECONDS) return false;

  const cleanSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(cleanSecret);
  } catch {
    return false;
  }

  const expected = await hmacSha256(keyBytes, `${svixId}.${ts}.${rawBody}`);

  // Header is space-separated "v1,<sig> v1,<sig>".
  for (const part of svixSignature.split(/\s+/)) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    if (constantTimeEq(sig, expected)) return true;
  }
  return false;
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
