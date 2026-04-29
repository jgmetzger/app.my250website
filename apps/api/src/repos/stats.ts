import type { Activity, DashboardStats, LeadStatus } from "@app/shared";
import { LEAD_STATUSES } from "@app/shared";
import { many, one } from "../lib/db.js";

export async function getDashboardStats(
  db: D1Database,
  dailyEmailCap: number,
): Promise<DashboardStats> {
  const sevenDaysAgo = "unixepoch() - 86400 * 7";
  const startOfDay = "unixepoch('now', 'start of day')";

  const [
    statusRows,
    addedRow,
    emailsWeek,
    emailsToday,
    callsWeek,
    repliesWeek,
  ] = await Promise.all([
    many<{ status: string; c: number }>(
      db.prepare(`SELECT status, COUNT(*) AS c FROM leads GROUP BY status`),
    ),
    one<{ c: number }>(
      db.prepare(`SELECT COUNT(*) AS c FROM leads WHERE created_at >= ${sevenDaysAgo}`),
    ),
    one<{ c: number }>(
      db.prepare(
        `SELECT COUNT(*) AS c FROM activities WHERE type = 'email_sent' AND created_at >= ${sevenDaysAgo}`,
      ),
    ),
    one<{ c: number }>(
      db.prepare(
        `SELECT COUNT(*) AS c FROM activities WHERE type = 'email_sent' AND created_at >= ${startOfDay}`,
      ),
    ),
    one<{ c: number }>(
      db.prepare(
        `SELECT COUNT(*) AS c FROM activities WHERE type = 'call_made' AND created_at >= ${sevenDaysAgo}`,
      ),
    ),
    one<{ c: number }>(
      db.prepare(
        `SELECT COUNT(*) AS c
           FROM activities
          WHERE type IN ('email_replied', 'call_received')
            AND created_at >= ${sevenDaysAgo}`,
      ),
    ),
  ]);

  const byStatus = LEAD_STATUSES.reduce(
    (acc, s) => {
      acc[s] = 0;
      return acc;
    },
    {} as Record<LeadStatus, number>,
  );
  for (const r of statusRows) {
    if ((LEAD_STATUSES as string[]).includes(r.status)) {
      byStatus[r.status as LeadStatus] = r.c;
    }
  }

  return {
    by_status: byStatus,
    leads_added_this_week: addedRow?.c ?? 0,
    emails_sent_this_week: emailsWeek?.c ?? 0,
    emails_sent_today: emailsToday?.c ?? 0,
    calls_made_this_week: callsWeek?.c ?? 0,
    replies_this_week: repliesWeek?.c ?? 0,
    daily_email_cap: dailyEmailCap,
  };
}

export interface RecentActivityRow extends Activity {
  business_name: string;
}

export async function listRecentActivity(
  db: D1Database,
  limit = 20,
): Promise<RecentActivityRow[]> {
  return many<RecentActivityRow>(
    db
      .prepare(
        `SELECT a.*, l.business_name
         FROM activities a
         JOIN leads l ON l.id = a.lead_id
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT ?`,
      )
      .bind(limit),
  );
}
