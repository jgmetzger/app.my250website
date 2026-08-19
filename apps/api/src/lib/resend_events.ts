import type { ActivityType } from "@app/shared";

// Resend webhook payloads have changed shape over time:
//   - `data.tags` was an array of { name, value } (matching the send API),
//     newer events send a plain object: { "lead_id": "5" }.
//   - New event types appear without notice (email.clicked, email.failed, …).
// Everything here tolerates both shapes and unknown types.

export function extractTag(tags: unknown, name: string): string | null {
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (t && typeof t === "object" && (t as { name?: unknown }).name === name) {
        const v = (t as { value?: unknown }).value;
        return typeof v === "string" ? v : null;
      }
    }
    return null;
  }
  if (tags && typeof tags === "object") {
    const v = (tags as Record<string, unknown>)[name];
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

export function mapResendEvent(type: string | undefined): ActivityType | null {
  switch (type) {
    case "email.delivered":
      return "email_delivered";
    case "email.opened":
    case "email.clicked":
      return "email_opened";
    case "email.bounced":
    case "email.delivery_delayed":
    case "email.complained":
    case "email.failed":
      return "email_bounced";
    // email.sent is intentionally ignored: we log email_sent ourselves at
    // send time, so recording it again would double-count.
    default:
      return null;
  }
}
