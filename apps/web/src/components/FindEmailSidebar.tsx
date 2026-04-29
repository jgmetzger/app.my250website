import { useMemo } from "react";
import type { Lead } from "@app/shared";

/** Best-effort guesses at social handles given Maps `website_url`. */
function deriveHandles(lead: Lead): { instagram?: string; facebook?: string } {
  const out: { instagram?: string; facebook?: string } = {};
  if (lead.social_handles) {
    try {
      const parsed = JSON.parse(lead.social_handles) as { instagram?: string; facebook?: string };
      if (parsed.instagram) out.instagram = parsed.instagram;
      if (parsed.facebook) out.facebook = parsed.facebook;
    } catch {
      /* ignore */
    }
  }
  if (!out.instagram && lead.website_status === "instagram" && lead.website_url) {
    out.instagram = lead.website_url;
  }
  if (!out.facebook && lead.website_status === "facebook" && lead.website_url) {
    out.facebook = lead.website_url;
  }
  return out;
}

export function FindEmailSidebar({ lead }: { lead: Lead }) {
  const handles = useMemo(() => deriveHandles(lead), [lead]);

  function igUrl() {
    if (handles.instagram) return handles.instagram;
    return `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(lead.business_name)}`;
  }
  function fbUrl() {
    if (handles.facebook) return handles.facebook;
    return `https://www.facebook.com/search/pages/?q=${encodeURIComponent(lead.business_name)}`;
  }
  function googleUrl() {
    const q = `${lead.business_name} ${lead.city ?? ""} email contact`.trim();
    return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-serif text-xl">Find email</h2>
      <p className="text-xs text-muted">
        Open the obvious places, paste anything you find into the Email field on the left.
      </p>
      <div className="grid grid-cols-1 gap-2">
        <a className="btn-secondary text-sm" href={igUrl()} target="_blank" rel="noreferrer">
          Open Instagram ↗
        </a>
        <a className="btn-secondary text-sm" href={fbUrl()} target="_blank" rel="noreferrer">
          Open Facebook ↗
        </a>
        <a className="btn-secondary text-sm" href={googleUrl()} target="_blank" rel="noreferrer">
          Google search ↗
        </a>
        {lead.google_maps_url ? (
          <a
            className="btn-secondary text-sm"
            href={lead.google_maps_url}
            target="_blank"
            rel="noreferrer"
          >
            Open Google Maps ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}
