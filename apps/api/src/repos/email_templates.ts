import type { EmailTemplate } from "@app/shared";
import { many, one } from "../lib/db.js";

export async function listTemplates(db: D1Database): Promise<EmailTemplate[]> {
  return many<EmailTemplate>(
    db.prepare(
      `SELECT * FROM email_templates ORDER BY is_default DESC, name ASC`,
    ),
  );
}

export async function getTemplate(db: D1Database, id: number): Promise<EmailTemplate | null> {
  return one<EmailTemplate>(
    db.prepare(`SELECT * FROM email_templates WHERE id = ?`).bind(id),
  );
}

export async function createTemplate(
  db: D1Database,
  input: { name: string; subject: string; body: string; is_default?: boolean },
): Promise<number> {
  if (input.is_default) {
    await db.prepare(`UPDATE email_templates SET is_default = 0`).run();
  }
  const result = await db
    .prepare(
      `INSERT INTO email_templates (name, subject, body, is_default)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(input.name, input.subject, input.body, input.is_default ? 1 : 0)
    .run();
  return Number(result.meta.last_row_id);
}

export async function updateTemplate(
  db: D1Database,
  id: number,
  patch: { name?: string; subject?: string; body?: string; is_default?: boolean },
): Promise<EmailTemplate | null> {
  if (patch.is_default) {
    await db.prepare(`UPDATE email_templates SET is_default = 0 WHERE id != ?`).bind(id).run();
  }
  const fragments: string[] = [];
  const args: unknown[] = [];
  if (patch.name !== undefined) {
    fragments.push("name = ?");
    args.push(patch.name);
  }
  if (patch.subject !== undefined) {
    fragments.push("subject = ?");
    args.push(patch.subject);
  }
  if (patch.body !== undefined) {
    fragments.push("body = ?");
    args.push(patch.body);
  }
  if (patch.is_default !== undefined) {
    fragments.push("is_default = ?");
    args.push(patch.is_default ? 1 : 0);
  }
  if (fragments.length === 0) return getTemplate(db, id);
  args.push(id);
  await db
    .prepare(`UPDATE email_templates SET ${fragments.join(", ")} WHERE id = ?`)
    .bind(...args)
    .run();
  return getTemplate(db, id);
}

export async function deleteTemplate(db: D1Database, id: number): Promise<boolean> {
  const r = await db.prepare(`DELETE FROM email_templates WHERE id = ?`).bind(id).run();
  return Number(r.meta.changes ?? 0) > 0;
}

/** Count of `email_sent` activities since 00:00 UTC today. */
export async function countEmailsSentToday(db: D1Database): Promise<number> {
  const row = await one<{ c: number }>(
    db.prepare(
      `SELECT COUNT(*) AS c
         FROM activities
        WHERE type = 'email_sent'
          AND created_at >= unixepoch('now', 'start of day')`,
    ),
  );
  return row?.c ?? 0;
}
