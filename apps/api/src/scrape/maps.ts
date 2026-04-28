// Google Maps DOM scraper. Selectors here are inherently fragile — Google ships
// markup changes frequently. If a scrape returns 0 results, the first thing to
// check is whether these selectors still match. Each one is named so the call
// site logs which one failed.
import type { Browser, Page } from "@cloudflare/puppeteer";

export interface ScrapedListing {
  google_place_id: string;
  business_name: string;
  google_maps_url: string;
  address: string | null;
  phone: string | null;
  website_url: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  business_type: string | null;
}

const SELECTORS = {
  resultsFeed: 'div[role="feed"]',
  resultTile: 'a[href*="/maps/place/"]',
  detailHeading: "h1.DUwDvf",
  detailRating: "div.F7nice span[aria-hidden='true']",
  detailReviewCount: "div.F7nice span[aria-label*='review']",
  // Detail-panel rows have data-item-id attributes for stable identification.
  detailAddressBtn: 'button[data-item-id="address"]',
  detailPhoneBtn: 'button[data-item-id^="phone"]',
  detailWebsiteLink: 'a[data-item-id="authority"]',
  detailTypeButton: 'button[jsaction*="category"]',
  consentReject: 'button[aria-label*="Reject"], button[aria-label*="reject"]',
  consentAccept: 'button[aria-label*="Accept"], button[aria-label*="accept"]',
};

const NAV_TIMEOUT = 25_000;
const SHORT_WAIT = 2_500;

interface ScrapeOptions {
  query: string;
  /** Hard cap on listings to crawl (after scrolling). */
  maxResults: number;
  /** Called every N successfully-extracted listings so the orchestrator can persist. */
  onChunk: (listings: ScrapedListing[]) => Promise<void>;
  /** Chunk size for onChunk. */
  chunkSize: number;
}

export async function scrapeMaps(browser: Browser, opts: ScrapeOptions): Promise<void> {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1800 });
  page.setDefaultTimeout(NAV_TIMEOUT);

  try {
    const url = `https://www.google.com/maps/search/${encodeURIComponent(opts.query)}?hl=en`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await dismissConsent(page);

    // The feed only mounts once results render.
    await waitForSelector(page, SELECTORS.resultsFeed, "results_feed");
    await scrollFeed(page, opts.maxResults);

    const tileUrls = await collectTileUrls(page, opts.maxResults);
    let buffer: ScrapedListing[] = [];

    for (const tileUrl of tileUrls) {
      try {
        const listing = await scrapeOne(page, tileUrl);
        if (listing) buffer.push(listing);
      } catch (err) {
        console.warn("scrape_one_failed", { tileUrl, err: String(err) });
      }
      if (buffer.length >= opts.chunkSize) {
        await opts.onChunk(buffer);
        buffer = [];
      }
    }
    if (buffer.length) await opts.onChunk(buffer);
  } finally {
    await page.close().catch(() => undefined);
  }
}

// --- Helpers below ---

async function dismissConsent(page: Page): Promise<void> {
  // Google's GDPR banner sometimes lives in an iframe. Try the most common path first.
  for (const sel of [SELECTORS.consentReject, SELECTORS.consentAccept]) {
    const btn = await page.$(sel).catch(() => null);
    if (btn) {
      try {
        await btn.click();
        await page.waitForTimeout(SHORT_WAIT);
        return;
      } catch {
        /* fall through */
      }
    }
  }
  // Try the consent.google.com iframe if present.
  for (const frame of page.frames()) {
    if (!frame.url().includes("consent")) continue;
    for (const sel of [SELECTORS.consentReject, SELECTORS.consentAccept]) {
      const btn = await frame.$(sel).catch(() => null);
      if (btn) {
        try {
          await btn.click();
          await page.waitForTimeout(SHORT_WAIT);
          return;
        } catch {
          /* ignore */
        }
      }
    }
  }
}

async function waitForSelector(page: Page, selector: string, label: string): Promise<void> {
  try {
    await page.waitForSelector(selector, { timeout: NAV_TIMEOUT });
  } catch (err) {
    throw new Error(`selector_timeout:${label}`);
  }
}

/**
 * Scroll the results feed inside Maps until either we hit `maxResults` tiles or
 * three consecutive scrolls produce no new tiles (end of list).
 */
async function scrollFeed(page: Page, maxResults: number): Promise<void> {
  let lastCount = 0;
  let stagnant = 0;
  for (let i = 0; i < 30; i++) {
    const count = await page.$$eval(
      SELECTORS.resultTile,
      (tiles: Element[]) => tiles.length,
    );
    if (count >= maxResults) return;
    if (count === lastCount) {
      stagnant += 1;
      if (stagnant >= 3) return;
    } else {
      stagnant = 0;
      lastCount = count;
    }
    await page.evaluate((sel: string) => {
      const feed = document.querySelector(sel) as HTMLElement | null;
      if (feed) feed.scrollBy(0, feed.scrollHeight);
    }, SELECTORS.resultsFeed);
    await page.waitForTimeout(1500);
  }
}

async function collectTileUrls(page: Page, maxResults: number): Promise<string[]> {
  const urls = await page.$$eval(SELECTORS.resultTile, (tiles: Element[]) =>
    tiles.map((t) => (t as HTMLAnchorElement).href).filter(Boolean),
  );
  // Dedupe while preserving order.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= maxResults) break;
  }
  return out;
}

async function scrapeOne(page: Page, tileUrl: string): Promise<ScrapedListing | null> {
  await page.goto(tileUrl, { waitUntil: "domcontentloaded" });
  await waitForSelector(page, SELECTORS.detailHeading, "detail_heading");

  const data = await page.evaluate((sel: typeof SELECTORS) => {
    const text = (s: string) => document.querySelector(s)?.textContent?.trim() ?? null;

    const heading = text(sel.detailHeading);
    const ratingText = text(sel.detailRating);
    const reviewCountText =
      document.querySelector(sel.detailReviewCount)?.textContent?.replace(/[^\d]/g, "") ??
      null;
    const addressBtn = document.querySelector(sel.detailAddressBtn) as HTMLElement | null;
    const phoneBtn = document.querySelector(sel.detailPhoneBtn) as HTMLElement | null;
    const websiteEl = document.querySelector(sel.detailWebsiteLink) as
      | HTMLAnchorElement
      | null;
    const typeBtn = document.querySelector(sel.detailTypeButton) as HTMLElement | null;

    return {
      heading,
      rating: ratingText ? parseFloat(ratingText.replace(",", ".")) : null,
      reviewCount: reviewCountText ? parseInt(reviewCountText, 10) : null,
      address:
        addressBtn?.getAttribute("aria-label")?.replace(/^Address:\s*/, "").trim() ??
        addressBtn?.textContent?.trim() ??
        null,
      phone:
        phoneBtn?.getAttribute("aria-label")?.replace(/^Phone:\s*/, "").trim() ??
        phoneBtn?.textContent?.trim() ??
        null,
      website: websiteEl?.href ?? null,
      businessType: typeBtn?.textContent?.trim() ?? null,
    };
  }, SELECTORS);

  if (!data.heading) return null;

  const placeId = extractPlaceIdFromUrl(page.url());
  if (!placeId) return null;

  return {
    google_place_id: placeId,
    business_name: data.heading,
    google_maps_url: page.url(),
    address: data.address,
    phone: data.phone,
    website_url: data.website,
    google_rating: Number.isFinite(data.rating) ? data.rating : null,
    google_review_count: Number.isFinite(data.reviewCount) ? data.reviewCount : null,
    business_type: normalizeBusinessType(data.businessType),
  };
}

/**
 * Maps URLs encode the place id as `!1s0x...:0x...`. We use that as our stable
 * dedupe key — much more reliable than business name + address.
 */
export function extractPlaceIdFromUrl(url: string): string | null {
  const match = url.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
  return match ? (match[1] ?? null) : null;
}

const KNOWN_TYPES = ["pub", "bar", "restaurant", "gastropub", "cafe"] as const;

export function normalizeBusinessType(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  for (const t of KNOWN_TYPES) if (lower.includes(t)) return t;
  return "other";
}
