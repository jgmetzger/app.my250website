// Phone normalisation for SMS. Leads store numbers in local formats —
// UK "07459 313434", Spanish "623 18 02 34" — but Twilio requires E.164.
// We also classify mobile vs landline so the SMS route can reject
// landlines with a readable error instead of a Twilio 21614.

export type PhoneCountry = "GB" | "ES" | "other";

export type NormalizedPhone =
  | { ok: true; e164: string; country: PhoneCountry }
  | { ok: false; reason: "empty" | "invalid" | "landline"; detail: string };

/** "United Kingdom" / "UK" / "Spain" / "España" / "ES" → ISO-ish hint. */
export function countryHint(country: string | null | undefined): PhoneCountry | null {
  if (!country) return null;
  const c = country.trim().toLowerCase();
  if (/^(uk|gb|gbr)$/.test(c) || /united kingdom|great britain|england|scotland|wales|northern ireland/.test(c)) {
    return "GB";
  }
  if (/^(es|esp)$/.test(c) || /spain|espa[nñ]a|mallorca|majorca|balear/.test(c)) {
    return "ES";
  }
  return null;
}

/**
 * Normalise a raw phone string to E.164 and classify it.
 * Handles: "+44…", "0044…", "07459 313434", "623 18 02 34", "44 7459…",
 * "34 623…", dots/dashes/parens/spaces.
 */
export function normalizePhoneForSms(
  raw: string | null | undefined,
  hint: PhoneCountry | null = null,
): NormalizedPhone {
  const input = (raw ?? "").trim();
  if (!input) return { ok: false, reason: "empty", detail: "no phone number on record" };

  let s = input.replace(/[\s\-(). ]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!/^\+?\d+$/.test(s)) {
    return { ok: false, reason: "invalid", detail: `not a phone number: "${input}"` };
  }

  if (s.startsWith("+44")) return classifyUk(s.slice(3).replace(/^0/, ""), input);
  if (s.startsWith("+34")) return classifyEs(s.slice(3), input);
  if (s.startsWith("+")) {
    // Other country in international form — pass through if E.164-plausible.
    const digits = s.slice(1);
    if (digits.length >= 8 && digits.length <= 15) {
      return { ok: true, e164: s, country: "other" };
    }
    return { ok: false, reason: "invalid", detail: `bad international number: "${input}"` };
  }

  // National formats. The country hint (from the lead record) wins; the
  // patterns are unambiguous enough to fall back on when it's missing:
  //   UK  national: 11 digits starting 0 (mobile 07…)
  //   ES  national: 9 digits (mobile 6…/7…, landline 8…/9…)
  // Spain has no leading-0 national format, so a leading 0 is UK regardless of hint.
  if (s.startsWith("0")) return classifyUk(s.slice(1), input);
  if (s.length === 9 && hint !== "GB") return classifyEs(s, input);
  if (s.length === 10 && s.startsWith("7") && hint !== "ES") return classifyUk(s, input);
  if (s.startsWith("44") && s.length === 12) return classifyUk(s.slice(2), input);
  if (s.startsWith("34") && s.length === 11) return classifyEs(s.slice(2), input);

  return { ok: false, reason: "invalid", detail: `unrecognised format: "${input}"` };
}

/** national = UK number without the leading 0 (e.g. "7459313434"). */
function classifyUk(national: string, original: string): NormalizedPhone {
  if (!/^\d{10}$/.test(national)) {
    return { ok: false, reason: "invalid", detail: `bad UK number: "${original}"` };
  }
  if (national.startsWith("7")) {
    return { ok: true, e164: `+44${national}`, country: "GB" };
  }
  if (/^[123]/.test(national)) {
    return { ok: false, reason: "landline", detail: `UK landline (0${national.slice(0, 4)}…) — SMS not supported` };
  }
  return { ok: false, reason: "invalid", detail: `not an SMS-capable UK number: "${original}"` };
}

/** national = 9-digit Spanish number (e.g. "623180234"). */
function classifyEs(national: string, original: string): NormalizedPhone {
  if (!/^\d{9}$/.test(national)) {
    return { ok: false, reason: "invalid", detail: `bad Spanish number: "${original}"` };
  }
  if (/^[67]/.test(national)) {
    return { ok: true, e164: `+34${national}`, country: "ES" };
  }
  if (/^[89]/.test(national)) {
    return { ok: false, reason: "landline", detail: `Spanish landline (${national.slice(0, 3)}…) — SMS not supported` };
  }
  return { ok: false, reason: "invalid", detail: `not an SMS-capable Spanish number: "${original}"` };
}
