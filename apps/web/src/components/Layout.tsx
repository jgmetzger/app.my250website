import { type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/leads", label: "Leads" },
  { to: "/scrape", label: "Find leads" },
  { to: "/templates", label: "Templates" },
];

export function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  async function logout() {
    await api.post("/api/auth/logout");
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-ink/10 bg-cream/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <NavLink to="/dashboard" className="font-serif text-2xl">
            <span className="italic">WFBR</span> CRM
          </NavLink>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 text-sm rounded-md transition ${
                    isActive
                      ? "bg-ink text-cream"
                      : "text-ink/70 hover:bg-ink/5 hover:text-ink"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <button
              onClick={logout}
              className="ml-2 px-3 py-1.5 text-sm rounded-md text-ink/60 hover:text-ink hover:bg-ink/5"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
      <footer className="border-t border-ink/10 py-4 text-center text-xs text-muted">
        app.my250website.com · single-user
      </footer>
    </div>
  );
}
