import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BUSINESS_TYPES, type BusinessType, type Lead } from "@app/shared";
import { Layout } from "../components/Layout.js";
import { api } from "../lib/api.js";

export function NewLeadPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    business_name: "",
    business_type: "" as BusinessType | "",
    city: "",
    address: "",
    postcode: "",
    phone: "",
    website_url: "",
    email: "",
    notes: "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(form)
          .map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? undefined : v])
          .filter(([, v]) => v !== undefined),
      );
      const res = await api.post<{ lead: Lead }>("/api/leads", payload);
      navigate(`/leads/${res.lead.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <header className="mb-6">
        <Link to="/leads" className="text-xs text-muted hover:underline">
          ← All leads
        </Link>
        <h1 className="font-serif text-3xl mt-1">
          <span className="italic">New lead</span>
        </h1>
        <p className="text-sm text-muted mt-1">
          Use this for one-offs you've found by hand. Bulk-found leads come through the
          scraper.
        </p>
      </header>

      <form onSubmit={onSubmit} className="card max-w-2xl space-y-4">
        <div>
          <label className="label" htmlFor="business_name">
            Business name *
          </label>
          <input
            id="business_name"
            className="input"
            required
            autoFocus
            value={form.business_name}
            onChange={(e) => set("business_name", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="business_type">
              Type
            </label>
            <select
              id="business_type"
              className="input"
              value={form.business_type}
              onChange={(e) => set("business_type", e.target.value as BusinessType | "")}
            >
              <option value="">—</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="city">
              City
            </label>
            <input
              id="city"
              className="input"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="address">
            Address
          </label>
          <input
            id="address"
            className="input"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="postcode">
              Postcode
            </label>
            <input
              id="postcode"
              className="input"
              value={form.postcode}
              onChange={(e) => set("postcode", e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              className="input"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="website_url">
            Website / social URL
          </label>
          <input
            id="website_url"
            className="input"
            placeholder="https://… (auto-classified into website / social)"
            value={form.website_url}
            onChange={(e) => set("website_url", e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            className="input min-h-[100px]"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>

        {error ? (
          <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Link to="/leads" className="btn-secondary text-sm">
            Cancel
          </Link>
          <button
            type="submit"
            className="btn-primary text-sm"
            disabled={submitting || !form.business_name.trim()}
          >
            {submitting ? "Creating…" : "Create lead"}
          </button>
        </div>
      </form>
    </Layout>
  );
}
