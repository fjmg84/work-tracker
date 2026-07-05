import { app, BrowserWindow, ipcMain, safeStorage, dialog, powerMonitor } from "electron";
import path from "path";
import Database from "better-sqlite3";
import { Octokit } from "@octokit/rest";
import fs from "fs";

const isDev = !app.isPackaged;
const PORT = 5170;
const dbPath = path.join(app.getPath("userData"), "work-tracker.db");
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    repo TEXT NOT NULL,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    notes TEXT
  );
`);

function safeStoreToken(accountId: number, token: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "El almacenamiento seguro no está disponible en este sistema.",
    );
  }
  const encrypted = safeStorage.encryptString(token);
  const tokenPath = path.join(
    app.getPath("userData"),
    `token_${accountId}.bin`,
  );
  fs.writeFileSync(tokenPath, encrypted);
}

function safeGetToken(accountId: number): string | null {
  const tokenPath = path.join(
    app.getPath("userData"),
    `token_${accountId}.bin`,
  );
  if (!fs.existsSync(tokenPath)) return null;
  const encrypted = fs.readFileSync(tokenPath);
  return safeStorage.decryptString(encrypted);
}

function safeDeleteToken(accountId: number): void {
  const tokenPath = path.join(
    app.getPath("userData"),
    `token_${accountId}.bin`,
  );
  if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
}

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
      db.prepare(
        "UPDATE sessions SET start_time = start_time + ?, total_paused_ms = total_paused_ms + ? WHERE end_time IS NULL",
      ).run(suspendDuration, suspendDuration);
      suspendTimestamp = null;
      // Notify renderer
      mainWindow?.webContents.send("session:resumed-from-suspend");
    }
  });

  // Idle detection: auto-pause after 10 minutes of inactivity
  setInterval(() => {
    const idleSeconds = powerMonitor.getSystemIdleTime();
    if (idleSeconds >= 600) {
      const session = db
        .prepare(
          "SELECT * FROM sessions WHERE end_time IS NULL AND paused_at IS NULL",
        )
        .get() as any;
      if (session) {
        db.prepare("UPDATE sessions SET paused_at = ? WHERE id = ?").run(
          Date.now(),
          session.id,
        );
        mainWindow?.webContents.send("session:auto-paused");
      }
    }
  }, 60000);
});

function closeActiveSessions(): void {
  db.prepare("UPDATE sessions SET end_time = ? WHERE end_time IS NULL").run(
    Date.now(),
  );
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

ipcMain.handle("db:listAccounts", () => {
  return db
    .prepare("SELECT id, label, username FROM accounts ORDER BY label")
    .all();
});

ipcMain.handle("db:createAccount", (_, { label, username, token }) => {
  const stmt = db.prepare(
    "INSERT INTO accounts (label, username) VALUES (?, ?)",
  );
  const info = stmt.run(label, username);
  const id = Number(info.lastInsertRowid);
  safeStoreToken(id, token);
  return { id, label, username };
});

ipcMain.handle("db:updateAccount", (_, { id, label, username, token }) => {
  db.prepare("UPDATE accounts SET label = ?, username = ? WHERE id = ?").run(
    label,
    username,
    id,
  );
  if (token) safeStoreToken(id, token);
  return { id, label, username };
});

ipcMain.handle("db:deleteAccount", (_, id) => {
  db.prepare("DELETE FROM accounts WHERE id = ?").run(id);
  safeDeleteToken(id);
  return true;
});

ipcMain.handle("db:listProjects", () => {
  return db
    .prepare(
      `
    SELECT p.id, p.name, p.repo, p.account_id, a.label AS account_label, a.username AS account_username
    FROM projects p
    JOIN accounts a ON p.account_id = a.id
    ORDER BY p.name
  `,
    )
    .all();
});

ipcMain.handle("db:createProject", (_, { name, repo, account_id }) => {
  const stmt = db.prepare(
    "INSERT INTO projects (name, repo, account_id) VALUES (?, ?, ?)",
  );
  const info = stmt.run(name, repo, account_id);
  return { id: info.lastInsertRowid, name, repo, account_id };
});

ipcMain.handle("db:updateProject", (_, { id, name, repo, account_id }) => {
  db.prepare(
    "UPDATE projects SET name = ?, repo = ?, account_id = ? WHERE id = ?",
  ).run(name, repo, account_id, id);
  return { id, name, repo, account_id };
});

ipcMain.handle("db:deleteProject", (_, id) => {
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return true;
});

ipcMain.handle("db:listSessions", (_, { projectId, from, to }) => {
  let query = "SELECT * FROM sessions WHERE 1=1";
  const params = [];
  if (projectId) {
    query += " AND project_id = ?";
    params.push(projectId);
  }
  if (from) {
    query += " AND start_time >= ?";
    params.push(from);
  }
  if (to) {
    query += " AND (end_time IS NULL OR end_time <= ?)";
    params.push(to);
  }
  query += " ORDER BY start_time DESC";
  return db.prepare(query).all(...params);
});

ipcMain.handle("db:createSession", (_, { project_id, start_time, notes }) => {
  const stmt = db.prepare(
    "INSERT INTO sessions (project_id, start_time, notes) VALUES (?, ?, ?)",
  );
  const info = stmt.run(project_id, start_time, notes || "");
  return { id: info.lastInsertRowid, project_id, start_time, notes };
});

ipcMain.handle("db:stopSession", (_, { id, end_time }) => {
  db.prepare("UPDATE sessions SET end_time = ? WHERE id = ?").run(end_time, id);
  return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
});

ipcMain.handle("db:deleteSession", (_, id) => {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  return true;
});

ipcMain.handle("db:getActiveSession", () => {
  return (
    db.prepare("SELECT * FROM sessions WHERE end_time IS NULL LIMIT 1").get() ||
    null
  );
});

ipcMain.handle(
  "github:getUserActivity",
  async (_, { accountId, repo, since, until }) => {
    const token = safeGetToken(accountId);
    if (!token) throw new Error("No se encontró token para esta cuenta.");

    const octokit = new Octokit({ auth: token });
    const account = db
      .prepare("SELECT username FROM accounts WHERE id = ?")
      .get(accountId) as { username: string } | undefined;
    if (!account) throw new Error("Cuenta no encontrada.");

    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName)
      throw new Error("El formato del repo debe ser usuario/repo.");

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
          `Repositorio "${owner}/${repoName}" no encontrado. Verifica que el formato sea correcto (ej: usuario/repo) y que tengas acceso.`,
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

    // Get commits for each PR
    const prsWithCommits = await Promise.all(
      filteredPrs.map(async (pr) => {
        try {
          const prCommits = await octokit.paginate(
            octokit.rest.pulls.listCommits,
            {
              owner,
              repo: repoName,
              pull_number: pr.number,
              per_page: 100,
            },
          );

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
  },
);

ipcMain.handle("github:validateToken", async (_, { token }) => {
  try {
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.users.getAuthenticated();
    return { valid: true, username: data.login };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
});

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
