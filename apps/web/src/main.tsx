import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import { LoginPage } from "./pages/LoginPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { LeadsListPage } from "./pages/LeadsListPage.js";
import { LeadDetailPage } from "./pages/LeadDetailPage.js";
import { NewLeadPage } from "./pages/NewLeadPage.js";
import { PlaceholderPage } from "./pages/PlaceholderPage.js";
import { RequireAuth } from "./auth/RequireAuth.js";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

function Protected({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
        <Route path="/leads" element={<Protected><LeadsListPage /></Protected>} />
        <Route path="/leads/new" element={<Protected><NewLeadPage /></Protected>} />
        <Route path="/leads/:id" element={<Protected><LeadDetailPage /></Protected>} />
        <Route
          path="/scrape"
          element={
            <Protected>
              <PlaceholderPage title="Find leads" phase={3} />
            </Protected>
          }
        />
        <Route
          path="/templates"
          element={
            <Protected>
              <PlaceholderPage title="Email templates" phase={4} />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
