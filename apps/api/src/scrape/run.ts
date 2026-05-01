import { classifyWebsite } from "@app/shared";
import type { Env } from "../env.js";
import { upsertScrapedLead } from "../repos/leads.js";
import { finishScrapeRun, updateScrapeRunProgress } from "../repos/scrape_runs.js";
import { searchPlaces, type PlacesSearchListing } from "./places.js";

export interface RunScrapeInput {
  runId: number;
  query: string;
  city: string | null;
  business_type: string | null;
  min_reviews: number;
  min_rating: number;
  /** Hard cap on listings to crawl. */
  max_results?: number;
}

/**
 * Background entrypoint. Hits the Google Places API, applies filters + dedupe
 * per chunk, persists progress, and finalises the scrape_runs row when done.
 *
 * Honours the spec's filtering rules:
 *  - skip if review_count < min_reviews
 *  - skip if rating < min_rating
 *  - skip if website_status === 'real' (already has a site — not a prospect)
 *  - dedupe on google_place_id
 */
export async function runScrape(env: Env, input: RunScrapeInput): Promise<void> {
  const { runId } = input;
  let resultsFound = 0;
  let newLeadsAdded = 0;
  let duplicatesSkipped = 0;

  if (!env.GOOGLE_PLACES_API_KEY) {
    await finishScrapeRun(
      env.DB,
      runId,
      "failed",
      "GOOGLE_PLACES_API_KEY not set — add it as a Worker secret and redeploy.",
    );
    return;
  }

  try {
    await searchPlaces(env.GOOGLE_PLACES_API_KEY, {
      query: input.query,
      maxResults: input.max_results ?? 100,
      chunkSize: 10,
      regionCode: "GB",
      onChunk: async (listings) => {
        for (const listing of listings) {
          resultsFound += 1;
          if (!shouldKeep(listing, input)) continue;

          const id = await upsertScrapedLead(
            env.DB,
            {
              business_name: listing.business_name,
              google_place_id: listing.google_place_id,
              google_maps_url: listing.google_maps_url,
              business_type: listing.business_type ?? input.business_type ?? null,
              address: listing.address,
              city: input.city,
              phone: listing.phone,
              website_url: listing.website_url,
              google_rating: listing.google_rating,
              google_review_count: listing.google_review_count,
            },
            runId,
          );
          if (id == null) duplicatesSkipped += 1;
          else newLeadsAdded += 1;
        }
        // Persist incremental progress so the UI can render "47 of ~100".
        await updateScrapeRunProgress(env.DB, runId, {
          results_found: resultsFound,
          new_leads_added: newLeadsAdded,
          duplicates_skipped: duplicatesSkipped,
        });
      },
    });

    await finishScrapeRun(env.DB, runId, "completed");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("scrape_failed", { runId, message });
    await updateScrapeRunProgress(env.DB, runId, {
      results_found: resultsFound,
      new_leads_added: newLeadsAdded,
      duplicates_skipped: duplicatesSkipped,
    }).catch(() => undefined);
    await finishScrapeRun(env.DB, runId, "failed", message).catch(() => undefined);
  }
}

function shouldKeep(listing: PlacesSearchListing, input: RunScrapeInput): boolean {
  if ((listing.google_review_count ?? 0) < input.min_reviews) return false;
  if ((listing.google_rating ?? 0) < input.min_rating) return false;
  if (classifyWebsite(listing.website_url) === "real") return false;
  return true;
}
