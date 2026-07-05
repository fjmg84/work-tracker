import { app, BrowserWindow, ipcMain, safeStorage, dialog, powerMonitor } from "electron";
import path from "path";
import { Octokit } from "@octokit/rest";
import fs from "fs";
import db from "./db/connection";
import { initializeSchema } from "./db/migrations";
import { accountQueries, projectQueries, sessionQueries } from "./db/queries";

const isDev = !app.isPackaged;
const PORT = 5170;

initializeSchema(db);

// ============================================================
// Token encryption helpers
// ============================================================

function safeStoreToken(accountId: number, token: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("El almacenamiento seguro no está disponible en este sistema.");
  }
  const encrypted = safeStorage.encryptString(token);
  const tokenPath = path.join(app.getPath("userData"), `token_${accountId}.bin`);
  fs.writeFileSync(tokenPath, encrypted);
}

function safeGetToken(accountId: number): string | null {
  const tokenPath = path.join(app.getPath("userData"), `token_${accountId}.bin`);
  if (!fs.existsSync(tokenPath)) return null;
  const encrypted = fs.readFileSync(tokenPath);
  return safeStorage.decryptString(encrypted);
}

function safeDeleteToken(accountId: number): void {
  const tokenPath = path.join(app.getPath("userData"), `token_${accountId}.bin`);
  if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
}

// ============================================================
// Window
// ============================================================

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${PORT}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ============================================================
// App lifecycle
// ============================================================

app.whenReady().then(() => {
  createWindow();

  // Power monitor: track suspend/resume
  let suspendTimestamp: number | null = null;

  powerMonitor.on("suspend", () => {
    suspendTimestamp = Date.now();
  });

  powerMonitor.on("resume", () => {
    if (suspendTimestamp) {
      const suspendDuration = Date.now() - suspendTimestamp;
      sessionQueries.adjustForSuspend(db, { suspendDuration });
      suspendTimestamp = null;
      mainWindow?.webContents.send("session:resumed-from-suspend");
    }
  });

  // Idle detection: auto-pause after 10 minutes of inactivity
  setInterval(() => {
    const idleSeconds = powerMonitor.getSystemIdleTime();
    if (idleSeconds >= 600) {
      const session = sessionQueries.getActiveUnpaused(db);
      if (session) {
        sessionQueries.markIdlePaused(db, { id: session.id, paused_at: Date.now() });
        mainWindow?.webContents.send("session:auto-paused");
      }
    }
  }, 60000);

  // Detect stale sessions (>24h)
  const threshold = Date.now() - 24 * 60 * 60 * 1000;
  const staleSessions = sessionQueries.getStaleSessions(db, { threshold });
  if (staleSessions.length > 0) {
    mainWindow?.webContents.send("sessions:stale-detected", staleSessions);
  }
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
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ============================================================
// IPC: Accounts
// ============================================================

ipcMain.handle("db:listAccounts", () => {
  return accountQueries.listAll(db);
});

ipcMain.handle("db:createAccount", (_, { label, username, token }) => {
  const info = accountQueries.create(db, { label, username });
  const id = Number(info.lastInsertRowid);
  safeStoreToken(id, token);
  return { id, label, username };
});

ipcMain.handle("db:updateAccount", (_, { id, label, username, token }) => {
  accountQueries.update(db, { id, label, username });
  if (token) safeStoreToken(id, token);
  return { id, label, username };
});

ipcMain.handle("db:deleteAccount", (_, id) => {
  accountQueries.delete(db, id);
  safeDeleteToken(id);
  return true;
});

// ============================================================
// IPC: Projects
// ============================================================

ipcMain.handle("db:listProjects", () => {
  return projectQueries.listAll(db);
});

ipcMain.handle("db:createProject", (_, { name, repo, account_id }) => {
  const info = projectQueries.create(db, { name, repo, account_id });
  return { id: info.lastInsertRowid, name, repo, account_id };
});

ipcMain.handle("db:updateProject", (_, { id, name, repo, account_id }) => {
  projectQueries.update(db, { id, name, repo, account_id });
  return { id, name, repo, account_id };
});

ipcMain.handle("db:deleteProject", (_, id) => {
  projectQueries.delete(db, id);
  return true;
});

// ============================================================
// IPC: Sessions
// ============================================================

ipcMain.handle("db:listSessions", (_, { projectId, from, to }) => {
  return sessionQueries.listFiltered(db, { projectId, from, to });
});

ipcMain.handle("db:createSession", (_, { project_id, start_time, notes }) => {
  const info = sessionQueries.create(db, { project_id, start_time, notes });
  return { id: info.lastInsertRowid, project_id, start_time, notes };
});

ipcMain.handle("db:stopSession", (_, { id, end_time }) => {
  return sessionQueries.stop(db, { id, end_time });
});

ipcMain.handle("db:deleteSession", (_, id) => {
  sessionQueries.delete(db, id);
  return true;
});

ipcMain.handle("db:getActiveSession", () => {
  return sessionQueries.getActive(db);
});

ipcMain.handle("db:pauseSession", (_, { id }) => {
  return sessionQueries.pause(db, { id, paused_at: Date.now() });
});

ipcMain.handle("db:resumeSession", (_, { id }) => {
  const session = sessionQueries.getById(db, id) as { paused_at: number | null } | undefined;
  if (session?.paused_at) {
    const pausedDuration = Date.now() - session.paused_at;
    return sessionQueries.resume(db, { id, pausedDuration });
  }
  return session;
});

ipcMain.handle("db:closeStaleSessions", (_, { ids }) => {
  sessionQueries.closeStale(db, { ids, end_time: Date.now() });
  return true;
});

// ============================================================
// IPC: GitHub
// ============================================================

ipcMain.handle("github:getUserActivity", async (_, { accountId, repo, since, until }) => {
  const token = safeGetToken(accountId);
  if (!token) throw new Error("No se encontró token para esta cuenta.");

  const octokit = new Octokit({ auth: token });
  const account = accountQueries.getById(db, accountId);
  if (!account) throw new Error("Cuenta no encontrada.");

  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) throw new Error("El formato del repo debe ser usuario/repo.");

  let prs: any[];
  try {
    prs = await octokit.paginate(octokit.rest.pulls.list, {
      owner,
      repo: repoName,
      state: "all",
      per_page: 100,
    });
  } catch (error: any) {
    if (error.status === 404) {
      throw new Error(
        `Repositorio "${owner}/${repoName}" no encontrado. Verifica que el formato sea correcto (ej: usuario/repo) y que tengas acceso.`
      );
    }
    throw new Error(`Error al obtener PRs: ${error.message}`);
  }

  const filteredPrs = prs
    .filter((pr) => pr.user && pr.user.login === account.username)
    .filter((pr) => {
      const created = new Date(pr.created_at).getTime();
      return created >= since && created <= until;
    });

  const prsWithCommits = await Promise.all(
    filteredPrs.map(async (pr) => {
      try {
        const prCommits = await octokit.paginate(octokit.rest.pulls.listCommits, {
          owner,
          repo: repoName,
          pull_number: pr.number,
          per_page: 100,
        });

        const filteredPrCommits = prCommits
          .filter((c) => c.author && c.author.login === account.username)
          .map((c) => ({
            sha: c.sha,
            message: c.commit.message.split("\n")[0],
            date: c.commit.committer?.date || "",
            html_url: c.html_url,
          }));

        return {
          id: pr.id,
          number: pr.number,
          title: pr.title,
          state: pr.state,
          created_at: pr.created_at,
          html_url: pr.html_url,
          account_username: account.username,
          commits: filteredPrCommits,
        };
      } catch (error: any) {
        console.error(`Error fetching commits for PR #${pr.number}:`, error);
        return {
          id: pr.id,
          number: pr.number,
          title: pr.title,
          state: pr.state,
          created_at: pr.created_at,
          html_url: pr.html_url,
          account_username: account.username,
          commits: [],
        };
      }
    }),
  );

  return { prs: prsWithCommits };
});

ipcMain.handle("github:validateToken", async (_, { token }) => {
  try {
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.users.getAuthenticated();
    return { valid: true, username: data.login };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
});

// ============================================================
// IPC: App
// ============================================================

ipcMain.handle("app:exportCsv", async (_, { filePath, content }) => {
  fs.writeFileSync(filePath, content, "utf8");
  return true;
});

ipcMain.handle("app:showSaveDialog", async (_, { defaultPath }) => {
  const result = await dialog.showSaveDialog({
    defaultPath,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  return result;
});
