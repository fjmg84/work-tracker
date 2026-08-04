import type Database from "better-sqlite3";

// Statements preparados cacheados por conexión y SQL. La caché por string de
// SQL también cubre las queries dinámicas de listFiltered (pocas combinaciones).
const stmtCache = new WeakMap<
  Database.Database,
  Map<string, Database.Statement>
>();

function stmt(db: Database.Database, sql: string): Database.Statement {
  let byDb = stmtCache.get(db);
  if (!byDb) {
    byDb = new Map();
    stmtCache.set(db, byDb);
  }
  let prepared = byDb.get(sql);
  if (!prepared) {
    prepared = db.prepare(sql);
    byDb.set(sql, prepared);
  }
  return prepared;
}

// ============================================================
// Accounts
// ============================================================

export const accountQueries = {
  listAll: (db: Database.Database) =>
    stmt(db, "SELECT id, label, username FROM accounts ORDER BY label").all(),

  create: (
    db: Database.Database,
    { label, username }: { label: string; username: string },
  ) =>
    stmt(db, "INSERT INTO accounts (label, username) VALUES (?, ?)").run(
      label,
      username,
    ),

  update: (
    db: Database.Database,
    { id, label, username }: { id: number; label: string; username: string },
  ) =>
    stmt(db, "UPDATE accounts SET label = ?, username = ? WHERE id = ?").run(
      label,
      username,
      id,
    ),

  delete: (db: Database.Database, id: number) =>
    stmt(db, "DELETE FROM accounts WHERE id = ?").run(id),

  getById: (
    db: Database.Database,
    id: number,
  ): { id: number; label: string; username: string } | undefined =>
    stmt(db, "SELECT * FROM accounts WHERE id = ?").get(id) as
      | { id: number; label: string; username: string }
      | undefined,
};

// ============================================================
// Projects
// ============================================================

export const projectQueries = {
  listAll: (db: Database.Database) =>
    stmt(
      db,
      `
      SELECT p.id, p.name, p.repo, p.account_id, a.label AS account_label, a.username AS account_username
      FROM projects p
      JOIN accounts a ON p.account_id = a.id
      ORDER BY p.name
    `,
    ).all(),

  create: (
    db: Database.Database,
    {
      name,
      repo,
      account_id,
    }: { name: string; repo: string; account_id: number },
  ) =>
    stmt(
      db,
      "INSERT INTO projects (name, repo, account_id) VALUES (?, ?, ?)",
    ).run(name, repo, account_id),

  update: (
    db: Database.Database,
    {
      id,
      name,
      repo,
      account_id,
    }: { id: number; name: string; repo: string; account_id: number },
  ) =>
    stmt(
      db,
      "UPDATE projects SET name = ?, repo = ?, account_id = ? WHERE id = ?",
    ).run(name, repo, account_id, id),

  delete: (db: Database.Database, id: number) =>
    stmt(db, "DELETE FROM projects WHERE id = ?").run(id),
};

// ============================================================
// Sessions
// ============================================================

interface SessionRow {
  id: number;
  project_id: number;
  start_time: number;
  end_time: number | null;
  notes: string;
  paused_at: number | null;
  total_paused_ms: number;
}

const SELECT_SESSION_BY_ID = "SELECT * FROM sessions WHERE id = ?";

export const sessionQueries = {
  listFiltered: (
    db: Database.Database,
    { projectId, from, to }: { projectId?: number; from?: number; to?: number },
  ) => {
    let query = "SELECT * FROM sessions WHERE 1=1";
    const params: number[] = [];

    if (projectId) {
      query += " AND project_id = ?";
      params.push(projectId);
    }
    if (from) {
      query += " AND start_time >= ?";
      params.push(from);
    }
    if (to) {
      query += " AND (end_time IS NULL OR end_time <= ?)";
      params.push(to);
    }

    query += " ORDER BY start_time DESC";
    return stmt(db, query).all(...params);
  },

  create: (
    db: Database.Database,
    {
      project_id,
      start_time,
      notes,
    }: { project_id: number; start_time: number; notes?: string },
  ) =>
    stmt(
      db,
      "INSERT INTO sessions (project_id, start_time, notes) VALUES (?, ?, ?)",
    ).run(project_id, start_time, notes || ""),

  stop: (
    db: Database.Database,
    { id, end_time }: { id: number; end_time: number },
  ) => {
    stmt(db, "UPDATE sessions SET end_time = ? WHERE id = ?").run(end_time, id);
    return stmt(db, SELECT_SESSION_BY_ID).get(id);
  },

  delete: (db: Database.Database, id: number) =>
    stmt(db, "DELETE FROM sessions WHERE id = ?").run(id),

  getActive: (db: Database.Database) =>
    stmt(db, "SELECT * FROM sessions WHERE end_time IS NULL LIMIT 1").get() ||
    null,

  getById: (db: Database.Database, id: number) =>
    stmt(db, SELECT_SESSION_BY_ID).get(id),

  pause: (
    db: Database.Database,
    { id, paused_at }: { id: number; paused_at: number },
  ) => {
    stmt(db, "UPDATE sessions SET paused_at = ? WHERE id = ?").run(
      paused_at,
      id,
    );
    return stmt(db, SELECT_SESSION_BY_ID).get(id);
  },

  resume: (
    db: Database.Database,
    { id, pausedDuration }: { id: number; pausedDuration: number },
  ) => {
    stmt(
      db,
      "UPDATE sessions SET paused_at = NULL, total_paused_ms = total_paused_ms + ? WHERE id = ?",
    ).run(pausedDuration, id);
    return stmt(db, SELECT_SESSION_BY_ID).get(id);
  },

  markIdlePaused: (
    db: Database.Database,
    { id, paused_at }: { id: number; paused_at: number },
  ) => {
    stmt(db, "UPDATE sessions SET paused_at = ? WHERE id = ?").run(
      paused_at,
      id,
    );
  },

  getActiveUnpaused: (db: Database.Database) =>
    stmt(
      db,
      "SELECT * FROM sessions WHERE end_time IS NULL AND paused_at IS NULL",
    ).get() as SessionRow | undefined,

  closeAllActive: (db: Database.Database, { end_time }: { end_time: number }) =>
    stmt(db, "UPDATE sessions SET end_time = ? WHERE end_time IS NULL").run(
      end_time,
    ),

  closeStale: (
    db: Database.Database,
    { ids, end_time }: { ids: number[]; end_time: number },
  ) => {
    const placeholders = ids.map(() => "?").join(",");
    stmt(
      db,
      `UPDATE sessions SET end_time = ? WHERE id IN (${placeholders})`,
    ).run(end_time, ...ids);
  },

  getStaleSessions: (
    db: Database.Database,
    { threshold }: { threshold: number },
  ) =>
    stmt(
      db,
      "SELECT * FROM sessions WHERE end_time IS NULL AND start_time < ?",
    ).all(threshold) as SessionRow[],
};
