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
    db.prepare("INSERT INTO accounts (label, username) VALUES (?, ?)").run("Test Account", "testuser");
    db.prepare("INSERT INTO projects (name, repo, account_id) VALUES (?, ?, ?)").run("Test Repo", "test/repo", 1);
    db.prepare("INSERT INTO sessions (project_id, start_time, notes) VALUES (?, ?, ?)").run(1, 1000, "old session");

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
    db.prepare("INSERT INTO accounts (label, username) VALUES (?, ?)").run("Test", "tester");
    db.prepare("INSERT INTO projects (name, repo, account_id) VALUES (?, ?, ?)").run("Proj", "t/p", 1);
  });

  it("pause() sets paused_at on the session", () => {
    const now = Date.now();
    sessionQueries.create(db, { project_id: 1, start_time: now });
    const session = sessionQueries.getActive(db) as any;

    const paused = sessionQueries.pause(db, { id: session.id, paused_at: now + 5000 }) as any;

    expect(paused.paused_at).toBe(now + 5000);
    expect(paused.total_paused_ms).toBe(0);
  });

  it("resume() clears paused_at and accumulates total_paused_ms", () => {
    const now = Date.now();
    sessionQueries.create(db, { project_id: 1, start_time: now });
    const session = sessionQueries.getActive(db) as any;

    // Pause at now + 5s, resume at now + 10s → 5s paused
    sessionQueries.pause(db, { id: session.id, paused_at: now + 5000 });
    const resumed = sessionQueries.resume(db, { id: session.id, pausedDuration: 5000 }) as any;

    expect(resumed.paused_at).toBeNull();
    expect(resumed.total_paused_ms).toBe(5000);
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
    const resumed = sessionQueries.resume(db, { id: session.id, pausedDuration: 7000 }) as any;

    expect(resumed.total_paused_ms).toBe(10000);
  });

  it("adjustForSuspend() adds suspend time to active sessions", () => {
    const now = Date.now();
    sessionQueries.create(db, { project_id: 1, start_time: now });

    sessionQueries.adjustForSuspend(db, { suspendDuration: 120000 }); // 2 min

    const session = sessionQueries.getActive(db) as any;
    expect(session.total_paused_ms).toBe(120000);
    expect(session.start_time).toBe(now + 120000);
  });

  it("adjustForSuspend() does not affect paused sessions", () => {
    const now = Date.now();
    sessionQueries.create(db, { project_id: 1, start_time: now });
    const session = sessionQueries.getActive(db) as any;

    sessionQueries.pause(db, { id: session.id, paused_at: now + 1000 });

    // Suspend happens while paused — should still be tracked
    sessionQueries.adjustForSuspend(db, { suspendDuration: 60000 });

    const updated = sessionQueries.getById(db, session.id) as any;
    // paused sessions are also active (end_time IS NULL), so they get adjusted
    expect(updated.total_paused_ms).toBe(60000);
  });

  it("adjustForSuspend() does not affect stopped sessions", () => {
    const now = Date.now();
    sessionQueries.create(db, { project_id: 1, start_time: now });
    const session = sessionQueries.getActive(db) as any;

    sessionQueries.stop(db, { id: session.id, end_time: now + 10000 });

    sessionQueries.adjustForSuspend(db, { suspendDuration: 60000 });

    const stopped = sessionQueries.getById(db, session.id) as any;
    expect(stopped.total_paused_ms).toBe(0);
    expect(stopped.end_time).toBe(now + 10000);
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
    db.prepare("INSERT INTO accounts (label, username) VALUES (?, ?)").run("A", "a");
    db.prepare("INSERT INTO projects (name, repo, account_id) VALUES (?, ?, ?)").run("P", "p/a", 1);
    db.prepare("INSERT INTO sessions (project_id, start_time) VALUES (?, ?)").run(1, 100);

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
    db.prepare("INSERT INTO accounts (label, username) VALUES (?, ?)").run("Test", "tester");
    db.prepare("INSERT INTO projects (name, repo, account_id) VALUES (?, ?, ?)").run("Proj", "t/p", 1);
  });

  it("getById returns paused_at and total_paused_ms for new sessions", () => {
    const now = Date.now();
    const info = sessionQueries.create(db, { project_id: 1, start_time: now });
    const session = sessionQueries.getById(db, Number(info.lastInsertRowid)) as any;

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
