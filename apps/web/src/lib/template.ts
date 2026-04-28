import type { Lead } from "@app/shared";

/** Mirror of the API-side renderer. Substitutes `{{key}}` tokens. */
export function renderTemplate(tmpl: string, vars: Record<string, string>): string {
  return tmpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (full, key: string) => {
    return key in vars ? vars[key] ?? "" : full;
  });
}

export function leadVars(lead: Lead): Record<string, string> {
  return {
    business_name: lead.business_name,
    rating: lead.google_rating != null ? lead.google_rating.toFixed(1) : "",
    review_count: lead.google_review_count != null ? String(lead.google_review_count) : "",
    city: lead.city ?? "",
    business_type: lead.business_type ?? "",
  };
}

export const SAMPLE_VARS: Record<string, string> = {
  business_name: "The Crown & Anchor",
  rating: "4.6",
  review_count: "284",
  city: "Manchester",
  business_type: "pub",
};
