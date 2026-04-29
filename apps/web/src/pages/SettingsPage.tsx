import { useEffect, useState } from "react";
import { Layout } from "../components/Layout.js";
import { api } from "../lib/api.js";
import { isWithinUkCallingHours } from "../lib/format.js";

interface Quota {
  sent_today: number;
  daily_cap: number;
  remaining: number;
}

export function SettingsPage() {
  const [quota, setQuota] = useState<Quota | null>(null);
  const [error, setError] = useState<string | null>(null);
  const okToCall = isWithinUkCallingHours();

  useEffect(() => {
    api
      .get<Quota>("/api/email/quota")
      .then(setQuota)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <Layout>
      <header className="mb-6">
        <h1 className="font-serif text-3xl">
          <span className="italic">Settings</span>
        </h1>
        <p className="text-sm text-muted mt-1">
          Single-user app. Most settings live as Worker secrets / vars — change them with{" "}
          <code className="rounded bg-ink/5 px-1 text-xs">wrangler secret put</code> and
          redeploy.
        </p>
      </header>

      {error ? (
        <div role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="card">
          <h2 className="font-serif text-xl mb-3">Email</h2>
          {quota ? (
            <div className="space-y-1 text-sm">
              <Row k="Sent today" v={quota.sent_today.toString()} />
              <Row k="Daily cap" v={quota.daily_cap.toString()} />
              <Row k="Remaining" v={quota.remaining.toString()} />
            </div>
          ) : null}
          <p className="mt-4 text-xs text-muted">
            Cap is set via the <code className="rounded bg-ink/5 px-1">DAILY_EMAIL_CAP</code>{" "}
            var in <code className="rounded bg-ink/5 px-1">wrangler.toml</code>. Sender
            address is{" "}
            <code className="rounded bg-ink/5 px-1">SENDER_EMAIL</code>.
          </p>
        </section>

        <section className="card">
          <h2 className="font-serif text-xl mb-3">Calling</h2>
          <div className="space-y-1 text-sm">
            <Row k="UK calling hours" v="9:00 – 19:00 (Europe/London)" />
            <Row
              k="Right now"
              v={okToCall ? "🟢 OK to call" : "🔴 Outside UK hours"}
            />
          </div>
          <p className="mt-4 text-xs text-muted">
            Calls go out via Twilio with caller ID set to{" "}
            <code className="rounded bg-ink/5 px-1">TWILIO_PHONE_NUMBER</code>.
          </p>
        </section>

        <section className="card md:col-span-2">
          <h2 className="font-serif text-xl mb-3">Password</h2>
          <p className="text-sm text-muted">
            The login password is set via the{" "}
            <code className="rounded bg-ink/5 px-1">APP_PASSWORD</code> Worker secret. To
            change it:
          </p>
          <pre className="mt-3 rounded-md bg-ink/5 p-3 text-xs">
{`cd apps/api
npx wrangler secret put APP_PASSWORD`}
          </pre>
          <p className="mt-3 text-xs text-muted">
            Existing sessions remain valid until their JWT expires (30 days). Sign out and
            back in to re-mint with the new password.
          </p>
        </section>

        <section className="card md:col-span-2">
          <h2 className="font-serif text-xl mb-3">Defaults & limits</h2>
          <ul className="text-sm space-y-1">
            <li>
              <code className="rounded bg-ink/5 px-1">min_reviews</code> default 10,{" "}
              <code className="rounded bg-ink/5 px-1">min_rating</code> default 4.0 — set
              per-scrape on the Find leads form.
            </li>
            <li>CSV import accepts files up to 5 MB.</li>
            <li>JWT session cookie is HttpOnly + Secure, 30-day TTL.</li>
            <li>Anything classified as a "real website" is excluded from scrape inserts.</li>
          </ul>
        </section>
      </div>
    </Layout>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ink/5 py-1.5 last:border-0">
      <span className="text-muted">{k}</span>
      <span className="text-ink font-medium">{v}</span>
    </div>
  );
}
