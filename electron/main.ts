import { app, BrowserWindow } from "electron";
import db from "./db/connection";
import { initializeSchema } from "./db/migrations";
import { sessionQueries } from "./db/queries";
import { createWindow } from "./window";
import { registerIpcHandlers } from "./ipc";
import { notifyStaleSessions, setupIdleMonitor } from "./services/idleMonitor";

initializeSchema(db);
registerIpcHandlers(db);

app.whenReady().then(() => {
  createWindow(() => notifyStaleSessions(db));
  setupIdleMonitor(db);
});

function closeActiveSessions(): void {
  sessionQueries.closeAllActive(db, { end_time: Date.now() });
}

app.on("before-quit", () => {
  closeActiveSessions();
});

app.on("window-all-closed", () => {
  closeActiveSessions();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow(() => notifyStaleSessions(db));
  }
});
