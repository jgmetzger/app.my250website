import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  BUSINESS_TYPES,
  LEAD_STATUSES,
  type Activity,
  type BusinessType,
  type Lead,
  type LeadStatus,
  type WebsiteStatus,
} from "@app/shared";
import { Layout } from "../components/Layout.js";
import { StatusBadge, WebsiteBadge } from "../components/Badge.js";
import { CallModal } from "../components/CallModal.js";
import { FindEmailSidebar } from "../components/FindEmailSidebar.js";
import { SendEmailModal } from "../components/SendEmailModal.js";
import { api } from "../lib/api.js";
import { useConfig } from "../lib/config.js";
import { formatDateTime, formatRelative, isWithinUkCallingHours } from "../lib/format.js";

interface DetailResponse {
  lead: Lead;
  activities: Activity[];
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  sourced: "Sourced",
  researched: "Researched",
  contacted: "Contacted",
  replied: "Replied",
  form_submitted: "Form submitted",
  building: "Building",
  live: "Live",
  lost: "Lost",
};

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const leadId = Number(id);
  const navigate = useNavigate();
  const config = useConfig();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [postingNote, setPostingNote] = useState(false);
  const [okToCall] = useState(isWithinUkCallingHours());
  const [showSendEmail, setShowSendEmail] = useState(false);
  const [showCall, setShowCall] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<DetailResponse>(`/api/leads/${leadId}`)
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  async function patch(field: string, value: unknown) {
    if (!data) return;
    setSavingField(field);
    // Optimistic update.
    const prev = data;
    setData({ ...data, lead: { ...data.lead, [field]: value } as Lead });
    try {
      const r = await api.patch<{ lead: Lead }>(`/api/leads/${leadId}`, { [field]: value });
      setData((d) => (d ? { ...d, lead: r.lead } : d));
    } catch (e) {
      setData(prev);
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSavingField(null);
    }
  }

  async function changeStatus(next: LeadStatus) {
    if (!data || data.lead.status === next) return;
    setSavingField("status");
    try {
      await api.post<{ lead: Lead }>(`/api/leads/${leadId}/status`, { status: next });
      const fresh = await api.get<DetailResponse>(`/api/leads/${leadId}`);
      setData(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status change failed");
    } finally {
      setSavingField(null);
    }
  }

  async function postNote() {
    if (!noteDraft.trim()) return;
    setPostingNote(true);
    try {
      await api.post(`/api/leads/${leadId}/note`, { body: noteDraft.trim() });
      setNoteDraft("");
      const fresh = await api.get<DetailResponse>(`/api/leads/${leadId}`);
      setData(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Note failed");
    } finally {
      setPostingNote(false);
    }
  }

  async function deleteLead() {
    if (!confirm("Delete this lead permanently? Activities go with it.")) return;
    try {
      await api.delete(`/api/leads/${leadId}`);
      navigate("/leads", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  if (loading) return <Layout><div className="text-muted">Loading lead…</div></Layout>;
  if (!data) {
    return (
      <Layout>
        <div className="card text-center">
          <p className="text-muted mb-4">{error ?? "Lead not found."}</p>
          <Link to="/leads" className="btn-secondary text-sm">← Back to leads</Link>
        </div>
      </Layout>
    );
  }

  const { lead, activities } = data;

  return (
    <Layout>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link to="/leads" className="text-xs text-muted hover:underline">
            ← All leads
          </Link>
          <h1 className="font-serif text-3xl mt-1 break-words">
            <span className="italic">{lead.business_name}</span>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={lead.status} />
            <WebsiteBadge status={lead.website_status as WebsiteStatus | null} />
            {lead.phone ? (
              <span
                className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                  okToCall ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                }`}
                title={okToCall ? "Within UK calling hours" : "Outside UK 9am–7pm"}
              >
                {okToCall ? "🟢 OK to call" : "🔴 Outside UK hours"}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCall(true)}
            disabled={!lead.phone}
            className="btn-primary text-sm"
            title={
              lead.phone
                ? "Log a call you made from your phone"
                : "Add a phone number first"
            }
          >
            📞 Log call
          </button>
          <button
            onClick={() => setShowSendEmail(true)}
            disabled={!lead.email || !config.features.resend}
            className="btn-primary text-sm"
            title={
              !config.features.resend
                ? "Email not active yet — set RESEND_API_KEY and redeploy"
                : lead.email
                  ? "Send email"
                  : "Add an email first"
            }
          >
            ✉️ Send email
          </button>
          <button onClick={deleteLead} className="btn-secondary text-sm text-red-700">
            Delete
          </button>
        </div>
      </header>

      {error ? (
        <div role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-12 gap-6">
        {/* Left: details */}
        <section className="col-span-12 lg:col-span-7 space-y-6">
          <div className="card space-y-4">
            <h2 className="font-serif text-xl">Business info</h2>
            <Field
              label="Business name"
              value={lead.business_name}
              saving={savingField === "business_name"}
              onSave={(v) => patch("business_name", v)}
            />
            <SelectField
              label="Type"
              value={lead.business_type ?? ""}
              options={[["", "—"], ...BUSINESS_TYPES.map((t) => [t, t] as [string, string])]}
              saving={savingField === "business_type"}
              onSave={(v) => patch("business_type", v === "" ? null : (v as BusinessType))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="City"
                value={lead.city ?? ""}
                saving={savingField === "city"}
                onSave={(v) => patch("city", v || null)}
              />
              <Field
                label="Postcode"
                value={lead.postcode ?? ""}
                saving={savingField === "postcode"}
                onSave={(v) => patch("postcode", v || null)}
              />
            </div>
            <Field
              label="Address"
              value={lead.address ?? ""}
              saving={savingField === "address"}
              onSave={(v) => patch("address", v || null)}
            />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="label">Google rating</div>
                <div className="text-ink">
                  {lead.google_rating != null
                    ? `${lead.google_rating.toFixed(1)} (${lead.google_review_count ?? 0})`
                    : "—"}
                </div>
              </div>
              {lead.google_maps_url ? (
                <div>
                  <div className="label">Maps</div>
                  <a
                    href={lead.google_maps_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink underline"
                  >
                    Open Google Maps ↗
                  </a>
                </div>
              ) : null}
            </div>
          </div>

          <div className="card space-y-4">
            <h2 className="font-serif text-xl">Contact</h2>
            <Field
              label="Phone"
              value={lead.phone ?? ""}
              saving={savingField === "phone"}
              onSave={(v) => patch("phone", v || null)}
            />
            <Field
              label="Email"
              type="email"
              value={lead.email ?? ""}
              saving={savingField === "email"}
              onSave={(v) => patch("email", v || null)}
            />
            <Field
              label="Email source"
              placeholder="Facebook bio, Instagram bio, Google search…"
              value={lead.email_source ?? ""}
              saving={savingField === "email_source"}
              onSave={(v) => patch("email_source", v || null)}
            />
            <Field
              label="Website URL"
              value={lead.website_url ?? ""}
              saving={savingField === "website_url"}
              onSave={(v) => patch("website_url", v || null)}
            />
          </div>

          <div className="card space-y-3">
            <h2 className="font-serif text-xl">Notes</h2>
            <TextareaField
              value={lead.notes ?? ""}
              saving={savingField === "notes"}
              onSave={(v) => patch("notes", v || null)}
            />
          </div>

          <div className="card space-y-3">
            <h2 className="font-serif text-xl">Pipeline stage</h2>
            <div className="flex flex-wrap gap-2">
              {LEAD_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  disabled={savingField === "status"}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                    s === lead.status
                      ? "bg-ink text-cream"
                      : "bg-ink/5 text-ink/70 hover:bg-ink/10"
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right: timeline + actions */}
        <aside className="col-span-12 lg:col-span-5 space-y-6">
          <FindEmailSidebar lead={lead} />
          <div className="card space-y-3">
            <h2 className="font-serif text-xl">Add note</h2>
            <textarea
              className="input min-h-[90px]"
              placeholder="What happened?"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
            />
            <button
              className="btn-primary text-sm"
              onClick={postNote}
              disabled={!noteDraft.trim() || postingNote}
            >
              {postingNote ? "Saving…" : "Add note"}
            </button>
          </div>

          <div className="card">
            <h2 className="font-serif text-xl mb-3">Activity</h2>
            {activities.length === 0 ? (
              <div className="text-sm text-muted">No activity yet.</div>
            ) : (
              <ol className="relative space-y-4 border-l border-ink/10 pl-4">
                {activities.map((a) => (
                  <li key={a.id} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-ink">{labelFor(a)}</span>
                      <span
                        className="text-xs text-muted"
                        title={formatDateTime(a.created_at)}
                      >
                        {formatRelative(a.created_at)}
                      </span>
                    </div>
                    {a.subject ? <div className="text-muted">{a.subject}</div> : null}
                    {a.body ? (
                      <p className="mt-1 whitespace-pre-wrap text-ink/80">{a.body}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>

      {showSendEmail ? (
        <SendEmailModal
          lead={lead}
          onClose={() => setShowSendEmail(false)}
          onSent={async () => {
            const fresh = await api.get<DetailResponse>(`/api/leads/${leadId}`);
            setData(fresh);
          }}
        />
      ) : null}

      {showCall ? (
        <CallModal
          lead={lead}
          onClose={() => setShowCall(false)}
          onLogged={async () => {
            const fresh = await api.get<DetailResponse>(`/api/leads/${leadId}`);
            setData(fresh);
          }}
        />
      ) : null}
    </Layout>
  );
}

function labelFor(a: Activity): string {
  switch (a.type) {
    case "email_sent":
      return "Email sent";
    case "email_delivered":
      return "Email delivered";
    case "email_opened":
      return "Email opened";
    case "email_bounced":
      return "Email bounced";
    case "email_replied":
      return "Reply received";
    case "call_made":
      return `Call · ${a.outcome ?? "logged"}`;
    case "call_received":
      return "Call received";
    case "note":
      return "Note";
    case "status_change":
      return "Status changed";
    case "form_submitted":
      return "Intake form submitted";
    default:
      return a.type;
  }
}

interface FieldProps {
  label: string;
  value: string;
  saving?: boolean;
  type?: string;
  placeholder?: string;
  onSave: (value: string) => void;
}

function Field({ label, value, saving, type = "text", placeholder, onSave }: FieldProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type={type}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onSave(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setDraft(value);
        }}
        disabled={saving}
      />
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: Array<[string, string]>;
  saving?: boolean;
  onSave: (value: string) => void;
}

function SelectField({ label, value, options, saving, onSave }: SelectFieldProps) {
  return (
    <div>
      <label className="label">{label}</label>
      <select
        className="input"
        value={value}
        disabled={saving}
        onChange={(e) => {
          if (e.target.value !== value) onSave(e.target.value);
        }}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextareaField({
  value,
  saving,
  onSave,
}: {
  value: string;
  saving?: boolean;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <textarea
      className="input min-h-[120px]"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onSave(draft);
      }}
      disabled={saving}
    />
  );
}

