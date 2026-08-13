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
  {
    version: 4,
    up: (db) => {
      const columns = sessionColumns(db);
      if (!columns.includes("session_type")) {
        db.exec(
          "ALTER TABLE sessions ADD COLUMN session_type TEXT DEFAULT 'work'",
        );
      }
    },
  },
  {
    version: 5,
    up: (db) => {
      const columns = sessionColumns(db);
      if (!columns.includes("account_id")) {
        db.exec(
          "ALTER TABLE sessions ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL",
        );
      }
    },
  },
  {
    version: 6,
    up: (db) => {
      const pkInfo = db
        .prepare("PRAGMA table_info(sessions)")
        .all() as any[];
      const projectNotNull = pkInfo.some(
        (c: any) => c.name === "project_id" && c.notnull === 1,
      );

      if (projectNotNull) {
        db.exec(`
          CREATE TABLE sessions_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
            start_time INTEGER NOT NULL,
            end_time INTEGER,
            notes TEXT,
            paused_at INTEGER DEFAULT NULL,
            total_paused_ms INTEGER DEFAULT 0,
            session_type TEXT DEFAULT 'work',
            account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL
          );

          INSERT INTO sessions_new
            (id, project_id, start_time, end_time, notes, paused_at, total_paused_ms, session_type, account_id)
          SELECT
            id, project_id, start_time, end_time, notes, paused_at, total_paused_ms, session_type, account_id
          FROM sessions;

          DROP TABLE sessions;
          ALTER TABLE sessions_new RENAME TO sessions;

          CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
          CREATE INDEX IF NOT EXISTS idx_sessions_project_start ON sessions(project_id, start_time);
          CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(end_time) WHERE end_time IS NULL;
        `);
      }
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
