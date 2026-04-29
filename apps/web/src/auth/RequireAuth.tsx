import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ApiError, api } from "../lib/api.js";

type State = "checking" | "authed" | "unauthed";

export function RequireAuth({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>("checking");
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ ok: boolean }>("/api/auth/me")
      .then(() => {
        if (!cancelled) setState("authed");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) setState("unauthed");
        else setState("unauthed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        <div className="animate-pulse text-sm">Checking session…</div>
      </div>
    );
  }
  if (state === "unauthed") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
