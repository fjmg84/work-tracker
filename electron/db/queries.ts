import type Database from "better-sqlite3";

// ============================================================
// Accounts
// ============================================================

export const accountQueries = {
  listAll: (db: Database.Database) =>
    db.prepare("SELECT id, label, username FROM accounts ORDER BY label").all(),

  create: (
    db: Database.Database,
    { label, username }: { label: string; username: string },
  ) =>
    db
      .prepare("INSERT INTO accounts (label, username) VALUES (?, ?)")
      .run(label, username),

  update: (
    db: Database.Database,
    { id, label, username }: { id: number; label: string; username: string },
  ) =>
    db
      .prepare("UPDATE accounts SET label = ?, username = ? WHERE id = ?")
      .run(label, username, id),

  delete: (db: Database.Database, id: number) =>
    db.prepare("DELETE FROM accounts WHERE id = ?").run(id),

  getById: (
    db: Database.Database,
    id: number,
  ): { id: number; label: string; username: string } | undefined =>
    db
      .prepare<[number], { id: number; label: string; username: string }>(
        "SELECT * FROM accounts WHERE id = ?",
      )
      .get(id),
};

// ============================================================
// Projects
// ============================================================

export const projectQueries = {
  listAll: (db: Database.Database) =>
    db
      .prepare(
        `
      SELECT p.id, p.name, p.repo, p.account_id, a.label AS account_label, a.username AS account_username
      FROM projects p
      JOIN accounts a ON p.account_id = a.id
      ORDER BY p.name
    `,
      )
      .all(),

  create: (
    db: Database.Database,
    {
      name,
      repo,
      account_id,
    }: { name: string; repo: string; account_id: number },
  ) =>
    db
      .prepare("INSERT INTO projects (name, repo, account_id) VALUES (?, ?, ?)")
      .run(name, repo, account_id),

  update: (
    db: Database.Database,
    {
      id,
      name,
      repo,
      account_id,
    }: { id: number; name: string; repo: string; account_id: number },
  ) =>
    db
      .prepare(
        "UPDATE projects SET name = ?, repo = ?, account_id = ? WHERE id = ?",
      )
      .run(name, repo, account_id, id),

  delete: (db: Database.Database, id: number) =>
    db.prepare("DELETE FROM projects WHERE id = ?").run(id),
};

// ============================================================
// Sessions
// ============================================================

export const sessionQueries = {
  listFiltered: (
    db: Database.Database,
    { projectId, from, to }: { projectId?: number; from?: number; to?: number },
  ) => {
    let query = "SELECT * FROM sessions WHERE 1=1";
    const params: (number | undefined)[] = [];

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
    return db.prepare(query).all(...params);
  },

  create: (
    db: Database.Database,
    {
      project_id,
      start_time,
      notes,
    }: { project_id: number; start_time: number; notes?: string },
  ) =>
    db
      .prepare(
        "INSERT INTO sessions (project_id, start_time, notes) VALUES (?, ?, ?)",
      )
      .run(project_id, start_time, notes || ""),

  stop: (
    db: Database.Database,
    { id, end_time }: { id: number; end_time: number },
  ) => {
    db.prepare("UPDATE sessions SET end_time = ? WHERE id = ?").run(
      end_time,
      id,
    );
    return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
  },

  delete: (db: Database.Database, id: number) =>
    db.prepare("DELETE FROM sessions WHERE id = ?").run(id),

  getActive: (db: Database.Database) =>
    db.prepare("SELECT * FROM sessions WHERE end_time IS NULL LIMIT 1").get() ||
    null,

  getById: (db: Database.Database, id: number) =>
    db.prepare("SELECT * FROM sessions WHERE id = ?").get(id),

  pause: (
    db: Database.Database,
    { id, paused_at }: { id: number; paused_at: number },
  ) => {
    db.prepare("UPDATE sessions SET paused_at = ? WHERE id = ?").run(
      paused_at,
      id,
    );
    return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
  },

  resume: (
    db: Database.Database,
    { id, pausedDuration }: { id: number; pausedDuration: number },
  ) => {
    db.prepare(
      "UPDATE sessions SET paused_at = NULL, total_paused_ms = total_paused_ms + ? WHERE id = ?",
    ).run(pausedDuration, id);
    return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
  },

  markIdlePaused: (
    db: Database.Database,
    { id, paused_at }: { id: number; paused_at: number },
  ) => {
    db.prepare("UPDATE sessions SET paused_at = ? WHERE id = ?").run(
      paused_at,
      id,
    );
  },

  getActiveUnpaused: (db: Database.Database) =>
    db
      .prepare(
        "SELECT * FROM sessions WHERE end_time IS NULL AND paused_at IS NULL",
      )
      .get() as
      | {
          id: number;
          project_id: number;
          start_time: number;
          end_time: number | null;
          notes: string;
          paused_at: number | null;
          total_paused_ms: number;
        }
      | undefined,

  closeAllActive: (db: Database.Database, { end_time }: { end_time: number }) =>
    db
      .prepare("UPDATE sessions SET end_time = ? WHERE end_time IS NULL")
      .run(end_time),

  closeStale: (
    db: Database.Database,
    { ids, end_time }: { ids: number[]; end_time: number },
  ) => {
    const placeholders = ids.map(() => "?").join(",");
    db.prepare(
      `UPDATE sessions SET end_time = ? WHERE id IN (${placeholders})`,
    ).run(end_time, ...ids);
  },

  getStaleSessions: (
    db: Database.Database,
    { threshold }: { threshold: number },
  ) =>
    db
      .prepare(
        "SELECT * FROM sessions WHERE end_time IS NULL AND start_time < ?",
      )
      .all(threshold) as {
      id: number;
      project_id: number;
      start_time: number;
      end_time: number | null;
      notes: string;
      paused_at: number | null;
      total_paused_ms: number;
    }[],
};
