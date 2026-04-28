import { describe, expect, it } from "vitest";
import { findByPlaceId, upsertScrapedLead } from "../repos/leads.js";
import { freshDb, type FakeD1 } from "./fake-d1.js";

// The fake-D1 implements the methods our repos call. We cast through
// `unknown` only at the boundary — repo internals stay typed against D1Database.
function asDb(fake: FakeD1) {
  return fake as unknown as D1Database;
}

describe("scraped lead dedupe", () => {
  it("inserts a lead the first time and returns the new id", async () => {
    const db = asDb(freshDb());
    const id = await upsertScrapedLead(
      db,
      {
        business_name: "The Crown",
        google_place_id: "0xabc:0x123",
        google_maps_url: "https://maps.google.com/?cid=1",
        address: "1 High St",
        city: "Manchester",
        phone: "0161 123 4567",
        website_url: "https://thecrown.co.uk",
        google_rating: 4.5,
        google_review_count: 120,
      },
      42,
    );
    expect(id).toBeTypeOf("number");
    expect(id).toBeGreaterThan(0);
  });

  it("returns null on the second call with the same place id", async () => {
    const db = asDb(freshDb());
    const first = await upsertScrapedLead(
      db,
      {
        business_name: "The Crown",
        google_place_id: "0xabc:0x123",
      },
      1,
    );
    const second = await upsertScrapedLead(
      db,
      {
        business_name: "The Crown (renamed!)",
        google_place_id: "0xabc:0x123", // same place id
      },
      2,
    );
    expect(first).not.toBeNull();
    expect(second).toBeNull();

    const found = await findByPlaceId(db, "0xabc:0x123");
    expect(found?.business_name).toBe("The Crown"); // not overwritten
  });

  it("auto-classifies website on insert (real -> real, instagram -> instagram, missing -> none)", async () => {
    const db = asDb(freshDb());
    await upsertScrapedLead(
      db,
      {
        business_name: "Has Site",
        google_place_id: "p1",
        website_url: "https://hassite.co.uk",
      },
      1,
    );
    await upsertScrapedLead(
      db,
      {
        business_name: "IG Only",
        google_place_id: "p2",
        website_url: "https://instagram.com/igonly",
      },
      1,
    );
    await upsertScrapedLead(
      db,
      {
        business_name: "Nothing",
        google_place_id: "p3",
        website_url: null,
      },
      1,
    );
    const a = await findByPlaceId(db, "p1");
    const b = await findByPlaceId(db, "p2");
    const c = await findByPlaceId(db, "p3");
    expect(a?.website_status).toBe("real");
    expect(b?.website_status).toBe("instagram");
    expect(c?.website_status).toBe("none");
  });
});
