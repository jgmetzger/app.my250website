// Twilio Access Token (JWT) generator for the browser Voice SDK.
// Format: HS256 JWT signed with the API Secret. Header has cty=twilio-fpa;v=1.
//
// Docs: https://www.twilio.com/docs/iam/access-tokens

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hs256(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  return b64url(sig);
}

export interface TwilioTokenInput {
  accountSid: string;
  apiKey: string;
  apiSecret: string;
  identity: string;
  outgoingApplicationSid: string;
  ttlSeconds?: number;
}

export async function makeTwilioAccessToken(input: TwilioTokenInput): Promise<string> {
  const ttl = input.ttlSeconds ?? 60 * 60; // 1 hour default
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "HS256",
    typ: "JWT",
    cty: "twilio-fpa;v=1",
  };
  const payload = {
    jti: `${input.apiKey}-${now}`,
    iss: input.apiKey,
    sub: input.accountSid,
    iat: now,
    nbf: now,
    exp: now + ttl,
    grants: {
      identity: input.identity,
      voice: {
        incoming: { allow: false },
        outgoing: { application_sid: input.outgoingApplicationSid },
      },
    },
  };

  const head = b64url(enc.encode(JSON.stringify(header)));
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await hs256(input.apiSecret, `${head}.${body}`);
  return `${head}.${body}.${sig}`;
}
