import type Database from "better-sqlite3";

interface Migration {
  version: number;
  up: (db: Database.Database) => void;
}

function sessionColumns(db: Database.Database): string[] {
  return db
    .prepare("PRAGMA table_info(sessions)")
    .all()
    .map((c: any) => c.name);
}

const migrations: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          label TEXT NOT NULL,
          username TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          repo TEXT NOT NULL,
          account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          start_time INTEGER NOT NULL,
          end_time INTEGER,
          notes TEXT
        );
      `);
    },
  },
  {
    version: 2,
    up: (db) => {
      const columns = sessionColumns(db);
      if (!columns.includes("paused_at")) {
        db.exec(
          "ALTER TABLE sessions ADD COLUMN paused_at INTEGER DEFAULT NULL",
        );
      }
      if (!columns.includes("total_paused_ms")) {
        db.exec(
          "ALTER TABLE sessions ADD COLUMN total_paused_ms INTEGER DEFAULT 0",
        );
      }
    },
  },
  {
    version: 3,
    up: (db) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
        CREATE INDEX IF NOT EXISTS idx_sessions_project_start ON sessions(project_id, start_time);
        CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(end_time) WHERE end_time IS NULL;
      `);
    },
  },
];

export function initializeSchema(db: Database.Database): void {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (const migration of migrations) {
    if (migration.version > current) {
      db.transaction(() => migration.up(db))();
      db.pragma(`user_version = ${migration.version}`);
    }
  }
}
