import { describe, expect, it } from "vitest";
import { verifyResendWebhook } from "../lib/resend_signature.js";

const enc = new TextEncoder();

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

async function signSvix(rawSecret: Uint8Array, id: string, ts: number, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    rawSecret as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(`${id}.${ts}.${body}`)),
  );
  return `v1,${b64(sig)}`;
}

describe("verifyResendWebhook", () => {
  const rawSecretBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const secret = "whsec_" + b64(rawSecretBytes);
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "e_1" } });
  const id = "msg_test";

  it("accepts a correctly signed recent payload", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await signSvix(rawSecretBytes, id, ts, body);
    const ok = await verifyResendWebhook({
      rawBody: body,
      svixId: id,
      svixTimestamp: String(ts),
      svixSignature: sig,
      secret,
    });
    expect(ok).toBe(true);
  });

  it("rejects a tampered body", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await signSvix(rawSecretBytes, id, ts, body);
    const ok = await verifyResendWebhook({
      rawBody: body + "tampered",
      svixId: id,
      svixTimestamp: String(ts),
      svixSignature: sig,
      secret,
    });
    expect(ok).toBe(false);
  });

  it("rejects a stale timestamp (>5 minutes off)", async () => {
    const ts = Math.floor(Date.now() / 1000) - 60 * 10;
    const sig = await signSvix(rawSecretBytes, id, ts, body);
    const ok = await verifyResendWebhook({
      rawBody: body,
      svixId: id,
      svixTimestamp: String(ts),
      svixSignature: sig,
      secret,
    });
    expect(ok).toBe(false);
  });

  it("rejects when the wrong secret is configured", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await signSvix(rawSecretBytes, id, ts, body);
    const wrongSecret = "whsec_" + b64(new Uint8Array([9, 9, 9, 9, 9, 9, 9, 9, 9, 9]));
    const ok = await verifyResendWebhook({
      rawBody: body,
      svixId: id,
      svixTimestamp: String(ts),
      svixSignature: sig,
      secret: wrongSecret,
    });
    expect(ok).toBe(false);
  });

  it("rejects when headers are missing", async () => {
    expect(
      await verifyResendWebhook({
        rawBody: body,
        svixId: null,
        svixTimestamp: "0",
        svixSignature: "v1,abc",
        secret,
      }),
    ).toBe(false);
  });
});
