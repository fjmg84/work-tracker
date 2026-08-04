"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const connection_1 = __importDefault(require("./db/connection"));
const migrations_1 = require("./db/migrations");
const queries_1 = require("./db/queries");
const window_1 = require("./window");
const ipc_1 = require("./ipc");
const idleMonitor_1 = require("./services/idleMonitor");
(0, migrations_1.initializeSchema)(connection_1.default);
(0, ipc_1.registerIpcHandlers)(connection_1.default);
electron_1.app.whenReady().then(() => {
    (0, window_1.createWindow)(() => (0, idleMonitor_1.notifyStaleSessions)(connection_1.default));
    (0, idleMonitor_1.setupIdleMonitor)(connection_1.default);
});
function closeActiveSessions() {
    queries_1.sessionQueries.closeAllActive(connection_1.default, { end_time: Date.now() });
}
electron_1.app.on("before-quit", () => {
    closeActiveSessions();
});
electron_1.app.on("window-all-closed", () => {
    closeActiveSessions();
    if (process.platform !== "darwin")
        electron_1.app.quit();
});
electron_1.app.on("activate", () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        (0, window_1.createWindow)(() => (0, idleMonitor_1.notifyStaleSessions)(connection_1.default));
    }
});
