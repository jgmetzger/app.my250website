import { useEffect, useMemo, useState } from "react";
import type { EmailTemplate } from "@app/shared";
import { Layout } from "../components/Layout.js";
import { api } from "../lib/api.js";
import { SAMPLE_VARS, renderTemplate } from "../lib/template.js";

interface ListResponse {
  templates: EmailTemplate[];
}

const VAR_NAMES = Object.keys(SAMPLE_VARS);

export function TemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<number | "new" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const r = await api.get<ListResponse>("/api/email/templates");
      setTemplates(r.templates);
      if (selectedId === null && r.templates.length > 0) {
        setSelectedId(r.templates[0]?.id ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  const selected = useMemo(() => {
    if (selectedId === "new" || selectedId === null) return null;
    return templates.find((t) => t.id === selectedId) ?? null;
  }, [templates, selectedId]);

  return (
    <Layout>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl">
            <span className="italic">Email templates</span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Use {`{{business_name}}`}, {`{{rating}}`}, {`{{review_count}}`},{" "}
            {`{{city}}`}, {`{{business_type}}`} as merge tokens.
          </p>
        </div>
        <button onClick={() => setSelectedId("new")} className="btn-primary text-sm">
          + New template
        </button>
      </header>

      {error ? (
        <div role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-12 md:col-span-3">
          <div className="card p-0 overflow-hidden">
            {loading && templates.length === 0 ? (
              <div className="p-4 text-sm text-muted">Loading…</div>
            ) : templates.length === 0 && selectedId !== "new" ? (
              <div className="p-4 text-sm text-muted">No templates yet.</div>
            ) : (
              <ul>
                {templates.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => setSelectedId(t.id)}
                      className={`w-full text-left px-4 py-3 border-b border-ink/5 ${
                        selectedId === t.id ? "bg-ink/5 font-medium" : "hover:bg-ink/[0.02]"
                      }`}
                    >
                      <div className="truncate">{t.name}</div>
                      {t.is_default ? (
                        <div className="text-xs text-emerald-700 mt-0.5">Default</div>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className="col-span-12 md:col-span-9">
          {selectedId === "new" ? (
            <TemplateForm
              key="new"
              template={null}
              onSaved={async (saved) => {
                await refresh();
                setSelectedId(saved.id);
              }}
              onCancel={() => setSelectedId(templates[0]?.id ?? null)}
            />
          ) : selected ? (
            <TemplateForm
              key={selected.id}
              template={selected}
              onSaved={async () => {
                await refresh();
              }}
              onDeleted={async () => {
                await refresh();
                setSelectedId(templates.filter((t) => t.id !== selected.id)[0]?.id ?? null);
              }}
              onCancel={() => undefined}
            />
          ) : (
            <div className="card text-muted">
              Pick a template on the left, or create a new one.
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}

interface TemplateFormProps {
  template: EmailTemplate | null;
  onSaved: (t: EmailTemplate) => void | Promise<void>;
  onDeleted?: () => void | Promise<void>;
  onCancel: () => void;
}

function TemplateForm({ template, onSaved, onDeleted, onCancel }: TemplateFormProps) {
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [isDefault, setIsDefault] = useState(template?.is_default === 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewSubject = useMemo(() => renderTemplate(subject, SAMPLE_VARS), [subject]);
  const previewBody = useMemo(() => renderTemplate(body, SAMPLE_VARS), [body]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = { name, subject, body, is_default: isDefault };
      if (template) {
        const r = await api.put<{ template: EmailTemplate }>(
          `/api/email/templates/${template.id}`,
          payload,
        );
        await onSaved(r.template);
      } else {
        const r = await api.post<{ template: EmailTemplate }>(`/api/email/templates`, payload);
        await onSaved(r.template);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!template) return;
    if (!confirm("Delete this template?")) return;
    try {
      await api.delete(`/api/email/templates/${template.id}`);
      await onDeleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="card space-y-3">
        <div>
          <label className="label" htmlFor="t-name">
            Name (internal)
          </label>
          <input
            id="t-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="t-subject">
            Subject
          </label>
          <input
            id="t-subject"
            className="input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="t-body">
            Body
          </label>
          <textarea
            id="t-body"
            className="input min-h-[260px] font-mono text-xs"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="mt-1 text-xs text-muted">
            Tokens:{" "}
            {VAR_NAMES.map((v) => (
              <code key={v} className="rounded bg-ink/5 px-1 mr-1">
                {`{{${v}}}`}
              </code>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          Default template
        </label>
        {error ? (
          <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <div className="flex justify-between">
          <div className="flex gap-2">
            {template ? (
              <button onClick={remove} className="btn-secondary text-sm text-red-700">
                Delete
              </button>
            ) : (
              <button onClick={onCancel} className="btn-secondary text-sm">
                Cancel
              </button>
            )}
          </div>
          <button
            onClick={save}
            disabled={saving || !name.trim() || !subject.trim() || !body.trim()}
            className="btn-primary text-sm"
          >
            {saving ? "Saving…" : template ? "Save changes" : "Create"}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="text-xs text-muted mb-2">Preview · sample lead</div>
        <div className="text-xs text-muted">Subject</div>
        <div className="font-medium mb-3">{previewSubject || <em className="text-muted">empty</em>}</div>
        <div className="text-xs text-muted">Body</div>
        <pre className="mt-1 whitespace-pre-wrap text-sm text-ink/90">
          {previewBody || <em className="text-muted">empty</em>}
        </pre>
      </div>
    </div>
  );
}
