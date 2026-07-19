"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("api", {
    db: {
        listAccounts: () => electron_1.ipcRenderer.invoke("db:listAccounts"),
        createAccount: (data) => electron_1.ipcRenderer.invoke("db:createAccount", data),
        updateAccount: (data) => electron_1.ipcRenderer.invoke("db:updateAccount", data),
        deleteAccount: (id) => electron_1.ipcRenderer.invoke("db:deleteAccount", id),
        listProjects: () => electron_1.ipcRenderer.invoke("db:listProjects"),
        createProject: (data) => electron_1.ipcRenderer.invoke("db:createProject", data),
        updateProject: (data) => electron_1.ipcRenderer.invoke("db:updateProject", data),
        deleteProject: (id) => electron_1.ipcRenderer.invoke("db:deleteProject", id),
        listSessions: (filters) => electron_1.ipcRenderer.invoke("db:listSessions", filters),
        createSession: (data) => electron_1.ipcRenderer.invoke("db:createSession", data),
        stopSession: (data) => electron_1.ipcRenderer.invoke("db:stopSession", data),
        deleteSession: (id) => electron_1.ipcRenderer.invoke("db:deleteSession", id),
        getActiveSession: () => electron_1.ipcRenderer.invoke("db:getActiveSession"),
        pauseSession: (data) => electron_1.ipcRenderer.invoke("db:pauseSession", data),
        resumeSession: (data) => electron_1.ipcRenderer.invoke("db:resumeSession", data),
        closeStaleSessions: (ids) => electron_1.ipcRenderer.invoke("db:closeStaleSessions", ids),
    },
    github: {
        getUserActivity: (data) => electron_1.ipcRenderer.invoke("github:getUserActivity", data),
        validateToken: (data) => electron_1.ipcRenderer.invoke("github:validateToken", data),
        getCommitDiffs: (data) => electron_1.ipcRenderer.invoke("github:getCommitDiffs", data),
        getBranches: (data) => electron_1.ipcRenderer.invoke("github:getBranches", data),
        getBranchChanges: (data) => electron_1.ipcRenderer.invoke("github:getBranchChanges", data),
    },
    ai: {
        generatePrDescription: (data) => electron_1.ipcRenderer.invoke("ai:generatePrDescription", data),
        generatePrDescriptionFromPr: (data) => electron_1.ipcRenderer.invoke("ai:generatePrDescriptionFromPr", data),
        generatePrDescriptionFromBranch: (data) => electron_1.ipcRenderer.invoke("ai:generatePrDescriptionFromBranch", data),
        getConfig: () => electron_1.ipcRenderer.invoke("ai:getConfig"),
        saveConfig: (config) => electron_1.ipcRenderer.invoke("ai:saveConfig", config),
        testConnection: () => electron_1.ipcRenderer.invoke("ai:testConnection"),
    },
    app: {
        exportCsv: (data) => electron_1.ipcRenderer.invoke("app:exportCsv", data),
        showSaveDialog: (options) => electron_1.ipcRenderer.invoke("app:showSaveDialog", options),
    },
    on: (channel, callback) => {
        const listener = (_event, ...args) => callback(...args);
        electron_1.ipcRenderer.on(channel, listener);
        return () => {
            electron_1.ipcRenderer.removeListener(channel, listener);
        };
    },
});
