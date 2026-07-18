import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  db: {
    listAccounts: () => ipcRenderer.invoke("db:listAccounts"),
    createAccount: (data: any) => ipcRenderer.invoke("db:createAccount", data),
    updateAccount: (data: any) => ipcRenderer.invoke("db:updateAccount", data),
    deleteAccount: (id: any) => ipcRenderer.invoke("db:deleteAccount", id),

    listProjects: () => ipcRenderer.invoke("db:listProjects"),
    createProject: (data: any) => ipcRenderer.invoke("db:createProject", data),
    updateProject: (data: any) => ipcRenderer.invoke("db:updateProject", data),
    deleteProject: (id: any) => ipcRenderer.invoke("db:deleteProject", id),

    listSessions: (filters: any) =>
      ipcRenderer.invoke("db:listSessions", filters),
    createSession: (data: any) => ipcRenderer.invoke("db:createSession", data),
    stopSession: (data: any) => ipcRenderer.invoke("db:stopSession", data),
    deleteSession: (id: any) => ipcRenderer.invoke("db:deleteSession", id),
    getActiveSession: () => ipcRenderer.invoke("db:getActiveSession"),
    pauseSession: (data: any) => ipcRenderer.invoke("db:pauseSession", data),
    resumeSession: (data: any) =>
      ipcRenderer.invoke("db:resumeSession", data),
    closeStaleSessions: (ids: any) =>
      ipcRenderer.invoke("db:closeStaleSessions", ids),
  },
  github: {
    getUserActivity: (data: any) =>
      ipcRenderer.invoke("github:getUserActivity", data),
    validateToken: (data: any) =>
      ipcRenderer.invoke("github:validateToken", data),
    getCommitDiffs: (data: any) =>
      ipcRenderer.invoke("github:getCommitDiffs", data),
    getBranches: (data: any) =>
      ipcRenderer.invoke("github:getBranches", data),
    getBranchChanges: (data: any) =>
      ipcRenderer.invoke("github:getBranchChanges", data),
  },
  ai: {
    generatePrDescription: (data: any) =>
      ipcRenderer.invoke("ai:generatePrDescription", data),
    generatePrDescriptionFromPr: (data: any) =>
      ipcRenderer.invoke("ai:generatePrDescriptionFromPr", data),
    generatePrDescriptionFromBranch: (data: any) =>
      ipcRenderer.invoke("ai:generatePrDescriptionFromBranch", data),
    getConfig: () => ipcRenderer.invoke("ai:getConfig"),
    saveConfig: (config: any) => ipcRenderer.invoke("ai:saveConfig", config),
    testConnection: () => ipcRenderer.invoke("ai:testConnection"),
  },
  app: {
    exportCsv: (data: any) => ipcRenderer.invoke("app:exportCsv", data),
    showSaveDialog: (options: any) =>
      ipcRenderer.invoke("app:showSaveDialog", options),
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    const listener = (_event: any, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
});
