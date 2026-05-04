import { useEffect, useRef, useState } from "react";
import { Device, type Call } from "@twilio/voice-sdk";
import type { CallOutcome, Lead } from "@app/shared";
import { api } from "../lib/api.js";
import { useConfig } from "../lib/config.js";

type CallPhase = "idle" | "connecting" | "ringing" | "live" | "ended" | "error";

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
  const config = useConfig();
  const canBrowserCall = Boolean(config.features.twilio) && Boolean(lead.phone);

  const [phase, setPhase] = useState<CallPhase>("idle");
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      callRef.current?.disconnect();
      deviceRef.current?.destroy();
    };
  }, []);

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

  async function startBrowserCall() {
    if (!lead.phone) return;
    setCallError(null);
    setPhase("connecting");
    try {
      const tok = await api.get<{ token: string }>("/api/calls/token");
      const device = new Device(tok.token, { logLevel: "warn" });
      deviceRef.current = device;
      device.on("error", (err: { message?: string }) => {
        setCallError(err?.message ?? "Twilio device error");
        setPhase("error");
      });
      const call = await device.connect({ params: { To: lead.phone } });
      callRef.current = call;
      setPhase("ringing");
      call.on("accept", () => {
        startedAtRef.current = Date.now();
        setPhase("live");
        timerRef.current = window.setInterval(() => {
          if (startedAtRef.current) {
            setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
          }
        }, 500);
      });
      call.on("disconnect", () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        const finalSeconds = startedAtRef.current
          ? Math.floor((Date.now() - startedAtRef.current) / 1000)
          : 0;
        setSeconds(finalSeconds);
        if (finalSeconds > 0) {
          setDurationMinutes((finalSeconds / 60).toFixed(2));
        }
        setPhase("ended");
      });
      call.on("error", (err: { message?: string }) => {
        setCallError(err?.message ?? "Call error");
        setPhase("error");
      });
    } catch (e) {
      setCallError(e instanceof Error ? e.message : "Could not start call");
      setPhase("error");
    }
  }

  function toggleMute() {
    const next = !muted;
    callRef.current?.mute(next);
    setMuted(next);
  }

  function hangup() {
    callRef.current?.disconnect();
  }

  async function logOutcome() {
    if (!outcome) return;
    setSaving(true);
    setSaveError(null);
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
      setSaveError(e instanceof Error ? e.message : "Log failed");
      setSaving(false);
    }
  }

  const inCall = phase === "connecting" || phase === "ringing" || phase === "live";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      role="dialog"
      aria-modal
      onClick={inCall ? undefined : onClose}
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

        {/* In-call panel — replaces the rest of the modal while a browser call is active. */}
        {inCall ? (
          <div className="mt-6 text-center">
            {phase === "connecting" ? (
              <div className="text-muted animate-pulse">Connecting…</div>
            ) : null}
            {phase === "ringing" ? (
              <div className="text-muted animate-pulse">Ringing…</div>
            ) : null}
            {phase === "live" ? (
              <>
                <div className="font-serif text-5xl">{formatTimer(seconds)}</div>
                <div className="mt-6 flex justify-center gap-3">
                  <button
                    onClick={toggleMute}
                    className={`btn-secondary text-sm ${muted ? "ring-2 ring-amber-400" : ""}`}
                  >
                    {muted ? "Unmute" : "Mute"}
                  </button>
                  <button
                    onClick={hangup}
                    className="btn-primary text-sm bg-red-500 text-white"
                  >
                    Hang up
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <>
            {phase === "error" && callError ? (
              <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                Call failed: {callError}
              </div>
            ) : null}

            {phase === "ended" ? (
              <div className="mt-4 text-sm text-muted">
                Call ended after {formatTimer(seconds)}. Pick an outcome below to log it.
              </div>
            ) : null}

            {/* Browser-dial CTA only appears when not yet ended/erroring AND Twilio voice is configured. */}
            {phase === "idle" && canBrowserCall ? (
              <div className="mt-6">
                <button
                  onClick={startBrowserCall}
                  className="btn-primary w-full text-sm"
                  title="Dial via Twilio in this browser tab"
                >
                  🎙️ Call from browser
                </button>
                <div className="mt-2 text-center text-xs text-muted">
                  Or call from your phone and just log the outcome below.
                </div>
              </div>
            ) : null}

            {phase === "idle" && !canBrowserCall ? (
              <div className="mt-6 text-sm text-muted">
                Call from your phone, then log the result here.
              </div>
            ) : null}

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

            {saveError ? (
              <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {saveError}
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
          </>
        )}
      </div>
    </div>
  );
}

function formatTimer(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
