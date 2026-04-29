import { describe, expect, it } from "vitest";
import { insertActivity, listActivitiesForLead } from "../repos/activities.js";
import { createLead, getLeadById, updateLead } from "../repos/leads.js";
import { freshDb, type FakeD1 } from "./fake-d1.js";

function asDb(fake: FakeD1) {
  return fake as unknown as D1Database;
}

describe("status change activity logging", () => {
  it("updateLead respects the patched status", async () => {
    const db = asDb(freshDb());
    const id = await createLead(db, { business_name: "Test Pub" });
    const initial = await getLeadById(db, id);
    expect(initial?.status).toBe("sourced");

    const updated = await updateLead(db, id, { status: "researched" });
    expect(updated?.status).toBe("researched");
  });

  it("manually-logged status_change activity appears in the timeline", async () => {
    const db = asDb(freshDb());
    const id = await createLead(db, { business_name: "Test Pub" });

    await insertActivity(db, {
      lead_id: id,
      type: "status_change",
      body: "Status: sourced → researched",
      metadata: { from: "sourced", to: "researched" },
    });
    await insertActivity(db, {
      lead_id: id,
      type: "note",
      body: "Called the owner",
    });

    const activities = await listActivitiesForLead(db, id);
    expect(activities).toHaveLength(2);
    // Newest first.
    expect(activities[0]?.type).toBe("note");
    expect(activities[1]?.type).toBe("status_change");
    expect(activities[1]?.metadata).toContain("researched");
  });

  it("manual lead create auto-classifies website url", async () => {
    const db = asDb(freshDb());
    const id = await createLead(db, {
      business_name: "FB Pub",
      website_url: "https://facebook.com/fbpub",
    });
    const lead = await getLeadById(db, id);
    expect(lead?.website_status).toBe("facebook");
  });
});
