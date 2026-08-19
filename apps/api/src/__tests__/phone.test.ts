import { describe, expect, it } from "vitest";
import { countryHint, normalizePhoneForSms } from "../lib/phone.js";

describe("countryHint", () => {
  it("maps common country strings", () => {
    expect(countryHint("United Kingdom")).toBe("GB");
    expect(countryHint("UK")).toBe("GB");
    expect(countryHint("Spain")).toBe("ES");
    expect(countryHint("España")).toBe("ES");
    expect(countryHint("Mallorca, Spain")).toBe("ES");
    expect(countryHint("France")).toBe(null);
    expect(countryHint(null)).toBe(null);
  });
});

describe("normalizePhoneForSms", () => {
  it("normalises UK local mobile formats to E.164", () => {
    expect(normalizePhoneForSms("07459 313434")).toEqual({
      ok: true,
      e164: "+447459313434",
      country: "GB",
    });
    expect(normalizePhoneForSms("07459-313-434")).toMatchObject({ e164: "+447459313434" });
    expect(normalizePhoneForSms("+44 7459 313434")).toMatchObject({ e164: "+447459313434" });
    expect(normalizePhoneForSms("+44 (0)7459 313434")).toMatchObject({ e164: "+447459313434" });
    expect(normalizePhoneForSms("0044 7459 313434")).toMatchObject({ e164: "+447459313434" });
    expect(normalizePhoneForSms("447459313434")).toMatchObject({ e164: "+447459313434" });
  });

  it("normalises Spanish local mobile formats to E.164", () => {
    expect(normalizePhoneForSms("623 18 02 34")).toEqual({
      ok: true,
      e164: "+34623180234",
      country: "ES",
    });
    expect(normalizePhoneForSms("+34 623 18 02 34")).toMatchObject({ e164: "+34623180234" });
    expect(normalizePhoneForSms("0034623180234")).toMatchObject({ e164: "+34623180234" });
    expect(normalizePhoneForSms("34623180234")).toMatchObject({ e164: "+34623180234" });
    expect(normalizePhoneForSms("712345678", "ES")).toMatchObject({ e164: "+34712345678" });
  });

  it("rejects UK landlines with a readable reason", () => {
    const r = normalizePhoneForSms("020 7946 0958");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("landline");
    const r2 = normalizePhoneForSms("+44 161 496 0000");
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe("landline");
  });

  it("rejects Spanish landlines with a readable reason", () => {
    const r = normalizePhoneForSms("912 34 56 78");
    // "912345678" is 9 digits but has a leading 9 — Spanish landline...
    // except the leading-0-free 9-digit path must classify it as ES.
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("landline");
    const r2 = normalizePhoneForSms("+34 871 12 34 56");
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe("landline");
  });

  it("rejects empty and junk input", () => {
    expect(normalizePhoneForSms("")).toMatchObject({ ok: false, reason: "empty" });
    expect(normalizePhoneForSms(null)).toMatchObject({ ok: false, reason: "empty" });
    expect(normalizePhoneForSms("call the bar")).toMatchObject({ ok: false, reason: "invalid" });
    expect(normalizePhoneForSms("12345")).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("passes through other international numbers untouched", () => {
    expect(normalizePhoneForSms("+33 6 12 34 56 78")).toMatchObject({
      ok: true,
      e164: "+33612345678",
      country: "other",
    });
  });

  it("uses the country hint to resolve ambiguity", () => {
    // 9 digits starting 6 with a GB hint should NOT be forced into +34.
    const r = normalizePhoneForSms("612345678", "GB");
    expect(r.ok).toBe(false);
    // With ES hint (or no hint) it's a Spanish mobile.
    expect(normalizePhoneForSms("612345678", "ES")).toMatchObject({ e164: "+34612345678" });
    expect(normalizePhoneForSms("612345678")).toMatchObject({ e164: "+34612345678" });
  });
});
