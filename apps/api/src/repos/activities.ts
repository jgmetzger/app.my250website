import type { Activity, ActivityType, CallOutcome } from "@app/shared";
import { many } from "../lib/db.js";

export interface InsertActivityInput {
  lead_id: number;
  type: ActivityType;
  direction?: "outbound" | "inbound" | null;
  subject?: string | null;
  body?: string | null;
  duration_seconds?: number | null;
  outcome?: CallOutcome | null;
  metadata?: Record<string, unknown> | null;
}

export async function insertActivity(
  db: D1Database,
  input: InsertActivityInput,
): Promise<number> {
  const meta = input.metadata ? JSON.stringify(input.metadata) : null;
  const result = await db
    .prepare(
      `INSERT INTO activities
        (lead_id, type, direction, subject, body, duration_seconds, outcome, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.lead_id,
      input.type,
      input.direction ?? null,
      input.subject ?? null,
      input.body ?? null,
      input.duration_seconds ?? null,
      input.outcome ?? null,
      meta,
    )
    .run();
  return Number(result.meta.last_row_id);
}

export async function listActivitiesForLead(
  db: D1Database,
  leadId: number,
  limit = 200,
): Promise<Activity[]> {
  return many<Activity>(
    db
      .prepare(
        `SELECT * FROM activities
         WHERE lead_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .bind(leadId, limit),
  );
}
