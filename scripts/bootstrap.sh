#!/usr/bin/env bash
# Interactive bootstrap for app.my250website.com.
# Walks through every terminal step needed to get the app running on
# Cloudflare. Things only YOU can do (browser logins, account sign-ups,
# Twilio number purchase, Cloudflare dashboard clicks) are flagged with
# "ACTION:" and pause the script.
#
# Safe to re-run: each step checks whether it has already been done.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
WRANGLER_TOML="$ROOT/apps/api/wrangler.toml"

# --- helpers -----------------------------------------------------------------

bold()  { printf "\033[1m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow(){ printf "\033[33m%s\033[0m\n" "$*"; }
red()   { printf "\033[31m%s\033[0m\n" "$*"; }
hr()    { printf "\033[2m%s\033[0m\n" "----------------------------------------------------------------"; }

step() { echo; bold "==> $*"; hr; }

pause_for() {
  local prompt="$1"
  echo
  yellow "ACTION: $prompt"
  read -r -p "    Press Enter when done… " _
}

confirm() {
  local prompt="$1"
  read -r -p "    $prompt [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]]
}

prompt_secret() {
  # $1 = secret name, $2 = description
  local name="$1" desc="$2"
  echo
  bold "Setting Worker secret: $name"
  echo "  $desc"
  if confirm "Set $name now?"; then
    (cd apps/api && npx wrangler secret put "$name")
  else
    yellow "  Skipped. Re-run this script later or use:"
    echo  "    cd apps/api && npx wrangler secret put $name"
  fi
}

# --- 0. Prereqs --------------------------------------------------------------

step "Checking prerequisites"

if ! command -v node >/dev/null; then red "Node not installed. Need Node 20+."; exit 1; fi
node_version=$(node --version | sed 's/^v//')
node_major=${node_version%%.*}
if [ "$node_major" -lt 20 ]; then red "Need Node 20+, found $node_version"; exit 1; fi
green "✓ Node $node_version"

if ! command -v pnpm >/dev/null; then red "pnpm not installed. Run: npm install -g pnpm"; exit 1; fi
green "✓ pnpm $(pnpm --version)"

if ! command -v git >/dev/null; then red "git not installed."; exit 1; fi
green "✓ git $(git --version | awk '{print $3}')"

# --- 1. Install --------------------------------------------------------------

step "Installing dependencies"
pnpm install
green "✓ Dependencies installed"

# --- 2. Wrangler login -------------------------------------------------------

step "Cloudflare login"

if (cd apps/api && npx wrangler whoami >/dev/null 2>&1); then
  green "✓ Already logged in to Cloudflare."
else
  yellow "ACTION: a browser window will open. Sign in to your Cloudflare account."
  pause_for "Ready to open the browser?"
  (cd apps/api && npx wrangler login)
fi

# --- 3. D1 database ----------------------------------------------------------

step "D1 database (wfbr-crm)"

if grep -q 'REPLACE_WITH_D1_ID' "$WRANGLER_TOML"; then
  yellow "wrangler.toml still has the D1 placeholder. Creating database now…"
  echo
  d1_output=$(cd apps/api && npx wrangler d1 create wfbr-crm 2>&1 || true)
  echo "$d1_output"
  echo

  d1_id=$(echo "$d1_output" | grep -oE 'database_id = "[^"]+"' | head -1 | sed 's/database_id = "//; s/"$//')

  if [ -z "$d1_id" ]; then
    # Maybe it already exists. Try listing.
    list_output=$(cd apps/api && npx wrangler d1 list 2>&1 || true)
    d1_id=$(echo "$list_output" | grep -E 'wfbr-crm' | awk '{print $2}' | head -1)
  fi

  if [ -z "$d1_id" ]; then
    red "Could not detect D1 database id. Paste it manually:"
    read -r -p "  database_id: " d1_id
  fi

  if [ -z "$d1_id" ]; then red "No D1 id; aborting."; exit 1; fi

  # Cross-platform sed -i.
  sed -i.bak "s|REPLACE_WITH_D1_ID_FROM_WRANGLER_D1_CREATE|$d1_id|" "$WRANGLER_TOML"
  rm -f "$WRANGLER_TOML.bak"
  green "✓ Wrote D1 id $d1_id into wrangler.toml"
else
  green "✓ wrangler.toml already has a D1 id."
fi

step "Running migrations"
echo "Local (for wrangler dev):"
(cd apps/api && npx wrangler d1 execute wfbr-crm --local --file ../../migrations/0001_init.sql) || true
echo
echo "Remote (production):"
(cd apps/api && npx wrangler d1 execute wfbr-crm --remote --file ../../migrations/0001_init.sql) || true
green "✓ Migrations applied (idempotent — safe to re-run)"

# --- 4. Worker secrets -------------------------------------------------------

step "Worker secrets"
echo "We'll prompt you for each secret. Skip any you don't have yet —"
echo "you can re-run this script or use 'wrangler secret put' later."
echo

prompt_secret APP_PASSWORD       "The single login password for the CRM."
prompt_secret JWT_SECRET         "Any random 32+ char string. (Tip: openssl rand -hex 32)"
prompt_secret RESEND_API_KEY     "From resend.com → API Keys."
prompt_secret RESEND_WEBHOOK_SECRET "Optional. From resend.com → Webhooks (starts whsec_)."
prompt_secret TWILIO_ACCOUNT_SID "From twilio.com console (account dashboard, top right)."
prompt_secret TWILIO_AUTH_TOKEN  "From twilio.com console (next to Account SID)."
prompt_secret TWILIO_API_KEY     "From Voice → API Keys. Create a Standard key."
prompt_secret TWILIO_API_SECRET  "From the same key (only shown once)."
prompt_secret TWILIO_TWIML_APP_SID "From Voice → TwiML Apps. SEE NOTE BELOW."
prompt_secret TWILIO_PHONE_NUMBER "Your purchased UK number, e.g. +441234567890."

# --- 5. Deploy ---------------------------------------------------------------

step "Deploy"

if confirm "Deploy the Worker (API) now?"; then
  (cd apps/api && npx wrangler deploy)
  green "✓ Worker deployed"
else
  yellow "Skipped. Run later: pnpm deploy:api"
fi

if confirm "Build and deploy the frontend (Pages) now?"; then
  pnpm --filter @app/web build
  npx wrangler pages deploy apps/web/dist --project-name=app-my250website
  green "✓ Frontend deployed"
else
  yellow "Skipped. Run later: pnpm build:web && pnpm deploy:web"
fi

# --- 6. Manual stuff ---------------------------------------------------------

step "Manual stuff that must happen in browsers / dashboards"

cat <<'NOTE'
The following steps cannot be automated from a terminal. See SETUP.md
for screenshots-style instructions.

1. CLOUDFLARE PAGES → bind app.my250website.com as a custom domain.
   (Workers → Pages → app-my250website → Custom domains → Set up.)

2. CLOUDFLARE WORKERS → confirm route app.my250website.com/api/* points
   at app-my250website-api. wrangler usually adds it automatically.

3. RESEND → Domains → add and verify my250website.com (DNS records).
   Then create a Webhook pointing at
   https://app.my250website.com/api/webhooks/resend, copy the signing
   secret (whsec_…) and re-run this script to set RESEND_WEBHOOK_SECRET.

4. TWILIO → Phone Numbers → buy a UK number, add address proof.

5. TWILIO → Voice → TwiML Apps → Create. Voice Request URL:
   https://app.my250website.com/api/webhooks/twilio/voice
   Copy the SID and re-run this script to set TWILIO_TWIML_APP_SID.

6. Visit https://app.my250website.com/login and sign in with APP_PASSWORD.
NOTE

green "Bootstrap finished."
