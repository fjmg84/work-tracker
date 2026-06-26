"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const rest_1 = require("@octokit/rest");
const fs_1 = __importDefault(require("fs"));
const isDev = process.env.NODE_ENV !== "production";
const dbPath = path_1.default.join(electron_1.app.getPath("userData"), "work-tracker.db");
const db = new better_sqlite3_1.default(dbPath);
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
function safeStoreToken(accountId, token) {
    if (!electron_1.safeStorage.isEncryptionAvailable()) {
        throw new Error("El almacenamiento seguro no está disponible en este sistema.");
    }
    const encrypted = electron_1.safeStorage.encryptString(token);
    const tokenPath = path_1.default.join(electron_1.app.getPath("userData"), `token_${accountId}.bin`);
    fs_1.default.writeFileSync(tokenPath, encrypted);
}
function safeGetToken(accountId) {
    const tokenPath = path_1.default.join(electron_1.app.getPath("userData"), `token_${accountId}.bin`);
    if (!fs_1.default.existsSync(tokenPath))
        return null;
    const encrypted = fs_1.default.readFileSync(tokenPath);
    return electron_1.safeStorage.decryptString(encrypted);
}
function safeDeleteToken(accountId) {
    const tokenPath = path_1.default.join(electron_1.app.getPath("userData"), `token_${accountId}.bin`);
    if (fs_1.default.existsSync(tokenPath))
        fs_1.default.unlinkSync(tokenPath);
}
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1000,
        height: 760,
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    if (isDev) {
        mainWindow.loadURL("http://localhost:5173");
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, "../../dist/index.html"));
    }
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(createWindow);
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        electron_1.app.quit();
});
electron_1.app.on("activate", () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0)
        createWindow();
});
electron_1.ipcMain.handle("db:listAccounts", () => {
    return db
        .prepare("SELECT id, label, username FROM accounts ORDER BY label")
        .all();
});
electron_1.ipcMain.handle("db:createAccount", (_, { label, username, token }) => {
    const stmt = db.prepare("INSERT INTO accounts (label, username) VALUES (?, ?)");
    const info = stmt.run(label, username);
    const id = Number(info.lastInsertRowid);
    safeStoreToken(id, token);
    return { id, label, username };
});
electron_1.ipcMain.handle("db:updateAccount", (_, { id, label, username, token }) => {
    db.prepare("UPDATE accounts SET label = ?, username = ? WHERE id = ?").run(label, username, id);
    if (token)
        safeStoreToken(id, token);
    return { id, label, username };
});
electron_1.ipcMain.handle("db:deleteAccount", (_, id) => {
    db.prepare("DELETE FROM accounts WHERE id = ?").run(id);
    safeDeleteToken(id);
    return true;
});
electron_1.ipcMain.handle("db:listProjects", () => {
    return db
        .prepare(`
    SELECT p.id, p.name, p.repo, p.account_id, a.label AS account_label, a.username AS account_username
    FROM projects p
    JOIN accounts a ON p.account_id = a.id
    ORDER BY p.name
  `)
        .all();
});
electron_1.ipcMain.handle("db:createProject", (_, { name, repo, account_id }) => {
    const stmt = db.prepare("INSERT INTO projects (name, repo, account_id) VALUES (?, ?, ?)");
    const info = stmt.run(name, repo, account_id);
    return { id: info.lastInsertRowid, name, repo, account_id };
});
electron_1.ipcMain.handle("db:updateProject", (_, { id, name, repo, account_id }) => {
    db.prepare("UPDATE projects SET name = ?, repo = ?, account_id = ? WHERE id = ?").run(name, repo, account_id, id);
    return { id, name, repo, account_id };
});
electron_1.ipcMain.handle("db:deleteProject", (_, id) => {
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    return true;
});
electron_1.ipcMain.handle("db:listSessions", (_, { projectId, from, to }) => {
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
electron_1.ipcMain.handle("db:createSession", (_, { project_id, start_time, notes }) => {
    const stmt = db.prepare("INSERT INTO sessions (project_id, start_time, notes) VALUES (?, ?, ?)");
    const info = stmt.run(project_id, start_time, notes || "");
    return { id: info.lastInsertRowid, project_id, start_time, notes };
});
electron_1.ipcMain.handle("db:stopSession", (_, { id, end_time }) => {
    db.prepare("UPDATE sessions SET end_time = ? WHERE id = ?").run(end_time, id);
    return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
});
electron_1.ipcMain.handle("db:deleteSession", (_, id) => {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    return true;
});
electron_1.ipcMain.handle("db:getActiveSession", () => {
    return (db.prepare("SELECT * FROM sessions WHERE end_time IS NULL LIMIT 1").get() ||
        null);
});
electron_1.ipcMain.handle("github:getUserActivity", async (_, { accountId, repo, since, until }) => {
    const token = safeGetToken(accountId);
    if (!token)
        throw new Error("No se encontró token para esta cuenta.");
    const octokit = new rest_1.Octokit({ auth: token });
    const account = db
        .prepare("SELECT username FROM accounts WHERE id = ?")
        .get(accountId);
    if (!account)
        throw new Error("Cuenta no encontrada.");
    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName)
        throw new Error("El formato del repo debe ser usuario/repo.");
    const sinceIso = new Date(since).toISOString();
    const untilIso = new Date(until).toISOString();
    let prs;
    try {
        prs = await octokit.paginate(octokit.rest.pulls.list, {
            owner,
            repo: repoName,
            state: "all",
            per_page: 100,
        });
    }
    catch (error) {
        if (error.status === 404) {
            throw new Error(`Repositorio "${owner}/${repoName}" no encontrado. Verifica que el formato sea correcto (ej: usuario/repo) y que tengas acceso.`);
        }
        throw new Error(`Error al obtener PRs: ${error.message}`);
    }
    const filteredPrs = prs
        .filter((pr) => pr.user && pr.user.login === account.username)
        .filter((pr) => {
        const created = new Date(pr.created_at).getTime();
        return created >= since && created <= until;
    })
        .map((pr) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        created_at: pr.created_at,
        html_url: pr.html_url,
        account_username: account.username,
    }));
    let commits;
    try {
        commits = await octokit.paginate(octokit.rest.repos.listCommits, {
            owner,
            repo: repoName,
            since: sinceIso,
            until: untilIso,
            per_page: 100,
        });
    }
    catch (error) {
        if (error.status === 404) {
            throw new Error(`Repositorio "${owner}/${repoName}" no encontrado. Verifica que el formato sea correcto (ej: usuario/repo) y que tengas acceso.`);
        }
        throw new Error(`Error al obtener commits: ${error.message}`);
    }
    const filteredCommits = commits
        .filter((c) => c.author && c.author.login === account.username)
        .map((c) => ({
        sha: c.sha,
        message: c.commit.message.split("\n")[0],
        date: c.commit.committer?.date || "",
        html_url: c.html_url,
        account_username: account.username,
    }));
    return { prs: filteredPrs, commits: filteredCommits };
});
electron_1.ipcMain.handle("app:exportCsv", async (_, { filePath, content }) => {
    fs_1.default.writeFileSync(filePath, content, "utf8");
    return true;
});
electron_1.ipcMain.handle("app:showSaveDialog", async (_, { defaultPath }) => {
    const result = await electron_1.dialog.showSaveDialog({
        defaultPath,
        filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    return result;
});
