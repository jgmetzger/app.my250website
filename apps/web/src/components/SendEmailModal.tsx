import { useEffect, useMemo, useState } from "react";
import type { EmailTemplate, Lead } from "@app/shared";
import { api } from "../lib/api.js";
import { leadVars, renderTemplate } from "../lib/template.js";

interface QuotaResponse {
  sent_today: number;
  daily_cap: number;
  remaining: number;
}

interface TemplatesResponse {
  templates: EmailTemplate[];
}

export function SendEmailModal({
  lead,
  onClose,
  onSent,
}: {
  lead: Lead;
  onClose: () => void;
  onSent: () => void;
}) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [quota, setQuota] = useState<QuotaResponse | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vars = useMemo(() => leadVars(lead), [lead]);

  useEffect(() => {
    Promise.all([
      api.get<TemplatesResponse>("/api/email/templates"),
      api.get<QuotaResponse>("/api/email/quota"),
    ])
      .then(([t, q]) => {
        setTemplates(t.templates);
        setQuota(q);
        const def = t.templates.find((x) => x.is_default === 1) ?? t.templates[0];
        if (def) {
          setTemplateId(def.id);
          setSubject(renderTemplate(def.subject, vars));
          setBodyText(renderTemplate(def.body, vars));
        }
      })
      .catch((e: Error) => setError(e.message));
  }, [vars]);

  function pickTemplate(id: number) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setSubject(renderTemplate(t.subject, vars));
    setBodyText(renderTemplate(t.body, vars));
  }

  async function send() {
    if (!templateId) return;
    setSending(true);
    setError(null);
    try {
      await api.post("/api/email/send", {
        lead_id: lead.id,
        template_id: templateId,
        subject_override: subject,
        body_override: bodyText,
      });
      onSent();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  const capExhausted = quota ? quota.remaining <= 0 : false;
  const canSend = !!lead.email && !!templateId && subject.trim() && bodyText.trim() && !capExhausted;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      role="dialog"
      aria-modal
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-serif text-2xl">Send email</h2>
            <p className="text-sm text-muted">to {lead.email ?? "<no email on file>"}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink">
            ✕
          </button>
        </header>

        {!lead.email ? (
          <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Add an email address to this lead first.
          </div>
        ) : null}

        <div className="space-y-3">
          <div>
            <label className="label">Template</label>
            <select
              className="input"
              value={templateId ?? ""}
              onChange={(e) => pickTemplate(Number(e.target.value))}
            >
              {templates.length === 0 ? (
                <option value="">No templates yet</option>
              ) : null}
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.is_default ? " (default)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Subject</label>
            <input
              className="input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Body</label>
            <textarea
              className="input min-h-[280px] font-mono text-xs"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
            />
          </div>

          {quota ? (
            <div
              className={`rounded-md px-3 py-2 text-xs ${
                capExhausted ? "bg-red-50 text-red-700" : "bg-ink/5 text-muted"
              }`}
            >
              {quota.sent_today} of {quota.daily_cap} emails sent today
              {capExhausted ? " — daily cap reached." : null}
            </div>
          ) : null}

          {error ? (
            <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-secondary text-sm">
              Cancel
            </button>
            <button
              onClick={send}
              disabled={!canSend || sending}
              className="btn-primary text-sm"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
