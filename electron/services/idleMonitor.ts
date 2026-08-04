import { powerMonitor } from "electron";
import type Database from "better-sqlite3";
import { sessionQueries } from "../db/queries";
import { getMainWindow } from "../window";
import { IPC } from "../shared/contract";

const IDLE_THRESHOLD_SECONDS = 600;
const CHECK_INTERVAL_MS = 60000;
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function pauseActiveSession(db: Database.Database): void {
  const session = sessionQueries.getActiveUnpaused(db);
  if (session) {
    sessionQueries.markIdlePaused(db, { id: session.id, paused_at: Date.now() });
    getMainWindow()?.webContents.send(IPC.events.sessionAutoPaused);
  }
}

export function setupIdleMonitor(db: Database.Database): void {
  powerMonitor.on("suspend", () => pauseActiveSession(db));
  setInterval(() => {
    if (powerMonitor.getSystemIdleTime() >= IDLE_THRESHOLD_SECONDS) {
      pauseActiveSession(db);
    }
  }, CHECK_INTERVAL_MS);
}

export function getStaleSessions(db: Database.Database) {
  return sessionQueries.getStaleSessions(db, {
    threshold: Date.now() - STALE_THRESHOLD_MS,
  });
}

export function notifyStaleSessions(db: Database.Database): void {
  const stale = getStaleSessions(db);
  if (stale.length > 0) {
    getMainWindow()?.webContents.send(IPC.events.staleDetected, stale);
  }
}
