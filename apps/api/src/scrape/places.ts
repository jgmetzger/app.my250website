// Google Places API (New) client. Replaces the old DOM scraper — no headless
// browser needed. The API has a stable contract, returns business name, phone,
// address, rating, review count, website and types in a single Text Search call.
//
// Pricing (as of 2024–25): Text Search = $32 / 1k requests, $200/mo free credit
// (≈ 6,250 free queries/month). Each "request" is one API call returning up to
// 20 places — so for the user's volumes this stays inside free tier.

const PLACES_TEXT_SEARCH = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.types",
  "places.googleMapsUri",
  "nextPageToken",
].join(",");

export interface PlacesSearchListing {
  google_place_id: string;
  business_name: string;
  google_maps_url: string | null;
  address: string | null;
  phone: string | null;
  website_url: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  business_type: string | null;
}

export interface PlacesSearchOptions {
  query: string;
  /** Hard cap on listings to crawl. Places API New returns ~60 max via pagination. */
  maxResults: number;
  /** Region bias as ISO 3166-1 alpha-2, e.g. "GB". */
  regionCode?: string;
  /** Called every N successfully-fetched listings so the orchestrator can persist. */
  onChunk: (listings: PlacesSearchListing[]) => Promise<void>;
  chunkSize: number;
}

interface PlacesApiResponse {
  places?: Array<{
    id: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    rating?: number;
    userRatingCount?: number;
    types?: string[];
    googleMapsUri?: string;
  }>;
  nextPageToken?: string;
}

export async function searchPlaces(
  apiKey: string,
  opts: PlacesSearchOptions,
): Promise<void> {
  let pageToken: string | undefined;
  let total = 0;
  let buffer: PlacesSearchListing[] = [];

  do {
    const body: Record<string, unknown> = { textQuery: opts.query, pageSize: 20 };
    if (opts.regionCode) body.regionCode = opts.regionCode;
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(PLACES_TEXT_SEARCH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`places_api_error:${res.status}:${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as PlacesApiResponse;

    for (const p of data.places ?? []) {
      buffer.push({
        google_place_id: p.id,
        business_name: p.displayName?.text ?? "(unnamed)",
        google_maps_url: p.googleMapsUri ?? null,
        address: p.formattedAddress ?? null,
        phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
        website_url: p.websiteUri ?? null,
        google_rating: p.rating ?? null,
        google_review_count: p.userRatingCount ?? null,
        business_type: detectBusinessType(p.types ?? []),
      });
      total += 1;
      if (buffer.length >= opts.chunkSize) {
        await opts.onChunk(buffer);
        buffer = [];
      }
      if (total >= opts.maxResults) break;
    }

    pageToken = data.nextPageToken;
  } while (pageToken && total < opts.maxResults);

  if (buffer.length) await opts.onChunk(buffer);
}

function detectBusinessType(types: string[]): string | null {
  // Google's Places API returns a list of types like ["bar","restaurant","point_of_interest"].
  // Map the first one that matches our enum.
  const map: Record<string, string> = {
    pub: "pub",
    bar: "bar",
    night_club: "bar",
    restaurant: "restaurant",
    cafe: "cafe",
    coffee_shop: "cafe",
  };
  for (const t of types) {
    if (map[t]) return map[t];
  }
  if (types.includes("food") || types.includes("meal_takeaway")) return "restaurant";
  return null;
}
