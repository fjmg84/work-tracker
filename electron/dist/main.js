"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const rest_1 = require("@octokit/rest");
const fs_1 = __importDefault(require("fs"));
const connection_1 = __importDefault(require("./db/connection"));
const migrations_1 = require("./db/migrations");
const queries_1 = require("./db/queries");
const ai_1 = require("./ai");
const isDev = !electron_1.app.isPackaged;
const PORT = 5170;
(0, migrations_1.initializeSchema)(connection_1.default);
// ============================================================
// Token encryption helpers
// ============================================================
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
// ============================================================
// Window
// ============================================================
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
        mainWindow.loadURL(`http://localhost:${PORT}`);
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, "../../dist/index.html"));
    }
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
// ============================================================
// App lifecycle
// ============================================================
electron_1.app.whenReady().then(() => {
    createWindow();
    // Power monitor: auto-pause active session on suspend
    electron_1.powerMonitor.on("suspend", () => {
        const session = queries_1.sessionQueries.getActiveUnpaused(connection_1.default);
        if (session) {
            queries_1.sessionQueries.markIdlePaused(connection_1.default, { id: session.id, paused_at: Date.now() });
            mainWindow?.webContents.send("session:auto-paused");
        }
    });
    // Idle detection: auto-pause after 10 minutes of inactivity
    setInterval(() => {
        const idleSeconds = electron_1.powerMonitor.getSystemIdleTime();
        if (idleSeconds >= 600) {
            const session = queries_1.sessionQueries.getActiveUnpaused(connection_1.default);
            if (session) {
                queries_1.sessionQueries.markIdlePaused(connection_1.default, { id: session.id, paused_at: Date.now() });
                mainWindow?.webContents.send("session:auto-paused");
            }
        }
    }, 60000);
    // Detect stale sessions (>24h)
    const threshold = Date.now() - 24 * 60 * 60 * 1000;
    const staleSessions = queries_1.sessionQueries.getStaleSessions(connection_1.default, { threshold });
    if (staleSessions.length > 0) {
        mainWindow?.webContents.send("sessions:stale-detected", staleSessions);
    }
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
    if (electron_1.BrowserWindow.getAllWindows().length === 0)
        createWindow();
});
// ============================================================
// IPC: Accounts
// ============================================================
electron_1.ipcMain.handle("db:listAccounts", () => {
    return queries_1.accountQueries.listAll(connection_1.default);
});
electron_1.ipcMain.handle("db:createAccount", (_, { label, username, token }) => {
    const info = queries_1.accountQueries.create(connection_1.default, { label, username });
    const id = Number(info.lastInsertRowid);
    safeStoreToken(id, token);
    return { id, label, username };
});
electron_1.ipcMain.handle("db:updateAccount", (_, { id, label, username, token }) => {
    queries_1.accountQueries.update(connection_1.default, { id, label, username });
    if (token)
        safeStoreToken(id, token);
    return { id, label, username };
});
electron_1.ipcMain.handle("db:deleteAccount", (_, id) => {
    queries_1.accountQueries.delete(connection_1.default, id);
    safeDeleteToken(id);
    return true;
});
// ============================================================
// IPC: Projects
// ============================================================
electron_1.ipcMain.handle("db:listProjects", () => {
    return queries_1.projectQueries.listAll(connection_1.default);
});
electron_1.ipcMain.handle("db:createProject", (_, { name, repo, account_id }) => {
    const info = queries_1.projectQueries.create(connection_1.default, { name, repo, account_id });
    return { id: info.lastInsertRowid, name, repo, account_id };
});
electron_1.ipcMain.handle("db:updateProject", (_, { id, name, repo, account_id }) => {
    queries_1.projectQueries.update(connection_1.default, { id, name, repo, account_id });
    return { id, name, repo, account_id };
});
electron_1.ipcMain.handle("db:deleteProject", (_, id) => {
    queries_1.projectQueries.delete(connection_1.default, id);
    return true;
});
// ============================================================
// IPC: Sessions
// ============================================================
electron_1.ipcMain.handle("db:listSessions", (_, { projectId, from, to }) => {
    return queries_1.sessionQueries.listFiltered(connection_1.default, { projectId, from, to });
});
electron_1.ipcMain.handle("db:createSession", (_, { project_id, start_time, notes }) => {
    const info = queries_1.sessionQueries.create(connection_1.default, { project_id, start_time, notes });
    return queries_1.sessionQueries.getById(connection_1.default, Number(info.lastInsertRowid));
});
electron_1.ipcMain.handle("db:stopSession", (_, { id, end_time }) => {
    return queries_1.sessionQueries.stop(connection_1.default, { id, end_time });
});
electron_1.ipcMain.handle("db:deleteSession", (_, id) => {
    queries_1.sessionQueries.delete(connection_1.default, id);
    return true;
});
electron_1.ipcMain.handle("db:getActiveSession", () => {
    return queries_1.sessionQueries.getActive(connection_1.default);
});
electron_1.ipcMain.handle("db:pauseSession", (_, { id }) => {
    return queries_1.sessionQueries.pause(connection_1.default, { id, paused_at: Date.now() });
});
electron_1.ipcMain.handle("db:resumeSession", (_, { id }) => {
    const session = queries_1.sessionQueries.getById(connection_1.default, id);
    if (session?.paused_at) {
        const pausedDuration = Date.now() - session.paused_at;
        return queries_1.sessionQueries.resume(connection_1.default, { id, pausedDuration });
    }
    return session;
});
electron_1.ipcMain.handle("db:closeStaleSessions", (_, { ids }) => {
    queries_1.sessionQueries.closeStale(connection_1.default, { ids, end_time: Date.now() });
    return true;
});
// ============================================================
// IPC: GitHub
// ============================================================
electron_1.ipcMain.handle("github:getUserActivity", async (_, { accountId, repo, since, until }) => {
    const token = safeGetToken(accountId);
    if (!token)
        throw new Error("No se encontró token para esta cuenta.");
    const octokit = new rest_1.Octokit({ auth: token });
    const account = queries_1.accountQueries.getById(connection_1.default, accountId);
    if (!account)
        throw new Error("Cuenta no encontrada.");
    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName)
        throw new Error("El formato del repo debe ser usuario/repo.");
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
    });
    const prsWithCommits = await Promise.all(filteredPrs.map(async (pr) => {
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
        }
        catch (error) {
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
    }));
    return { prs: prsWithCommits };
});
electron_1.ipcMain.handle("github:validateToken", async (_, { token }) => {
    try {
        const octokit = new rest_1.Octokit({ auth: token });
        const { data } = await octokit.users.getAuthenticated();
        return { valid: true, username: data.login };
    }
    catch (error) {
        return { valid: false, error: error.message };
    }
});
// ============================================================
// IPC: GitHub - Commit Diffs
// ============================================================
async function fetchUserCommitsAndDiffs(accountId, repo, since, until) {
    const token = safeGetToken(accountId);
    if (!token)
        throw new Error("No se encontró token para esta cuenta.");
    const octokit = new rest_1.Octokit({ auth: token });
    const account = queries_1.accountQueries.getById(connection_1.default, accountId);
    if (!account)
        throw new Error("Cuenta no encontrada.");
    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName)
        throw new Error("El formato del repo debe ser usuario/repo.");
    const commits = [];
    const diffs = [];
    let repoCommits;
    try {
        repoCommits = await octokit.paginate(octokit.rest.repos.listCommits, {
            owner,
            repo: repoName,
            since: new Date(since).toISOString(),
            until: new Date(until).toISOString(),
            per_page: 100,
        });
    }
    catch (error) {
        throw new Error(`Error al obtener commits: ${error.message}`);
    }
    const userCommits = repoCommits.filter((c) => c.author && c.author.login === account.username);
    console.log("[PR Desc] repoCommits total:", repoCommits.length, "userCommits:", userCommits.length, "account.username:", account.username);
    if (repoCommits.length > 0 && userCommits.length === 0) {
        console.log("[PR Desc] sample authors:", repoCommits.slice(0, 3).map((c) => ({ login: c.author?.login, name: c.commit.author?.name, email: c.commit.author?.email })));
    }
    for (const c of userCommits) {
        commits.push({
            sha: c.sha,
            message: c.commit.message.split("\n")[0],
            date: c.commit.committer?.date || "",
        });
        try {
            const commitData = await octokit.rest.repos.getCommit({
                owner,
                repo: repoName,
                ref: c.sha,
            });
            for (const file of commitData.data.files || []) {
                diffs.push({
                    filename: file.filename,
                    patch: file.patch || "",
                    additions: file.additions,
                    deletions: file.deletions,
                });
            }
        }
        catch (error) {
            console.error(`Error fetching diff for commit ${c.sha.substring(0, 7)}:`, error);
        }
    }
    return { commits, diffs };
}
async function fetchPrCommitsAndDiffs(accountId, repo, prNumber) {
    const token = safeGetToken(accountId);
    if (!token)
        throw new Error("No se encontró token para esta cuenta.");
    const octokit = new rest_1.Octokit({ auth: token });
    const account = queries_1.accountQueries.getById(connection_1.default, accountId);
    if (!account)
        throw new Error("Cuenta no encontrada.");
    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName)
        throw new Error("El formato del repo debe ser usuario/repo.");
    const commits = [];
    const diffs = [];
    let prCommits;
    try {
        prCommits = await octokit.paginate(octokit.rest.pulls.listCommits, {
            owner,
            repo: repoName,
            pull_number: prNumber,
            per_page: 100,
        });
    }
    catch (error) {
        throw new Error(`Error al obtener commits del PR #${prNumber}: ${error.message}`);
    }
    for (const c of prCommits) {
        if (c.author && c.author.login === account.username) {
            commits.push({
                sha: c.sha,
                message: c.commit.message.split("\n")[0],
                date: c.commit.committer?.date || "",
            });
        }
    }
    try {
        const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
            owner,
            repo: repoName,
            pull_number: prNumber,
            per_page: 100,
        });
        for (const file of files) {
            diffs.push({
                filename: file.filename,
                patch: file.patch || "",
                additions: file.additions,
                deletions: file.deletions,
            });
        }
    }
    catch (error) {
        console.error(`Error fetching diffs for PR #${prNumber}:`, error);
    }
    return { commits, diffs };
}
async function getRepoDefaultBranch(accountId, repo) {
    const token = safeGetToken(accountId);
    if (!token)
        throw new Error("No se encontró token para esta cuenta.");
    const octokit = new rest_1.Octokit({ auth: token });
    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName)
        throw new Error("El formato del repo debe ser usuario/repo.");
    const { data } = await octokit.rest.repos.get({ owner, repo: repoName });
    return data.default_branch;
}
async function fetchBranches(accountId, repo) {
    const token = safeGetToken(accountId);
    if (!token)
        throw new Error("No se encontró token para esta cuenta.");
    const octokit = new rest_1.Octokit({ auth: token });
    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName)
        throw new Error("El formato del repo debe ser usuario/repo.");
    const defaultBranch = await getRepoDefaultBranch(accountId, repo);
    const { data: branches } = await octokit.rest.repos.listBranches({
        owner,
        repo: repoName,
        per_page: 100,
    });
    return branches
        .filter((b) => b.name !== defaultBranch)
        .map((b) => ({
        name: b.name,
        lastCommitDate: b.commit.commit?.committer?.date || "",
    }))
        .sort((a, b) => b.lastCommitDate.localeCompare(a.lastCommitDate));
}
async function fetchBranchChanges(accountId, repo, branchName) {
    const token = safeGetToken(accountId);
    if (!token)
        throw new Error("No se encontró token para esta cuenta.");
    const octokit = new rest_1.Octokit({ auth: token });
    const account = queries_1.accountQueries.getById(connection_1.default, accountId);
    if (!account)
        throw new Error("Cuenta no encontrada.");
    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName)
        throw new Error("El formato del repo debe ser usuario/repo.");
    const defaultBranch = await getRepoDefaultBranch(accountId, repo);
    const { data: compare } = await octokit.rest.repos.compareCommits({
        owner,
        repo: repoName,
        base: defaultBranch,
        head: branchName,
    });
    const commits = (compare.commits || [])
        .filter((c) => c.author && c.author.login === account.username)
        .map((c) => ({
        sha: c.sha,
        message: c.commit.message.split("\n")[0],
        date: c.commit.committer?.date || "",
    }));
    const diffs = (compare.files || []).map((f) => ({
        filename: f.filename,
        patch: f.patch || "",
        additions: f.additions,
        deletions: f.deletions,
    }));
    return { branch: branchName, commits, diffs };
}
electron_1.ipcMain.handle("github:getBranches", async (_, { accountId, repo }) => {
    return fetchBranches(accountId, repo);
});
electron_1.ipcMain.handle("github:getBranchChanges", async (_, { accountId, repo, branch }) => {
    return fetchBranchChanges(accountId, repo, branch);
});
electron_1.ipcMain.handle("github:getCommitDiffs", async (_, { accountId, repo, since, until }) => {
    return fetchUserCommitsAndDiffs(accountId, repo, since, until);
});
// ============================================================
// IPC: AI
// ============================================================
electron_1.ipcMain.handle("ai:generatePrDescription", async (_, { accountId, repo, since, until, notes, language }) => {
    console.log("[PR Desc] accountId:", accountId, "repo:", repo, "since:", since, "until:", until);
    console.log("[PR Desc] since date:", new Date(since).toISOString(), "until date:", new Date(until).toISOString());
    const { commits, diffs } = await fetchUserCommitsAndDiffs(accountId, repo, since, until);
    console.log("[PR Desc] commits found:", commits.length, "diffs found:", diffs.length);
    if (commits.length === 0) {
        throw new Error("No se encontraron commits en el período seleccionado.");
    }
    const description = await (0, ai_1.generatePrDescription)({ commits, diffs, notes, language });
    return { description };
});
electron_1.ipcMain.handle("ai:generatePrDescriptionFromPr", async (_, { accountId, repo, prNumber, notes, language }) => {
    const { commits, diffs } = await fetchPrCommitsAndDiffs(accountId, repo, prNumber);
    if (commits.length === 0) {
        throw new Error("No se encontraron commits en el PR seleccionado.");
    }
    const description = await (0, ai_1.generatePrDescription)({ commits, diffs, notes, language });
    return { description };
});
electron_1.ipcMain.handle("ai:generatePrDescriptionFromBranch", async (_, { accountId, repo, branch, notes, language }) => {
    const { commits, diffs } = await fetchBranchChanges(accountId, repo, branch);
    if (commits.length === 0) {
        throw new Error("No se encontraron commits en la rama seleccionada.");
    }
    const description = await (0, ai_1.generatePrDescription)({ commits, diffs, notes, language });
    return { description, branch };
});
electron_1.ipcMain.handle("ai:getConfig", () => {
    return (0, ai_1.loadAiConfig)();
});
electron_1.ipcMain.handle("ai:saveConfig", (_, config) => {
    (0, ai_1.saveAiConfig)(config);
    return true;
});
electron_1.ipcMain.handle("ai:testConnection", () => {
    return (0, ai_1.testAiConnection)();
});
// ============================================================
// IPC: App
// ============================================================
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
