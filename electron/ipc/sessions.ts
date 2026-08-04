import { ipcMain } from "electron";
import type Database from "better-sqlite3";
import { sessionQueries } from "../db/queries";
import { IPC } from "../shared/contract";
import type { Session } from "../shared/contract";
import {
  assertId,
  assertIdArray,
  assertTimestamp,
  optionalString,
} from "./validate";

export function registerSessionHandlers(db: Database.Database): void {
  ipcMain.handle(IPC.db.listSessions, (_, filters) => {
    const { projectId, from, to } = filters ?? {};
    if (projectId !== undefined) assertId(projectId, "projectId");
    if (from !== undefined) assertTimestamp(from, "from");
    if (to !== undefined) assertTimestamp(to, "to");
    return sessionQueries.listFiltered(db, { projectId, from, to });
  });

  ipcMain.handle(IPC.db.createSession, (_, payload) => {
    const { project_id, start_time, notes } = payload ?? {};
    assertId(project_id, "project_id");
    assertTimestamp(start_time, "start_time");
    optionalString(notes, "notes");
    const info = sessionQueries.create(db, { project_id, start_time, notes });
    return sessionQueries.getById(db, Number(info.lastInsertRowid));
  });

  ipcMain.handle(IPC.db.stopSession, (_, payload) => {
    const { id, end_time } = payload ?? {};
    assertId(id, "id");
    assertTimestamp(end_time, "end_time");
    return sessionQueries.stop(db, { id, end_time });
  });

  ipcMain.handle(IPC.db.deleteSession, (_, id) => {
    assertId(id, "id");
    sessionQueries.delete(db, id);
    return true;
  });

  ipcMain.handle(IPC.db.getActiveSession, () => sessionQueries.getActive(db));

  ipcMain.handle(IPC.db.pauseSession, (_, payload) => {
    const { id } = payload ?? {};
    assertId(id, "id");
    return sessionQueries.pause(db, { id, paused_at: Date.now() });
  });

  ipcMain.handle(IPC.db.resumeSession, (_, payload) => {
    const { id } = payload ?? {};
    assertId(id, "id");
    const session = sessionQueries.getById(db, id) as Session | undefined;
    if (session?.paused_at) {
      const pausedDuration = Date.now() - session.paused_at;
      return sessionQueries.resume(db, { id, pausedDuration });
    }
    return session;
  });

  ipcMain.handle(IPC.db.closeStaleSessions, (_, payload) => {
    const { ids } = payload ?? {};
    assertIdArray(ids, "ids");
    sessionQueries.closeStale(db, { ids, end_time: Date.now() });
    return true;
  });
}
