import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../lib/api.js";

export function LoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/api/auth/login", { password });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_password") {
        setError("That password doesn't match.");
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-4xl">
            <span className="italic">WFBR</span> CRM
          </h1>
          <p className="mt-2 text-sm text-muted">Websites for Bars &amp; Restaurants</p>
        </div>
        <form onSubmit={onSubmit} className="card space-y-4">
          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoFocus
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          {error ? (
            <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <button type="submit" className="btn-primary w-full" disabled={submitting || !password}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-muted">
          Single-user app. Password is set via Worker env.
        </p>
      </div>
    </main>
  );
}
