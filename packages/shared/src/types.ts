export type LeadStatus =
  | "sourced"
  | "researched"
  | "contacted"
  | "replied"
  | "form_submitted"
  | "building"
  | "live"
  | "lost";

export const LEAD_STATUSES: LeadStatus[] = [
  "sourced",
  "researched",
  "contacted",
  "replied",
  "form_submitted",
  "building",
  "live",
  "lost",
];

export type WebsiteStatus =
  | "none"
  | "real"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "twitter"
  | "linktree"
  | "other_social";

export const WEBSITE_STATUSES: WebsiteStatus[] = [
  "none",
  "real",
  "instagram",
  "facebook",
  "tiktok",
  "twitter",
  "linktree",
  "other_social",
];

export type BusinessType = "pub" | "bar" | "restaurant" | "gastropub" | "cafe" | "other";

export const BUSINESS_TYPES: BusinessType[] = ["pub", "bar", "restaurant", "gastropub", "cafe", "other"];

export type ActivityType =
  | "email_sent"
  | "email_delivered"
  | "email_opened"
  | "email_bounced"
  | "email_replied"
  | "call_made"
  | "call_received"
  | "sms_sent"
  | "sms_received"
  | "note"
  | "status_change"
  | "form_submitted";

export type CallOutcome =
  | "no_answer"
  | "voicemail"
  | "interested"
  | "not_interested"
  | "callback"
  | "wrong_number";

export type ScrapeRunStatus = "running" | "completed" | "failed";

export interface SocialHandles {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  twitter?: string;
  linktree?: string;
}

export interface Lead {
  id: number;
  business_name: string;
  google_place_id: string | null;
  google_maps_url: string | null;
  business_type: BusinessType | null;
  address: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  country: string;
  phone: string | null;
  website_url: string | null;
  website_status: WebsiteStatus | null;
  social_handles: string | null; // JSON string in DB
  google_rating: number | null;
  google_review_count: number | null;
  email: string | null;
  email_source: string | null;
  notes: string | null;
  status: LeadStatus;
  source_run_id: number | null;
  created_at: number;
  updated_at: number;
}

export interface Activity {
  id: number;
  lead_id: number;
  type: ActivityType;
  direction: "outbound" | "inbound" | null;
  subject: string | null;
  body: string | null;
  duration_seconds: number | null;
  outcome: CallOutcome | null;
  metadata: string | null;
  created_at: number;
}

export interface ScrapeRun {
  id: number;
  query: string;
  city: string | null;
  business_type: BusinessType | null;
  results_found: number;
  new_leads_added: number;
  duplicates_skipped: number;
  status: ScrapeRunStatus;
  error_message: string | null;
  started_at: number;
  completed_at: number | null;
}

export interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  is_default: number;
  created_at: number;
}

export interface DashboardStats {
  by_status: Record<LeadStatus, number>;
  leads_added_this_week: number;
  emails_sent_this_week: number;
  emails_sent_today: number;
  calls_made_this_week: number;
  replies_this_week: number;
  daily_email_cap: number;
}
