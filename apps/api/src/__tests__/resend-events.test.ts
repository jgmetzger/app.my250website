import { describe, expect, it } from "vitest";
import { extractTag, mapResendEvent } from "../lib/resend_events.js";

describe("extractTag", () => {
  it("reads the legacy array-of-{name,value} shape", () => {
    const tags = [
      { name: "lead_id", value: "42" },
      { name: "template_id", value: "3" },
    ];
    expect(extractTag(tags, "lead_id")).toBe("42");
    expect(extractTag(tags, "missing")).toBe(null);
  });

  it("reads the newer plain-object shape", () => {
    expect(extractTag({ lead_id: "42" }, "lead_id")).toBe("42");
    expect(extractTag({ lead_id: 42 }, "lead_id")).toBe("42");
    expect(extractTag({ other: "x" }, "lead_id")).toBe(null);
  });

  it("never throws on garbage", () => {
    expect(extractTag(undefined, "lead_id")).toBe(null);
    expect(extractTag(null, "lead_id")).toBe(null);
    expect(extractTag("lead_id=42", "lead_id")).toBe(null);
    expect(extractTag(7, "lead_id")).toBe(null);
    expect(extractTag([{ bogus: true }, null, "x"], "lead_id")).toBe(null);
  });
});

describe("mapResendEvent", () => {
  it("maps known events", () => {
    expect(mapResendEvent("email.delivered")).toBe("email_delivered");
    expect(mapResendEvent("email.opened")).toBe("email_opened");
    expect(mapResendEvent("email.clicked")).toBe("email_opened");
    expect(mapResendEvent("email.bounced")).toBe("email_bounced");
    expect(mapResendEvent("email.complained")).toBe("email_bounced");
    expect(mapResendEvent("email.failed")).toBe("email_bounced");
  });

  it("returns null (ack + ignore) for unknown or missing types", () => {
    expect(mapResendEvent("email.sent")).toBe(null);
    expect(mapResendEvent("contact.updated")).toBe(null);
    expect(mapResendEvent(undefined)).toBe(null);
  });
});
