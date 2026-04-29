import type { WebsiteStatus } from "./types.js";

export const SOCIAL_HOSTS: Record<Exclude<WebsiteStatus, "none" | "real">, string[]> = {
  instagram: ["instagram.com", "instagr.am"],
  facebook: ["facebook.com", "fb.com", "fb.me", "m.facebook.com"],
  tiktok: ["tiktok.com", "vm.tiktok.com"],
  twitter: ["twitter.com", "x.com"],
  linktree: ["linktr.ee", "linktree.com"],
  other_social: ["threads.net", "snapchat.com", "pinterest.com", "youtube.com", "youtu.be"],
};

/**
 * Decide whether a Google-Maps "website" URL is an actual website or a social-media link.
 * Anything not matching a known social host is treated as a "real" website.
 */
export function classifyWebsite(url: string | null | undefined): WebsiteStatus {
  if (!url || url.trim() === "") return "none";
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "none";
  }
  for (const [type, domains] of Object.entries(SOCIAL_HOSTS) as Array<
    [Exclude<WebsiteStatus, "none" | "real">, string[]]
  >) {
    if (domains.some((d) => host === d || host.endsWith("." + d))) {
      return type;
    }
  }
  return "real";
}

/** A lead is "viable" (worth contacting) iff they don't already have a real website. */
export function isViable(websiteStatus: WebsiteStatus | null | undefined): boolean {
  return websiteStatus !== "real";
}
