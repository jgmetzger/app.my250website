import { useState } from "react";
import type { CallOutcome, Lead } from "@app/shared";
import { api } from "../lib/api.js";

const OUTCOMES: Array<{ value: CallOutcome; label: string }> = [
  { value: "no_answer", label: "No answer" },
  { value: "voicemail", label: "Voicemail left" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
  { value: "callback", label: "Callback requested" },
  { value: "wrong_number", label: "Wrong number" },
];

export function CallModal({
  lead,
  onClose,
  onLogged,
}: {
  lead: Lead;
  onClose: () => void;
  onLogged: () => void;
}) {
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyPhone() {
    if (!lead.phone) return;
    try {
      await navigator.clipboard.writeText(lead.phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // navigator.clipboard fails on insecure contexts; ignore.
    }
  }

  async function logOutcome() {
    if (!outcome) return;
    setSaving(true);
    setError(null);
    const minutes = parseFloat(durationMinutes);
    const duration_seconds =
      Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : 0;
    try {
      await api.post("/api/calls/log", {
        lead_id: lead.id,
        duration_seconds,
        outcome,
        notes: outcomeNotes.trim() || undefined,
      });
      onLogged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Log failed");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      role="dialog"
      aria-modal
      onClick={onClose}
    >
      <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-serif text-2xl">{lead.business_name}</h2>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted">
          <span>{lead.phone ?? "(no phone on file)"}</span>
          {lead.phone ? (
            <button onClick={copyPhone} className="btn-secondary text-xs px-2 py-1">
              {copied ? "✓ Copied" : "Copy"}
            </button>
          ) : null}
        </div>

        <div className="mt-6 text-sm text-muted">
          Call from your phone, then log the result here.
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {OUTCOMES.map((o) => (
            <button
              key={o.value}
              onClick={() => setOutcome(o.value)}
              className={`rounded px-3 py-2 text-sm transition ${
                outcome === o.value ? "bg-ink text-cream" : "bg-ink/5 hover:bg-ink/10"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <label className="mt-3 block text-sm">
          <span className="text-muted">Duration (minutes, optional)</span>
          <input
            type="number"
            min="0"
            step="0.5"
            inputMode="decimal"
            className="input"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            placeholder="e.g. 2.5"
          />
        </label>

        <textarea
          className="input mt-3 min-h-[80px]"
          placeholder="Optional notes — what was said, next step, etc."
          value={outcomeNotes}
          onChange={(e) => setOutcomeNotes(e.target.value)}
        />

        {error ? (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4 flex justify-between">
          <button onClick={onClose} className="btn-secondary text-sm" disabled={saving}>
            Cancel
          </button>
          <button
            onClick={logOutcome}
            disabled={!outcome || saving}
            className="btn-primary text-sm"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
