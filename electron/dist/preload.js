"use strict";

// electron/preload.ts
var import_electron = require("electron");

// electron/shared/contract.ts
var IPC = {
  db: {
    listAccounts: "db:listAccounts",
    createAccount: "db:createAccount",
    updateAccount: "db:updateAccount",
    deleteAccount: "db:deleteAccount",
    listProjects: "db:listProjects",
    createProject: "db:createProject",
    updateProject: "db:updateProject",
    deleteProject: "db:deleteProject",
    listSessions: "db:listSessions",
    createSession: "db:createSession",
    stopSession: "db:stopSession",
    deleteSession: "db:deleteSession",
    getActiveSession: "db:getActiveSession",
    pauseSession: "db:pauseSession",
    resumeSession: "db:resumeSession",
    closeStaleSessions: "db:closeStaleSessions"
  },
  github: {
    getUserActivity: "github:getUserActivity",
    validateToken: "github:validateToken",
    getCommitDiffs: "github:getCommitDiffs",
    getBranches: "github:getBranches",
    getBranchChanges: "github:getBranchChanges"
  },
  ai: {
    generatePrDescription: "ai:generatePrDescription",
    generatePrDescriptionFromPr: "ai:generatePrDescriptionFromPr",
    generatePrDescriptionFromBranch: "ai:generatePrDescriptionFromBranch",
    getConfig: "ai:getConfig",
    saveConfig: "ai:saveConfig",
    testConnection: "ai:testConnection"
  },
  app: {
    exportCsv: "app:exportCsv",
    showSaveDialog: "app:showSaveDialog"
  },
  events: {
    sessionAutoPaused: "session:auto-paused",
    staleDetected: "sessions:stale-detected"
  }
};

// electron/preload.ts
var api = {
  db: {
    listAccounts: () => import_electron.ipcRenderer.invoke(IPC.db.listAccounts),
    createAccount: (data) => import_electron.ipcRenderer.invoke(IPC.db.createAccount, data),
    updateAccount: (data) => import_electron.ipcRenderer.invoke(IPC.db.updateAccount, data),
    deleteAccount: (id) => import_electron.ipcRenderer.invoke(IPC.db.deleteAccount, id),
    listProjects: () => import_electron.ipcRenderer.invoke(IPC.db.listProjects),
    createProject: (data) => import_electron.ipcRenderer.invoke(IPC.db.createProject, data),
    updateProject: (data) => import_electron.ipcRenderer.invoke(IPC.db.updateProject, data),
    deleteProject: (id) => import_electron.ipcRenderer.invoke(IPC.db.deleteProject, id),
    listSessions: (filters) => import_electron.ipcRenderer.invoke(IPC.db.listSessions, filters),
    createSession: (data) => import_electron.ipcRenderer.invoke(IPC.db.createSession, data),
    stopSession: (data) => import_electron.ipcRenderer.invoke(IPC.db.stopSession, data),
    deleteSession: (id) => import_electron.ipcRenderer.invoke(IPC.db.deleteSession, id),
    getActiveSession: () => import_electron.ipcRenderer.invoke(IPC.db.getActiveSession),
    pauseSession: (data) => import_electron.ipcRenderer.invoke(IPC.db.pauseSession, data),
    resumeSession: (data) => import_electron.ipcRenderer.invoke(IPC.db.resumeSession, data),
    closeStaleSessions: (data) => import_electron.ipcRenderer.invoke(IPC.db.closeStaleSessions, data)
  },
  github: {
    getUserActivity: (data) => import_electron.ipcRenderer.invoke(IPC.github.getUserActivity, data),
    validateToken: (data) => import_electron.ipcRenderer.invoke(IPC.github.validateToken, data),
    getCommitDiffs: (data) => import_electron.ipcRenderer.invoke(IPC.github.getCommitDiffs, data),
    getBranches: (data) => import_electron.ipcRenderer.invoke(IPC.github.getBranches, data),
    getBranchChanges: (data) => import_electron.ipcRenderer.invoke(IPC.github.getBranchChanges, data)
  },
  ai: {
    generatePrDescription: (data) => import_electron.ipcRenderer.invoke(IPC.ai.generatePrDescription, data),
    generatePrDescriptionFromPr: (data) => import_electron.ipcRenderer.invoke(IPC.ai.generatePrDescriptionFromPr, data),
    generatePrDescriptionFromBranch: (data) => import_electron.ipcRenderer.invoke(IPC.ai.generatePrDescriptionFromBranch, data),
    getConfig: () => import_electron.ipcRenderer.invoke(IPC.ai.getConfig),
    saveConfig: (config) => import_electron.ipcRenderer.invoke(IPC.ai.saveConfig, config),
    testConnection: () => import_electron.ipcRenderer.invoke(IPC.ai.testConnection)
  },
  app: {
    exportCsv: (data) => import_electron.ipcRenderer.invoke(IPC.app.exportCsv, data),
    showSaveDialog: (options) => import_electron.ipcRenderer.invoke(IPC.app.showSaveDialog, options)
  },
  on: (channel, callback) => {
    const listener = (_event, ...args) => callback(...args);
    import_electron.ipcRenderer.on(channel, listener);
    return () => {
      import_electron.ipcRenderer.removeListener(channel, listener);
    };
  }
};
import_electron.contextBridge.exposeInMainWorld("api", api);
