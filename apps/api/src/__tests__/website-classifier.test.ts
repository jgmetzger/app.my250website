import { describe, expect, it } from "vitest";
import { classifyWebsite, isViable } from "@app/shared";

describe("classifyWebsite", () => {
  it("treats null/empty as 'none'", () => {
    expect(classifyWebsite(null)).toBe("none");
    expect(classifyWebsite("")).toBe("none");
    expect(classifyWebsite("   ")).toBe("none");
  });

  it("returns 'none' for malformed URLs", () => {
    expect(classifyWebsite("not a url")).toBe("none");
  });

  it("classifies Instagram (incl. mobile/short)", () => {
    expect(classifyWebsite("https://instagram.com/somebar")).toBe("instagram");
    expect(classifyWebsite("https://www.instagram.com/somebar")).toBe("instagram");
    expect(classifyWebsite("https://instagr.am/somebar")).toBe("instagram");
  });

  it("classifies Facebook variants", () => {
    expect(classifyWebsite("https://facebook.com/SomeBar")).toBe("facebook");
    expect(classifyWebsite("https://www.facebook.com/SomeBar")).toBe("facebook");
    expect(classifyWebsite("https://m.facebook.com/SomeBar")).toBe("facebook");
    expect(classifyWebsite("https://fb.me/SomeBar")).toBe("facebook");
  });

  it("classifies TikTok / Twitter / Linktree / other socials", () => {
    expect(classifyWebsite("https://tiktok.com/@somebar")).toBe("tiktok");
    expect(classifyWebsite("https://x.com/somebar")).toBe("twitter");
    expect(classifyWebsite("https://twitter.com/somebar")).toBe("twitter");
    expect(classifyWebsite("https://linktr.ee/somebar")).toBe("linktree");
    expect(classifyWebsite("https://threads.net/@somebar")).toBe("other_social");
  });

  it("treats anything else as a real website", () => {
    expect(classifyWebsite("https://thehorseandgroom.co.uk")).toBe("real");
    expect(classifyWebsite("https://www.somerestaurant.com/menu")).toBe("real");
    expect(classifyWebsite("http://google.sites/mybar")).toBe("real");
  });

  it("isViable: real => not viable, everything else => viable", () => {
    expect(isViable("real")).toBe(false);
    expect(isViable("none")).toBe(true);
    expect(isViable("instagram")).toBe(true);
    expect(isViable("facebook")).toBe(true);
    expect(isViable(null)).toBe(true);
  });
});
