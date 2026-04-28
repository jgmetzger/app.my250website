// Tiny D1-shaped wrapper around better-sqlite3 for tests. Implements just the
// surface area our repos use (prepare/bind/run/first/all). NOT a complete
// D1 polyfill — extend as needed.
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

type Row = Record<string, unknown>;

const __dirname = dirname(fileURLToPath(import.meta.url));

class FakePreparedStatement {
  constructor(
    private db: Database.Database,
    private sql: string,
    private params: unknown[] = [],
  ) {}

  bind(...params: unknown[]): FakePreparedStatement {
    return new FakePreparedStatement(this.db, this.sql, params);
  }

  async first<T = Row>(): Promise<T | null> {
    const stmt = this.db.prepare(this.sql);
    const row = stmt.get(...this.params);
    return (row ?? null) as T | null;
  }

  async all<T = Row>(): Promise<{ results: T[] }> {
    const stmt = this.db.prepare(this.sql);
    return { results: stmt.all(...this.params) as T[] };
  }

  async run(): Promise<{ meta: { last_row_id: number; changes: number } }> {
    const stmt = this.db.prepare(this.sql);
    const info = stmt.run(...this.params);
    return {
      meta: {
        last_row_id: Number(info.lastInsertRowid),
        changes: info.changes,
      },
    };
  }
}

export interface FakeD1 {
  prepare(sql: string): FakePreparedStatement;
  /** Test-only escape hatch. */
  _raw(): Database.Database;
}

/**
 * Spin up an in-memory SQLite, apply the real migration SQL, return a
 * D1-compatible facade. Each call gives a fresh DB.
 */
export function freshDb(): FakeD1 {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");

  const migrationPath = resolve(__dirname, "../../../../migrations/0001_init.sql");
  const sql = readFileSync(migrationPath, "utf8");
  // better-sqlite3 wants a single exec; the migration mixes DDL + INSERT,
  // and the INSERT uses ?-less SQL so exec is fine.
  db.exec(sql);

  return {
    prepare(sql: string) {
      return new FakePreparedStatement(db, sql);
    },
    _raw() {
      return db;
    },
  };
}
