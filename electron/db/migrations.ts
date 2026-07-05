import type Database from "better-sqlite3";

export function initializeSchema(db: Database.Database): void {
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

  // Incremental migration: add missing columns to existing databases
  const sessionColumns = db
    .prepare("PRAGMA table_info(sessions)")
    .all()
    .map((c: any) => c.name);

  if (!sessionColumns.includes("paused_at")) {
    db.exec("ALTER TABLE sessions ADD COLUMN paused_at INTEGER DEFAULT NULL");
  }
  if (!sessionColumns.includes("total_paused_ms")) {
    db.exec("ALTER TABLE sessions ADD COLUMN total_paused_ms INTEGER DEFAULT 0");
  }
}
