import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";

export function DashboardPage() {
  const navigate = useNavigate();

  async function logout() {
    await api.post("/api/auth/logout");
    navigate("/login", { replace: true });
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <header className="mx-auto mb-10 flex max-w-5xl items-center justify-between">
        <h1 className="font-serif text-3xl">
          <span className="italic">Dashboard</span>
        </h1>
        <button onClick={logout} className="btn-secondary text-sm">
          Sign out
        </button>
      </header>
      <section className="mx-auto max-w-5xl">
        <div className="card">
          <h2 className="font-serif text-2xl mb-2">Foundation deployed</h2>
          <p className="text-muted">
            Auth is working. Phase 2 (leads CRUD), 3 (scraping), 4 (email), 5 (calls), 6 (stats),
            and 7 (CSV import) will fill out the rest of the app.
          </p>
        </div>
      </section>
    </main>
  );
}
