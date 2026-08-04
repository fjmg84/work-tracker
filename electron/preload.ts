import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "./shared/contract";
import type { Api } from "./shared/contract";

const api: Api = {
  db: {
    listAccounts: () => ipcRenderer.invoke(IPC.db.listAccounts),
    createAccount: (data) => ipcRenderer.invoke(IPC.db.createAccount, data),
    updateAccount: (data) => ipcRenderer.invoke(IPC.db.updateAccount, data),
    deleteAccount: (id) => ipcRenderer.invoke(IPC.db.deleteAccount, id),

    listProjects: () => ipcRenderer.invoke(IPC.db.listProjects),
    createProject: (data) => ipcRenderer.invoke(IPC.db.createProject, data),
    updateProject: (data) => ipcRenderer.invoke(IPC.db.updateProject, data),
    deleteProject: (id) => ipcRenderer.invoke(IPC.db.deleteProject, id),

    listSessions: (filters) => ipcRenderer.invoke(IPC.db.listSessions, filters),
    createSession: (data) => ipcRenderer.invoke(IPC.db.createSession, data),
    stopSession: (data) => ipcRenderer.invoke(IPC.db.stopSession, data),
    deleteSession: (id) => ipcRenderer.invoke(IPC.db.deleteSession, id),
    getActiveSession: () => ipcRenderer.invoke(IPC.db.getActiveSession),
    pauseSession: (data) => ipcRenderer.invoke(IPC.db.pauseSession, data),
    resumeSession: (data) => ipcRenderer.invoke(IPC.db.resumeSession, data),
    closeStaleSessions: (data) =>
      ipcRenderer.invoke(IPC.db.closeStaleSessions, data),
  },
  github: {
    getUserActivity: (data) =>
      ipcRenderer.invoke(IPC.github.getUserActivity, data),
    validateToken: (data) => ipcRenderer.invoke(IPC.github.validateToken, data),
    getCommitDiffs: (data) =>
      ipcRenderer.invoke(IPC.github.getCommitDiffs, data),
    getBranches: (data) => ipcRenderer.invoke(IPC.github.getBranches, data),
    getBranchChanges: (data) =>
      ipcRenderer.invoke(IPC.github.getBranchChanges, data),
  },
  ai: {
    generatePrDescription: (data) =>
      ipcRenderer.invoke(IPC.ai.generatePrDescription, data),
    generatePrDescriptionFromPr: (data) =>
      ipcRenderer.invoke(IPC.ai.generatePrDescriptionFromPr, data),
    generatePrDescriptionFromBranch: (data) =>
      ipcRenderer.invoke(IPC.ai.generatePrDescriptionFromBranch, data),
    getConfig: () => ipcRenderer.invoke(IPC.ai.getConfig),
    saveConfig: (config) => ipcRenderer.invoke(IPC.ai.saveConfig, config),
    testConnection: () => ipcRenderer.invoke(IPC.ai.testConnection),
  },
  app: {
    exportCsv: (data) => ipcRenderer.invoke(IPC.app.exportCsv, data),
    showSaveDialog: (options) =>
      ipcRenderer.invoke(IPC.app.showSaveDialog, options),
  },
  on: (channel, callback) => {
    const listener = (_event: unknown, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
};

contextBridge.exposeInMainWorld("api", api);
