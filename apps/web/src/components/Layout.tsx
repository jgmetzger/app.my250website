import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/leads", label: "Leads" },
  { to: "/scrape", label: "Find leads" },
  { to: "/templates", label: "Templates" },
  { to: "/settings", label: "Settings" },
];

export function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close drawer on route change.
  useEffect(() => setOpen(false), [location.pathname]);

  async function logout() {
    await api.post("/api/auth/logout");
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 rounded bg-ink px-3 py-1 text-cream text-sm"
      >
        Skip to content
      </a>

      <header className="border-b border-ink/10 bg-cream/80 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-4">
          <NavLink to="/dashboard" className="font-serif text-2xl">
            <span className="italic">WFBR</span> CRM
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
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

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen((o) => !o)}
            className="md:hidden p-2 rounded-md hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <>
                  <path d="M4 7h16" strokeLinecap="round" />
                  <path d="M4 12h16" strokeLinecap="round" />
                  <path d="M4 17h16" strokeLinecap="round" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Mobile drawer */}
        {open ? (
          <nav className="md:hidden border-t border-ink/10 bg-cream">
            <ul className="mx-auto max-w-6xl px-4 py-2">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `block px-3 py-2 rounded-md text-sm ${
                        isActive ? "bg-ink text-cream" : "text-ink/80 hover:bg-ink/5"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
              <li>
                <button
                  onClick={logout}
                  className="w-full text-left px-3 py-2 rounded-md text-sm text-ink/60 hover:bg-ink/5"
                >
                  Sign out
                </button>
              </li>
            </ul>
          </nav>
        ) : null}
      </header>

      <main id="main" className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-8">
        {children}
      </main>
      <footer className="border-t border-ink/10 py-4 text-center text-xs text-muted">
        app.my250website.com · single-user
      </footer>
    </div>
  );
}
