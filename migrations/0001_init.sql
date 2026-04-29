-- Initial schema for app.my250website.com CRM.
-- D1 / SQLite. Run with: wrangler d1 execute wfbr-crm --file=migrations/0001_init.sql

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_name TEXT NOT NULL,
  google_place_id TEXT UNIQUE,
  google_maps_url TEXT,
  business_type TEXT,
  address TEXT,
  city TEXT,
  region TEXT,
  postcode TEXT,
  country TEXT DEFAULT 'United Kingdom',
  phone TEXT,
  website_url TEXT,
  website_status TEXT,
  social_handles TEXT,
  google_rating REAL,
  google_review_count INTEGER,
  email TEXT,
  email_source TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'sourced',
  source_run_id INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_website_status ON leads(website_status);
CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

CREATE TABLE IF NOT EXISTS scrape_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  city TEXT,
  business_type TEXT,
  results_found INTEGER NOT NULL DEFAULT 0,
  new_leads_added INTEGER NOT NULL DEFAULT 0,
  duplicates_skipped INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  error_message TEXT,
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_scrape_runs_started ON scrape_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  direction TEXT,
  subject TEXT,
  body TEXT,
  duration_seconds INTEGER,
  outcome TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_activities_lead ON activities(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type, created_at DESC);

CREATE TABLE IF NOT EXISTS email_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Seed the default WFBR cold outreach template (idempotent on name).
INSERT INTO email_templates (name, subject, body, is_default)
SELECT
  'WFBR cold outreach',
  'Quick question about {{business_name}}',
  'Hi there,

I came across {{business_name}} on Google — {{rating}} stars from {{review_count}} reviews is impressive.

I noticed you don''t have a website linked on your Google profile. I build simple, professional one-page websites specifically for pubs, bars and restaurants — all the essentials so customers can find your hours, menu, and book a table.

It''s £250 flat, with £20/month for hosting and a .co.uk domain. Built in 3 days. You see the full preview before paying anything.

If that sounds useful, fill out a short form here and I''ll get a preview to you within 48 hours:

https://my250website.com/intake

Cheers,
James
my250website.com',
  1
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE name = 'WFBR cold outreach');
