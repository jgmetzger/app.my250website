# Setup — start here

You're going to run **one command**. It will pause when it needs you to do
something only a human can do (sign in to Cloudflare, paste an API key).
Everything else is automated.

```bash
git clone https://github.com/jgmetzger/app.my250website.git
cd app.my250website
git checkout claude/hospitality-crm-app-MMMYO     # the branch with all the code
./scripts/bootstrap.sh
```

That's it for the terminal part. Everything below is the **browser stuff**
the script can't do — you'll need to do these once in the Cloudflare,
Resend, and Twilio dashboards.

If anything errors at any point, **copy the error and paste it in the chat**.
I'll tell you what to do.

---

## Before you start

You need accounts on three services. Sign up first; the script asks for
the keys later.

### Cloudflare (free, then $5/mo for Workers Paid)
1. <https://dash.cloudflare.com/sign-up>
2. Add the domain `my250website.com` (Add a Site → Free plan is fine).
3. Cloudflare prints two nameservers — point your domain registrar at them.
   Wait until the dashboard shows "Active".
4. **Subscribe to Workers Paid** ($5/mo). Workers → Plans → Workers Paid.
   This unlocks Browser Rendering for the scraper.

### Resend (free up to 100 emails/day)
1. <https://resend.com/signup>
2. Domains → Add Domain → `my250website.com`. Resend gives you DNS records
   to add in Cloudflare (DNS tab on the my250website.com zone).
3. Wait until Resend shows the domain as "Verified".
4. API Keys → Create API Key → save the `re_...` value.

### Twilio (pay-as-you-go, ~£1/mo for the number + a few pence per call)
1. <https://www.twilio.com/try-twilio>
2. Verify your email + phone.
3. **Console → Account Dashboard** — copy `Account SID` and `Auth Token`.
4. **Voice → API Keys** → "Create API Key" → Standard. Copy the SID and Secret
   (Secret is shown ONCE; save it now).
5. **Phone Numbers → Buy a number** — pick a UK number with Voice capability.
   You will need to upload an address proof (passport / utility bill); approval
   takes a day or two. The number costs ~£1/month.
6. **Voice → TwiML Apps** → "Create new TwiML App". Friendly name "WFBR CRM".
   Voice Request URL: `https://app.my250website.com/api/webhooks/twilio/voice`
   (HTTP POST). Save and copy the SID.

---

## Run the bootstrap

From the repo root:

```bash
./scripts/bootstrap.sh
```

Walk through the prompts. The script:

1. Checks Node + pnpm + git are installed
2. Runs `pnpm install`
3. Opens a browser for Cloudflare login (only first time)
4. Creates the D1 database and writes its UUID into `wrangler.toml`
5. Runs the database migrations (creates tables + seeds the email template)
6. Prompts for each Worker secret one by one — paste them in
7. Deploys the Worker (API) and the Pages site (frontend)

You can re-run it any time. It detects what's already done and skips it.

---

## After bootstrap — Cloudflare dashboard clicks

These last steps need the Cloudflare web UI (no terminal equivalent).

### 1. Bind the Pages project to the custom domain

- Workers & Pages → your `app-my250website` project → **Custom domains** tab
- "Set up a custom domain" → enter `app.my250website.com`
- Cloudflare creates a CNAME automatically. Wait ~30 seconds for it to go live.

### 2. Confirm the Worker has the API route

- Workers & Pages → `app-my250website-api` → **Settings → Triggers**
- You should see `app.my250website.com/api/*` listed.
- If not: click "Add Custom Domain" or "Add Route" and add it manually
  (zone: `my250website.com`).

### 3. Test the login

Open `https://app.my250website.com/login` and sign in with the
`APP_PASSWORD` you set during bootstrap. You should land on the Dashboard.

If you get a Cloudflare error page instead, the routing isn't right yet —
paste the error in the chat.

---

## Things that go wrong

**"missing wfbr-crm database"** — the script couldn't auto-detect the D1 id.
Run `cd apps/api && npx wrangler d1 list`, find the row with `wfbr-crm`,
copy the id, paste it into `apps/api/wrangler.toml` (replace
`REPLACE_WITH_D1_ID_FROM_WRANGLER_D1_CREATE`).

**"forbidden" on /api/webhooks/twilio/voice** — the Twilio webhook signature
verifier rejected the request. Means `TWILIO_AUTH_TOKEN` is wrong or
unset. Re-run the script and re-set it.

**Scrape returns 0 results** — Google changed their HTML again. The
selectors live in `apps/api/src/scrape/maps.ts` (`SELECTORS` constant).
The Worker logs `selector_timeout:results_feed` (or whichever) so you
know which one to fix. Paste the error here and I'll update them.

**"daily_cap_reached" when sending email** — you've hit the 15-emails-a-day
limit. Wait until tomorrow, or change `DAILY_EMAIL_CAP` in
`apps/api/wrangler.toml` and redeploy.

**Anything else** — paste it in the chat.

---

## How much will this cost?

Rough monthly minimums when idle:

- Cloudflare Workers Paid: **$5**
- Twilio UK number: **~£1**
- Cloudflare D1: **free** (under 5 GB / 5M reads / 100K writes per day)
- Resend: **free** (under 3,000 emails/month)
- Browser Rendering: pay-per-second; ~£0–£2/month for casual scraping

So **~$5–10/month** at low volume. Calls + emails are pay-as-you-go on top.
