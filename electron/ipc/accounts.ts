import { ipcMain } from "electron";
import type Database from "better-sqlite3";
import { accountQueries } from "../db/queries";
import { safeStoreToken, safeDeleteToken } from "../services/tokens";
import { IPC } from "../shared/contract";
import { assertId, assertString, optionalString } from "./validate";

export function registerAccountHandlers(
  db: Database.Database,
  onAccountChanged: (accountId: number) => void,
): void {
  ipcMain.handle(IPC.db.listAccounts, () => accountQueries.listAll(db));

  ipcMain.handle(IPC.db.createAccount, (_, payload) => {
    const { label, username, token } = payload ?? {};
    assertString(label, "label");
    assertString(username, "username");
    assertString(token, "token");
    const info = accountQueries.create(db, { label, username });
    const id = Number(info.lastInsertRowid);
    safeStoreToken(id, token);
    return { id, label, username };
  });

  ipcMain.handle(IPC.db.updateAccount, (_, payload) => {
    const { id, label, username, token } = payload ?? {};
    assertId(id, "id");
    assertString(label, "label");
    assertString(username, "username");
    optionalString(token, "token");
    accountQueries.update(db, { id, label, username });
    if (token) safeStoreToken(id, token);
    onAccountChanged(id);
    return { id, label, username };
  });

  ipcMain.handle(IPC.db.deleteAccount, (_, id) => {
    assertId(id, "id");
    accountQueries.delete(db, id);
    safeDeleteToken(id);
    onAccountChanged(id);
    return true;
  });
}
