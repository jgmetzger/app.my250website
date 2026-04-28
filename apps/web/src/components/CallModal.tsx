import { useEffect, useRef, useState } from "react";
import { Device, type Call } from "@twilio/voice-sdk";
import type { CallOutcome, Lead } from "@app/shared";
import { api } from "../lib/api.js";

type Phase = "connecting" | "ringing" | "live" | "ended" | "logging" | "error";

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
  const [phase, setPhase] = useState<Phase>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState("");

  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!lead.phone) {
        setError("This lead has no phone number on file.");
        setPhase("error");
        return;
      }
      try {
        const tok = await api.get<{ token: string }>("/api/calls/token");
        if (cancelled) return;
        const device = new Device(tok.token, {
          // Disable Twilio's own debug log spam.
          logLevel: "warn",
        });
        deviceRef.current = device;
        device.on("error", (err: { message?: string }) => {
          setError(err?.message ?? "Twilio device error");
          setPhase("error");
        });
        const call = await device.connect({ params: { To: lead.phone } });
        if (cancelled) {
          call.disconnect();
          return;
        }
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
          setPhase("ended");
        });
        call.on("error", (err: { message?: string }) => {
          setError(err?.message ?? "Call error");
          setPhase("error");
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start call");
        setPhase("error");
      }
    }
    start();
    return () => {
      cancelled = true;
      if (timerRef.current) window.clearInterval(timerRef.current);
      callRef.current?.disconnect();
      deviceRef.current?.destroy();
    };
  }, [lead.phone]);

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
    setPhase("logging");
    try {
      await api.post("/api/calls/log", {
        lead_id: lead.id,
        duration_seconds: seconds,
        outcome,
        notes: outcomeNotes.trim() || undefined,
      });
      onLogged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Log failed");
      setPhase("ended");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      role="dialog"
      aria-modal
      onClick={() => phase === "ended" || phase === "error" ? onClose() : undefined}
    >
      <div
        className="card w-full max-w-md text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-2xl">{lead.business_name}</h2>
        <div className="text-sm text-muted">{lead.phone}</div>

        {(phase === "connecting" || phase === "ringing") ? (
          <div className="mt-6 text-muted animate-pulse">
            {phase === "connecting" ? "Connecting…" : "Ringing…"}
          </div>
        ) : null}

        {phase === "live" ? (
          <>
            <div className="mt-6 font-serif text-5xl">{formatTimer(seconds)}</div>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={toggleMute}
                className={`btn-secondary text-sm ${muted ? "ring-2 ring-amber-400" : ""}`}
              >
                {muted ? "Unmute" : "Mute"}
              </button>
              <button onClick={hangup} className="btn-primary text-sm bg-red-500 text-white">
                Hang up
              </button>
            </div>
          </>
        ) : null}

        {phase === "ended" ? (
          <>
            <div className="mt-6 text-sm text-muted">
              Call ended after {formatTimer(seconds)}. How did it go?
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
            <textarea
              className="input mt-3 min-h-[80px]"
              placeholder="Optional notes…"
              value={outcomeNotes}
              onChange={(e) => setOutcomeNotes(e.target.value)}
            />
            <div className="mt-3 flex justify-between">
              <button onClick={onClose} className="btn-secondary text-sm">
                Skip logging
              </button>
              <button
                onClick={logOutcome}
                disabled={!outcome}
                className="btn-primary text-sm"
              >
                Save
              </button>
            </div>
          </>
        ) : null}

        {phase === "logging" ? (
          <div className="mt-6 text-muted">Saving…</div>
        ) : null}

        {phase === "error" ? (
          <>
            <div className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error ?? "Call failed."}
            </div>
            <button onClick={onClose} className="btn-secondary text-sm mt-4">
              Close
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function formatTimer(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
