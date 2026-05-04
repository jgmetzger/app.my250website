import { useState } from "react";
import type { Lead } from "@app/shared";
import { api } from "../lib/api.js";

const MAX_LENGTH = 1600; // Twilio's hard cap (10 SMS segments).

export function SMSModal({
  lead,
  onClose,
  onSent,
}: {
  lead: Lead;
  onClose: () => void;
  onSent: () => void;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Twilio: 1 segment = 160 chars (GSM-7) or 70 chars (UCS-2). Use a simple
  // GSM-7 estimate; concatenated messages spend 153/67 chars per segment.
  const len = body.length;
  const segments =
    len === 0 ? 0 : len <= 160 ? 1 : Math.ceil(len / 153);

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api.post("/api/sms/send", {
        lead_id: lead.id,
        body: body.trim(),
      });
      onSent();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      role="dialog"
      aria-modal
      onClick={sending ? undefined : onClose}
    >
      <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-serif text-2xl">Send SMS</h2>
        <div className="mt-1 text-sm text-muted">
          To <span className="text-ink">{lead.business_name}</span> — {lead.phone}
        </div>

        <textarea
          className="input mt-4 min-h-[160px]"
          placeholder="Type your message…"
          maxLength={MAX_LENGTH}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          autoFocus
        />

        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>{len} / {MAX_LENGTH} chars</span>
          <span>
            {segments === 0 ? "—" : `${segments} segment${segments === 1 ? "" : "s"}`}
          </span>
        </div>

        {error ? (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4 flex justify-between">
          <button onClick={onClose} className="btn-secondary text-sm" disabled={sending}>
            Cancel
          </button>
          <button
            onClick={send}
            disabled={!body.trim() || sending}
            className="btn-primary text-sm"
          >
            {sending ? "Sending…" : "Send SMS"}
          </button>
        </div>
      </div>
    </div>
  );
}
