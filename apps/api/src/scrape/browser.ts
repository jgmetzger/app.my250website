// @cloudflare/puppeteer is a Worker-friendly fork of puppeteer-core. It supports
// both `launch(env.BROWSER)` for the Cloudflare Browser Rendering binding
// and `connect({ browserWSEndpoint })` for external services like Browserless.
import puppeteer, { type Browser } from "@cloudflare/puppeteer";
import type { Env } from "../env.js";

/**
 * Open a headless Chromium. Prefers the Cloudflare BROWSER binding; falls back
 * to Browserless if BROWSER_RENDERING_TOKEN is set; otherwise throws.
 */
export async function openBrowser(env: Env): Promise<Browser> {
  if (env.BROWSER) {
    return puppeteer.launch(env.BROWSER as unknown as Fetcher);
  }
  if (env.BROWSER_RENDERING_TOKEN) {
    return puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${env.BROWSER_RENDERING_TOKEN}`,
    });
  }
  throw new Error(
    "no_browser_available: enable Cloudflare Browser Rendering or set BROWSER_RENDERING_TOKEN",
  );
}
