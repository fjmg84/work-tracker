import { ipcMain } from "electron";
import type Database from "better-sqlite3";
import { projectQueries } from "../db/queries";
import { IPC } from "../shared/contract";
import { assertId, assertString, assertRepo } from "./validate";

export function registerProjectHandlers(db: Database.Database): void {
  ipcMain.handle(IPC.db.listProjects, () => projectQueries.listAll(db));

  ipcMain.handle(IPC.db.createProject, (_, payload) => {
    const { name, repo, account_id } = payload ?? {};
    assertString(name, "name");
    assertRepo(repo, "repo");
    assertId(account_id, "account_id");
    const info = projectQueries.create(db, { name, repo, account_id });
    return { id: info.lastInsertRowid, name, repo, account_id };
  });

  ipcMain.handle(IPC.db.updateProject, (_, payload) => {
    const { id, name, repo, account_id } = payload ?? {};
    assertId(id, "id");
    assertString(name, "name");
    assertRepo(repo, "repo");
    assertId(account_id, "account_id");
    projectQueries.update(db, { id, name, repo, account_id });
    return { id, name, repo, account_id };
  });

  ipcMain.handle(IPC.db.deleteProject, (_, id) => {
    assertId(id, "id");
    projectQueries.delete(db, id);
    return true;
  });
}
