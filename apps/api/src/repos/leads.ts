import type { Lead, LeadCreateT, LeadUpdateT } from "@app/shared";
import { classifyWebsite } from "@app/shared";
import { many, one } from "../lib/db.js";

export interface ListLeadsParams {
  status?: string[]; // multi-select
  city?: string;
  website_status?: string[];
  search?: string;
  page: number;
  limit: number;
  sort: "created_at" | "rating" | "last_activity";
  order: "asc" | "desc";
}

export interface ListLeadsResult {
  leads: Array<Lead & { last_activity_at: number | null }>;
  total: number;
  page: number;
  limit: number;
}

export async function listLeads(
  db: D1Database,
  params: ListLeadsParams,
): Promise<ListLeadsResult> {
  const where: string[] = [];
  const args: unknown[] = [];

  if (params.status?.length) {
    where.push(`l.status IN (${params.status.map(() => "?").join(",")})`);
    args.push(...params.status);
  }
  if (params.website_status?.length) {
    where.push(`l.website_status IN (${params.website_status.map(() => "?").join(",")})`);
    args.push(...params.website_status);
  }
  if (params.city) {
    where.push(`LOWER(l.city) = LOWER(?)`);
    args.push(params.city);
  }
  if (params.search) {
    where.push(`(l.business_name LIKE ? OR l.phone LIKE ? OR l.email LIKE ?)`);
    const q = `%${params.search}%`;
    args.push(q, q, q);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const orderColumn =
    params.sort === "rating"
      ? "l.google_rating"
      : params.sort === "last_activity"
        ? "last_activity_at"
        : "l.created_at";
  const orderSql = `ORDER BY ${orderColumn} ${params.order === "asc" ? "ASC" : "DESC"} NULLS LAST, l.id DESC`;

  const offset = (params.page - 1) * params.limit;

  const totalRow = await one<{ c: number }>(
    db.prepare(`SELECT COUNT(*) AS c FROM leads l ${whereSql}`).bind(...args),
  );
  const total = totalRow?.c ?? 0;

  const leads = await many<Lead & { last_activity_at: number | null }>(
    db
      .prepare(
        `SELECT l.*,
                (SELECT MAX(a.created_at) FROM activities a WHERE a.lead_id = l.id) AS last_activity_at
         FROM leads l
         ${whereSql}
         ${orderSql}
         LIMIT ? OFFSET ?`,
      )
      .bind(...args, params.limit, offset),
  );

  return { leads, total, page: params.page, limit: params.limit };
}

export async function getLeadById(db: D1Database, id: number): Promise<Lead | null> {
  return one<Lead>(db.prepare(`SELECT * FROM leads WHERE id = ?`).bind(id));
}

export async function findByPlaceId(
  db: D1Database,
  placeId: string,
): Promise<Lead | null> {
  return one<Lead>(db.prepare(`SELECT * FROM leads WHERE google_place_id = ?`).bind(placeId));
}

export async function createLead(
  db: D1Database,
  input: LeadCreateT,
): Promise<number> {
  const websiteStatus = classifyWebsite(input.website_url ?? null);
  const result = await db
    .prepare(
      `INSERT INTO leads (
         business_name, business_type, address, city, region, postcode, country,
         phone, website_url, website_status, google_maps_url,
         google_rating, google_review_count,
         email, email_source, notes
       ) VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, 'United Kingdom'),
                 ?, ?, ?, ?,
                 ?, ?,
                 ?, ?, ?)`,
    )
    .bind(
      input.business_name,
      input.business_type ?? null,
      input.address ?? null,
      input.city ?? null,
      input.region ?? null,
      input.postcode ?? null,
      input.country ?? null,
      input.phone ?? null,
      input.website_url ?? null,
      websiteStatus,
      input.google_maps_url ?? null,
      input.google_rating ?? null,
      input.google_review_count ?? null,
      input.email ?? null,
      input.email_source ?? null,
      input.notes ?? null,
    )
    .run();
  return Number(result.meta.last_row_id);
}

/**
 * Insert a scraped lead. Caller is responsible for filtering (rating/reviews/etc).
 * Returns the new lead id, or null if a duplicate (place_id already exists).
 * `website_status` is computed from `website_url` automatically.
 */
export async function upsertScrapedLead(
  db: D1Database,
  scraped: {
    business_name: string;
    google_place_id: string;
    google_maps_url?: string | null;
    business_type?: string | null;
    address?: string | null;
    city?: string | null;
    region?: string | null;
    postcode?: string | null;
    phone?: string | null;
    website_url?: string | null;
    google_rating?: number | null;
    google_review_count?: number | null;
    social_handles?: Record<string, string> | null;
  },
  sourceRunId: number,
): Promise<number | null> {
  const existing = await findByPlaceId(db, scraped.google_place_id);
  if (existing) return null;

  const websiteStatus = classifyWebsite(scraped.website_url ?? null);
  const social = scraped.social_handles ? JSON.stringify(scraped.social_handles) : null;
  const result = await db
    .prepare(
      `INSERT INTO leads (
         business_name, google_place_id, google_maps_url, business_type,
         address, city, region, postcode,
         phone, website_url, website_status, social_handles,
         google_rating, google_review_count,
         status, source_run_id
       ) VALUES (?, ?, ?, ?,
                 ?, ?, ?, ?,
                 ?, ?, ?, ?,
                 ?, ?,
                 'sourced', ?)`,
    )
    .bind(
      scraped.business_name,
      scraped.google_place_id,
      scraped.google_maps_url ?? null,
      scraped.business_type ?? null,
      scraped.address ?? null,
      scraped.city ?? null,
      scraped.region ?? null,
      scraped.postcode ?? null,
      scraped.phone ?? null,
      scraped.website_url ?? null,
      websiteStatus,
      social,
      scraped.google_rating ?? null,
      scraped.google_review_count ?? null,
      sourceRunId,
    )
    .run();
  return Number(result.meta.last_row_id);
}

export async function updateLead(
  db: D1Database,
  id: number,
  patch: LeadUpdateT,
): Promise<Lead | null> {
  const setFragments: string[] = [];
  const args: unknown[] = [];

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    setFragments.push(`${key} = ?`);
    args.push(value);
  }

  // If website_url changed, recompute classification too (unless explicitly provided).
  if (patch.website_url !== undefined && patch.website_status === undefined) {
    setFragments.push(`website_status = ?`);
    args.push(classifyWebsite(patch.website_url ?? null));
  }

  if (setFragments.length === 0) return getLeadById(db, id);

  setFragments.push(`updated_at = unixepoch()`);
  args.push(id);

  await db
    .prepare(`UPDATE leads SET ${setFragments.join(", ")} WHERE id = ?`)
    .bind(...args)
    .run();
  return getLeadById(db, id);
}

export async function deleteLead(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare(`DELETE FROM leads WHERE id = ?`).bind(id).run();
  return Number(result.meta.changes ?? 0) > 0;
}

export async function distinctCities(db: D1Database): Promise<string[]> {
  const rows = await many<{ city: string }>(
    db.prepare(
      `SELECT DISTINCT city FROM leads WHERE city IS NOT NULL AND city != '' ORDER BY city`,
    ),
  );
  return rows.map((r) => r.city);
}
