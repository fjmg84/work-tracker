import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initializeSchema } from "./migrations";
import { sessionQueries } from "./queries";

function createOldSchemaDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE
    );
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      repo TEXT NOT NULL,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE
    );
    CREATE TABLE sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      notes TEXT
    );
  `);
  return db;
}

function createFreshDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  return db;
}

function getColumns(db: Database.Database, table: string): string[] {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((c: any) => c.name);
}

describe("initializeSchema", () => {
  it("creates all tables from scratch", () => {
    const db = createFreshDb();
    initializeSchema(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((t: any) => t.name);

    expect(tables).toContain("accounts");
    expect(tables).toContain("projects");
    expect(tables).toContain("sessions");
  });

  it("adds paused_at and total_paused_ms to old databases", () => {
    const db = createOldSchemaDb();
    initializeSchema(db);

    const columns = getColumns(db, "sessions");
    expect(columns).toContain("paused_at");
    expect(columns).toContain("total_paused_ms");
  });

  it("does not break databases that already have the columns", () => {
    const db = createFreshDb();
    initializeSchema(db);

    const columns = getColumns(db, "sessions");
    expect(columns).toContain("paused_at");
    expect(columns).toContain("total_paused_ms");

    // Run initializeSchema again — should not throw
    expect(() => initializeSchema(db)).not.toThrow();
  });

  it("preserves existing data when adding columns", () => {
    const db = createOldSchemaDb();

    // Insert data into old schema
    db.prepare("INSERT INTO accounts (label, username) VALUES (?, ?)").run(
      "Test Account",
      "testuser",
    );
    db.prepare(
      "INSERT INTO projects (name, repo, account_id) VALUES (?, ?, ?)",
    ).run("Test Repo", "test/repo", 1);
    db.prepare(
      "INSERT INTO sessions (project_id, start_time, notes) VALUES (?, ?, ?)",
    ).run(1, 1000, "old session");

    // Run migration
    initializeSchema(db);

    // Verify data is preserved
    const sessions = db.prepare("SELECT * FROM sessions").all() as any[];
    expect(sessions.length).toBe(1);
    expect(sessions[0].notes).toBe("old session");
    expect(sessions[0].paused_at).toBeNull();
    expect(sessions[0].total_paused_ms).toBe(0);
  });
});

describe("session pause/resume queries", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createFreshDb();
    initializeSchema(db);

    // Setup: account, project, and an active session
    db.prepare("INSERT INTO accounts (label, username) VALUES (?, ?)").run(
      "Test",
      "tester",
    );
    db.prepare(
      "INSERT INTO projects (name, repo, account_id) VALUES (?, ?, ?)",
    ).run("Proj", "t/p", 1);
  });

  it("pause() sets paused_at on the session", () => {
    const now = Date.now();
    sessionQueries.create(db, { project_id: 1, start_time: now });
    const session = sessionQueries.getActive(db) as any;

    const paused = sessionQueries.pause(db, {
      id: session.id,
      paused_at: now + 5000,
    }) as any;

    expect(paused.paused_at).toBe(now + 5000);
    expect(paused.total_paused_ms).toBe(0);
  });

  it("resume() clears paused_at and accumulates total_paused_ms without changing start_time", () => {
    const now = Date.now();
    sessionQueries.create(db, { project_id: 1, start_time: now });
    const session = sessionQueries.getActive(db) as any;

    // Pause at now + 5s, resume at now + 10s → 5s paused
    sessionQueries.pause(db, { id: session.id, paused_at: now + 5000 });
    const resumed = sessionQueries.resume(db, {
      id: session.id,
      pausedDuration: 5000,
    }) as any;

    expect(resumed.paused_at).toBeNull();
    expect(resumed.total_paused_ms).toBe(5000);
    expect(resumed.start_time).toBe(now);
  });

  it("resume() accumulates across multiple pause/resume cycles", () => {
    const now = Date.now();
    sessionQueries.create(db, { project_id: 1, start_time: now });
    const session = sessionQueries.getActive(db) as any;

    // First cycle: 3s paused
    sessionQueries.pause(db, { id: session.id, paused_at: now + 1000 });
    sessionQueries.resume(db, { id: session.id, pausedDuration: 3000 });

    // Second cycle: 7s paused
    sessionQueries.pause(db, { id: session.id, paused_at: now + 5000 });
    const resumed = sessionQueries.resume(db, {
      id: session.id,
      pausedDuration: 7000,
    }) as any;

    expect(resumed.total_paused_ms).toBe(10000);
    expect(resumed.start_time).toBe(now);
  });

  it("markIdlePaused() pauses an active session for suspend auto-pause", () => {
    const now = Date.now();
    sessionQueries.create(db, { project_id: 1, start_time: now });
    const session = sessionQueries.getActive(db) as any;

    expect(sessionQueries.getActiveUnpaused(db)).toBeTruthy();

    sessionQueries.markIdlePaused(db, {
      id: session.id,
      paused_at: now + 1000,
    });

    const updated = sessionQueries.getActive(db) as any;
    expect(updated.paused_at).toBe(now + 1000);
    expect(updated.start_time).toBe(now);
    expect(sessionQueries.getActiveUnpaused(db)).toBeUndefined();
  });

  it("getActiveUnpaused() returns only unpaused active sessions", () => {
    const now = Date.now();
    sessionQueries.create(db, { project_id: 1, start_time: now });
    const session = sessionQueries.getActive(db) as any;

    // Before pause: should return the session
    expect(sessionQueries.getActiveUnpaused(db)).toBeTruthy();

    // After pause: should return undefined
    sessionQueries.pause(db, { id: session.id, paused_at: now + 1000 });
    expect(sessionQueries.getActiveUnpaused(db)).toBeUndefined();

    // After resume: should return the session again
    sessionQueries.resume(db, { id: session.id, pausedDuration: 2000 });
    expect(sessionQueries.getActiveUnpaused(db)).toBeTruthy();
  });

  it("closeAllActive() stops all active sessions", () => {
    const now = Date.now();
    sessionQueries.create(db, { project_id: 1, start_time: now });

    sessionQueries.closeAllActive(db, { end_time: now + 5000 });

    const session = sessionQueries.getActive(db);
    expect(session).toBeNull();

    const all = db.prepare("SELECT * FROM sessions").all() as any[];
    expect(all.length).toBe(1);
    expect(all[0].end_time).toBe(now + 5000);
  });
});

describe("migration idempotency", () => {
  it("running initializeSchema multiple times on old DB is safe", () => {
    const db = createOldSchemaDb();
    db.prepare("INSERT INTO accounts (label, username) VALUES (?, ?)").run(
      "A",
      "a",
    );
    db.prepare(
      "INSERT INTO projects (name, repo, account_id) VALUES (?, ?, ?)",
    ).run("P", "p/a", 1);
    db.prepare(
      "INSERT INTO sessions (project_id, start_time) VALUES (?, ?)",
    ).run(1, 100);

    initializeSchema(db);
    initializeSchema(db);
    initializeSchema(db);

    const columns = getColumns(db, "sessions");
    expect(columns).toContain("paused_at");
    expect(columns).toContain("total_paused_ms");

    const sessions = db.prepare("SELECT * FROM sessions").all() as any[];
    expect(sessions.length).toBe(1);
    expect(sessions[0].paused_at).toBeNull();
    expect(sessions[0].total_paused_ms).toBe(0);
  });
});

describe("session object completeness", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createFreshDb();
    initializeSchema(db);
    db.prepare("INSERT INTO accounts (label, username) VALUES (?, ?)").run(
      "Test",
      "tester",
    );
    db.prepare(
      "INSERT INTO projects (name, repo, account_id) VALUES (?, ?, ?)",
    ).run("Proj", "t/p", 1);
  });

  it("getById returns paused_at and total_paused_ms for new sessions", () => {
    const now = Date.now();
    const info = sessionQueries.create(db, { project_id: 1, start_time: now });
    const session = sessionQueries.getById(
      db,
      Number(info.lastInsertRowid),
    ) as any;

    expect(session).toBeDefined();
    expect(session.paused_at).toBeNull();
    expect(session.total_paused_ms).toBe(0);
  });

  it("getActive returns paused_at and total_paused_ms for new sessions", () => {
    const now = Date.now();
    sessionQueries.create(db, { project_id: 1, start_time: now });
    const session = sessionQueries.getActive(db) as any;

    expect(session).toBeDefined();
    expect(session.paused_at).toBeNull();
    expect(session.total_paused_ms).toBe(0);
  });
});

describe("schema versioning and indexes", () => {
  it("sets user_version to the latest migration", () => {
    const db = createFreshDb();
    initializeSchema(db);
    const version = db.pragma("user_version", { simple: true }) as number;
    expect(version).toBeGreaterThanOrEqual(3);
  });

  it("creates the sessions indexes", () => {
    const db = createFreshDb();
    initializeSchema(db);
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='sessions'",
      )
      .all()
      .map((i: any) => i.name);
    expect(indexes).toContain("idx_sessions_start_time");
    expect(indexes).toContain("idx_sessions_project_start");
    expect(indexes).toContain("idx_sessions_active");
  });

  it("migrates an old database to the latest version with indexes", () => {
    const db = createOldSchemaDb();
    initializeSchema(db);
    const version = db.pragma("user_version", { simple: true }) as number;
    expect(version).toBeGreaterThanOrEqual(3);

    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='sessions'",
      )
      .all()
      .map((i: any) => i.name);
    expect(indexes).toContain("idx_sessions_start_time");
  });
});

describe("stale sessions", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createFreshDb();
    initializeSchema(db);
    db.prepare("INSERT INTO accounts (label, username) VALUES (?, ?)").run(
      "Test",
      "tester",
    );
    db.prepare(
      "INSERT INTO projects (name, repo, account_id) VALUES (?, ?, ?)",
    ).run("Proj", "t/p", 1);
  });

  it("getStaleSessions returns only open sessions older than the threshold", () => {
    const now = Date.now();
    sessionQueries.create(db, {
      project_id: 1,
      start_time: now - 48 * 3600_000,
    });
    sessionQueries.create(db, { project_id: 1, start_time: now - 3600_000 });

    const stale = sessionQueries.getStaleSessions(db, {
      threshold: now - 24 * 3600_000,
    });
    expect(stale.length).toBe(1);
    expect(stale[0].start_time).toBe(now - 48 * 3600_000);
  });

  it("getStaleSessions ignores already closed sessions", () => {
    const now = Date.now();
    const info = sessionQueries.create(db, {
      project_id: 1,
      start_time: now - 48 * 3600_000,
    });
    sessionQueries.stop(db, {
      id: Number(info.lastInsertRowid),
      end_time: now - 47 * 3600_000,
    });

    const stale = sessionQueries.getStaleSessions(db, {
      threshold: now - 24 * 3600_000,
    });
    expect(stale.length).toBe(0);
  });

  it("closeStale closes only the given ids", () => {
    const now = Date.now();
    const a = sessionQueries.create(db, {
      project_id: 1,
      start_time: now - 50 * 3600_000,
    });
    const b = sessionQueries.create(db, {
      project_id: 1,
      start_time: now - 49 * 3600_000,
    });

    sessionQueries.closeStale(db, {
      ids: [Number(a.lastInsertRowid)],
      end_time: now,
    });

    const sessionA = sessionQueries.getById(
      db,
      Number(a.lastInsertRowid),
    ) as any;
    const sessionB = sessionQueries.getById(
      db,
      Number(b.lastInsertRowid),
    ) as any;
    expect(sessionA.end_time).toBe(now);
    expect(sessionB.end_time).toBeNull();
  });
});

describe("listFiltered", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createFreshDb();
    initializeSchema(db);
    db.prepare("INSERT INTO accounts (label, username) VALUES (?, ?)").run(
      "Test",
      "tester",
    );
    db.prepare(
      "INSERT INTO projects (name, repo, account_id) VALUES (?, ?, ?)",
    ).run("P1", "t/p1", 1);
    db.prepare(
      "INSERT INTO projects (name, repo, account_id) VALUES (?, ?, ?)",
    ).run("P2", "t/p2", 1);
  });

  it("filters by projectId", () => {
    sessionQueries.create(db, { project_id: 1, start_time: 1000 });
    sessionQueries.create(db, { project_id: 2, start_time: 2000 });

    const result = sessionQueries.listFiltered(db, { projectId: 2 }) as any[];
    expect(result.length).toBe(1);
    expect(result[0].project_id).toBe(2);
  });

  it("filters by from/to range and includes still-open sessions", () => {
    const s1 = sessionQueries.create(db, { project_id: 1, start_time: 1000 });
    sessionQueries.stop(db, { id: Number(s1.lastInsertRowid), end_time: 2000 });
    sessionQueries.create(db, { project_id: 1, start_time: 5000 });
    sessionQueries.create(db, { project_id: 1, start_time: 9000 }); // abierta

    // Semántica actual: las sesiones abiertas (end_time NULL) siempre pasan el
    // filtro "to" para que la sesión en curso aparezca en el reporte del mes.
    const result = sessionQueries.listFiltered(db, {
      from: 1500,
      to: 6000,
    }) as any[];
    expect(result.map((s) => s.start_time)).toEqual([9000, 5000]);
  });

  it("orders by start_time descending", () => {
    sessionQueries.create(db, { project_id: 1, start_time: 1000 });
    sessionQueries.create(db, { project_id: 1, start_time: 3000 });
    sessionQueries.create(db, { project_id: 1, start_time: 2000 });

    const result = sessionQueries.listFiltered(db, {}) as any[];
    expect(result.map((s) => s.start_time)).toEqual([3000, 2000, 1000]);
  });
});
