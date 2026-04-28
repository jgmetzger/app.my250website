# app.my250website.com

Single-user UK hospitality lead-gen + outreach CRM for **James Metzger** (Websites for Bars & Restaurants).

Find pubs / bars / restaurants on Google Maps, classify which ones already have a real website, enrich with email / phone, and run outreach (email via Resend, voice calls via Twilio softphone) — all from one dashboard.

---

## Status

**Phase 1 — Foundation** is what's currently deployed:

- pnpm workspace with `apps/web` (Vite + React + Tailwind), `apps/api` (Cloudflare Worker + Hono), `packages/shared` (types + zod schemas + website classifier)
- Cloudflare D1 schema (single migration, idempotent default-template seed)
- JWT-cookie auth (single user, password from `APP_PASSWORD` secret)
- All API routes scaffolded — auth/health are live; the rest return `501 not_implemented` with the `phase` they ship in
- Vite frontend with `/login` and a minimal `/dashboard` placeholder

Subsequent phases — leads CRUD, scraping, email, calls, stats, CSV import — fill in the route stubs.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + Tailwind → Cloudflare Pages |
| Backend | One Cloudflare Worker via Hono → all `/api/*` |
| DB | Cloudflare D1 (SQLite at the edge) |
| Browser scraping | Cloudflare Browser Rendering (paid plan) — falls back to Browserless.io if `BROWSER_RENDERING_TOKEN` is set |
| Email | Resend |
| Voice | Twilio Voice SDK (browser softphone) |
| Auth | Hardcoded password → HS256 JWT in HttpOnly cookie |

---

## Repo layout

```
.
├── apps/
│   ├── api/              # Cloudflare Worker (Hono). Deploys via `wrangler deploy`.
│   │   ├── src/
│   │   ├── wrangler.toml
│   │   └── .dev.vars.example
│   └── web/              # Vite + React + Tailwind. Deploys to Cloudflare Pages.
│       ├── src/
│       ├── public/       # Includes the Twilio domain-verification file.
│       └── index.html
├── packages/
│   └── shared/           # Types, Zod schemas, website classifier shared between web & api.
├── migrations/
│   └── 0001_init.sql     # D1 schema + default email template seed.
├── package.json          # pnpm workspace root.
└── README.md
```

---

## Prerequisites

- Node 20+
- pnpm 9+ (`npm i -g pnpm`)
- A Cloudflare account with:
  - Workers Paid plan (for Browser Rendering binding) — or a Browserless.io free token as fallback
  - The domain `my250website.com` on Cloudflare with DNS managed there
- A Twilio account with a UK number purchased and address-verified
- A Resend account with `my250website.com` verified for sending

---

## One-time setup

**See [SETUP.md](./SETUP.md) for the friendly walk-through.** The short version is:

```bash
./scripts/bootstrap.sh
```

That script handles install, wrangler login, D1 creation, migrations, secret
prompts, and deploy. Things only you can do (sign-ups, Twilio number purchase,
Cloudflare dashboard clicks) are flagged with `ACTION:` and the script pauses.

---

### Manual reference (if you want to skip the script)

```bash
# 1. Install
pnpm install

# 2. Authenticate wrangler
npx wrangler login

# 3. Create the D1 database
pnpm db:create
# → Copy the printed `database_id` into apps/api/wrangler.toml ([[d1_databases]] block).

# 4. Run migrations (remote; `:local` variant for `wrangler dev`)
pnpm db:migrate
pnpm db:migrate:local

# 5. Set Worker secrets (production)
cd apps/api
npx wrangler secret put APP_PASSWORD                # the single login password
npx wrangler secret put JWT_SECRET                  # any 32+ char random string
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_WEBHOOK_SECRET     # optional but recommended
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put TWILIO_API_KEY
npx wrangler secret put TWILIO_API_SECRET
npx wrangler secret put TWILIO_TWIML_APP_SID
npx wrangler secret put TWILIO_PHONE_NUMBER          # e.g. +44...
npx wrangler secret put BROWSER_RENDERING_TOKEN     # only if using Browserless fallback
cd ../..
```

For local dev, copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` and fill in values — `wrangler dev` reads it automatically.

---

## Local development

Two processes, in separate terminals:

```bash
# Terminal 1 — Worker on :8787 with --local D1
cd apps/api && pnpm dev

# Terminal 2 — Vite on :5173, proxies /api/* to :8787
cd apps/web && pnpm dev
```

Open <http://localhost:5173/login>, sign in with whatever you set in `.dev.vars`'s `APP_PASSWORD`.

---

## Deploying

```bash
# Worker (API)
pnpm deploy:api

# Frontend (Pages)
pnpm build:web
pnpm deploy:web   # uploads apps/web/dist to project "app-my250website"
```

### Custom domain wiring

The Worker route in `apps/api/wrangler.toml` claims `app.my250website.com/api/*`.
The Pages project must be bound to `app.my250website.com` for everything else.

In the Cloudflare dashboard:

1. **Pages project** → Custom domains → add `app.my250website.com`. This creates the Pages-managed CNAME.
2. **Workers** → the deployed `app-my250website-api` → Triggers → confirm the route `app.my250website.com/api/*` is listed (wrangler should add it automatically). If not, add it manually with zone `my250website.com`.

Cloudflare resolves Worker routes before Pages, so `/api/*` hits the Worker and everything else falls through to Pages with the SPA fallback in `apps/web/public/_redirects`.

---

## Twilio gotchas

- UK Twilio numbers require an address proof on file before SMS/voice traffic; verify in the Twilio console under **Phone Numbers → Regulatory Compliance**.
- For browser-based outbound dialing you need a **TwiML App** (Voice → TwiML Apps → Create) with the **Voice Request URL** pointed at `https://app.my250website.com/api/webhooks/twilio/voice`. Put its SID in `TWILIO_TWIML_APP_SID`.
- The browser SDK uses an **API Key + Secret** (Voice → API Keys → Create Standard) — that's what `TWILIO_API_KEY` / `TWILIO_API_SECRET` are for, *not* the account auth token.

## Browser Rendering / scraping

The scraper drives a real Chromium against `google.com/maps`. Two ways to host it:

- **Cloudflare Browser Rendering** (default). On the Workers Paid plan, the
  `BROWSER` binding in `wrangler.toml` is automatically wired up — no
  additional config. Costs are pay-per-second of browser time.
- **Browserless.io fallback**. Set `BROWSER_RENDERING_TOKEN` to a Browserless
  token; the launcher will `puppeteer.connect()` to it instead. Free tier is
  fine for low-volume use.

Per-run options (`apps/web/src/pages/ScrapePage.tsx`):

- `query` — sent verbatim to Maps (`/maps/search/<query>`)
- `city`, `business_type` — recorded on the run + applied as defaults to the saved leads
- `min_reviews` (default 10), `min_rating` (default 4.0) — filter applied **before** insert
- All scraped leads are deduped against existing rows on `google_place_id`
- Anything that already has a real (non-social) website is skipped

**About selectors.** Google Maps changes its DOM regularly. Selectors live in
one place — `apps/api/src/scrape/maps.ts` `SELECTORS` — and each one is named so
"selector_timeout:results_feed" tells you which one to fix. Expect to tweak
these after the first real run.

**About time limits.** The Worker hands the scrape off to `ctx.waitUntil()`,
which keeps it alive past the HTTP response, but the wall clock is still
finite. The orchestrator persists progress every 10 successfully-extracted
listings, so a timed-out run leaves partial results behind. Just re-run with
the same query — duplicates are skipped automatically.

## Resend gotchas

- Verify the sending domain `my250website.com` (Domains tab; add the printed DNS records).
- Set `SENDER_EMAIL` in `wrangler.toml` to a mailbox at that domain (default: `james@my250website.com`).
- Hard daily cap: `DAILY_EMAIL_CAP=15` (env var). Increase if needed.
- **Webhook signing.** Create a webhook in the Resend dashboard pointing at
  `https://app.my250website.com/api/webhooks/resend`, copy the Signing Secret
  (starts with `whsec_`), and store as `RESEND_WEBHOOK_SECRET`. The Worker
  rejects unsigned / tampered / stale (>5 min) payloads when this is set.
  If the secret is unset, signed verification is bypassed (logs delivery
  events as before).

---

## Pipeline stages (`leads.status`)

```
sourced → researched → contacted → replied → form_submitted → building → live → lost
```

Stage transitions are manual in the UI; each one writes a `status_change` activity automatically.

## Default email template

Seeded on first migration as **WFBR cold outreach**. Supports `{{business_name}}`, `{{rating}}`, `{{review_count}}`, `{{city}}`, `{{business_type}}`. Editable in `/templates` (phase 4).

---

## Build order (per `BUILD ORDER` in the original spec)

1. ✅ Foundation — repo, Tailwind, D1, auth, login
2. ✅ Leads CRUD — list, detail, inline edit, delete, status, notes
3. ✅ Scraping — Browser Rendering, Maps scrape, classify, dedupe, run status
4. ✅ Email — templates editor, Resend send, daily cap, webhook
5. ✅ Calls — Twilio token, browser softphone, outcome modal, TwiML
6. ✅ Dashboard + stats — single-call /api/stats/dashboard, recent activity
7. ✅ CSV import — multipart upload, per-row validation, error report
8. ✅ Polish — mobile nav (hamburger), Settings page, Spinner/EmptyState, skip-to-content link, focus rings

---

## Things this app deliberately does not have

- Multi-tenant / user signup / password reset (single user, one password)
- A public landing page (login is the front door)
- AI auto-replies / sentiment analysis
- Email reply tracking (replies hit James's inbox; he logs them)
- Mixpanel / PostHog
- Prisma / Drizzle (raw `db.prepare()` is fine at this scale)
