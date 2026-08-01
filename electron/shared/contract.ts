// Contrato compartido entre main, preload y renderer.
// IMPORTANTE: este archivo no debe importar nada de electron/node — lo carga
// también el bundle del renderer (vite).

// ============================================================
// Tipos de dominio
// ============================================================

export interface Account {
  id: number;
  label: string;
  username: string;
}

export interface AccountWithProject extends Account {
  account_id?: number;
  account_label?: string;
  account_username?: string;
}

export interface Project {
  id: number;
  name: string;
  repo: string;
  account_id: number;
  account_label: string;
  account_username: string;
}

export interface ProjectInput {
  id?: number;
  name: string;
  repo: string;
  account_id: number;
}

export interface Session {
  id: number;
  project_id: number;
  start_time: number;
  end_time: number | null;
  notes: string;
  paused_at: number | null;
  total_paused_ms: number;
}

export interface SessionInput {
  project_id: number;
  start_time: number;
  notes?: string;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  html_url: string;
  account_username: string;
  projectName?: string;
  accountLabel?: string;
  error?: boolean;
  message?: string;
  commits?: Commit[];
}

export interface Commit {
  sha: string;
  message: string;
  date: string;
  html_url: string;
  account_username: string;
  projectName?: string;
  accountLabel?: string;
}

export interface GitHubActivity {
  prs: (PullRequest | GitHubActivityError)[];
}

export interface GitHubActivityError {
  error: true;
  projectName: string;
  message: string;
}

export type SessionFilter = {
  projectId?: number;
  from?: number;
  to?: number;
};

// ============================================================
// GitHub / AI
// ============================================================

export interface CommitInfo {
  sha: string;
  message: string;
  date: string;
}

export interface FileDiff {
  filename: string;
  patch: string;
  additions: number;
  deletions: number;
}

export interface BranchInfo {
  name: string;
  lastCommitDate: string;
}

export interface BranchChanges {
  branch: string;
  commits: CommitInfo[];
  diffs: FileDiff[];
}

export type Language = "es" | "en";

export interface AiProviderConfig {
  apiKey: string;
  model: string;
}

// ============================================================
// Payloads IPC
// ============================================================

export interface AccountCreateInput {
  label: string;
  username: string;
  token: string;
}

export interface AccountUpdateInput {
  id: number;
  label: string;
  username: string;
  token?: string;
}

export interface UserActivityParams {
  accountId: number;
  repo: string;
  since: number;
  until: number;
  forceRefresh?: boolean;
}

export interface PrDescriptionRequest {
  accountId: number;
  repo: string;
  since: number;
  until: number;
  notes: string;
  language: Language;
}

export interface PrDescriptionFromPrRequest {
  accountId: number;
  repo: string;
  prNumber: number;
  notes: string;
  language: Language;
}

export interface PrDescriptionFromBranchRequest {
  accountId: number;
  repo: string;
  branch: string;
  notes: string;
  language: Language;
}

export interface PrDescriptionResponse {
  description: string;
}

export interface ElectronSaveDialogResult {
  canceled: boolean;
  filePath?: string;
}

// ============================================================
// Canales IPC
// ============================================================

export const IPC = {
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
    closeStaleSessions: "db:closeStaleSessions",
  },
  github: {
    getUserActivity: "github:getUserActivity",
    validateToken: "github:validateToken",
    getCommitDiffs: "github:getCommitDiffs",
    getBranches: "github:getBranches",
    getBranchChanges: "github:getBranchChanges",
  },
  ai: {
    generatePrDescription: "ai:generatePrDescription",
    generatePrDescriptionFromPr: "ai:generatePrDescriptionFromPr",
    generatePrDescriptionFromBranch: "ai:generatePrDescriptionFromBranch",
    getConfig: "ai:getConfig",
    saveConfig: "ai:saveConfig",
    testConnection: "ai:testConnection",
  },
  app: {
    exportCsv: "app:exportCsv",
    showSaveDialog: "app:showSaveDialog",
  },
  events: {
    sessionAutoPaused: "session:auto-paused",
    staleDetected: "sessions:stale-detected",
  },
} as const;

// ============================================================
// API expuesta por el preload (window.api)
// ============================================================

export interface DbApi {
  listAccounts: () => Promise<Account[]>;
  createAccount: (data: AccountCreateInput) => Promise<Account>;
  updateAccount: (data: AccountUpdateInput) => Promise<Account>;
  deleteAccount: (id: number) => Promise<boolean>;

  listProjects: () => Promise<Project[]>;
  createProject: (data: ProjectInput) => Promise<Project>;
  updateProject: (data: ProjectInput) => Promise<Project>;
  deleteProject: (id: number) => Promise<boolean>;

  listSessions: (filters: SessionFilter) => Promise<Session[]>;
  createSession: (data: SessionInput) => Promise<Session>;
  stopSession: (data: { id: number; end_time: number }) => Promise<Session>;
  deleteSession: (id: number) => Promise<boolean>;
  getActiveSession: () => Promise<Session | null>;
  pauseSession: (data: { id: number }) => Promise<Session>;
  resumeSession: (data: { id: number }) => Promise<Session>;
  closeStaleSessions: (data: { ids: number[] }) => Promise<boolean>;
}

export interface GitHubApi {
  getUserActivity: (params: UserActivityParams) => Promise<GitHubActivity>;
  validateToken: (data: {
    token: string;
  }) => Promise<{ valid: boolean; username?: string; error?: string }>;
  getCommitDiffs: (
    data: UserActivityParams,
  ) => Promise<{ commits: CommitInfo[]; diffs: FileDiff[] }>;
  getBranches: (data: {
    accountId: number;
    repo: string;
  }) => Promise<BranchInfo[]>;
  getBranchChanges: (data: {
    accountId: number;
    repo: string;
    branch: string;
  }) => Promise<BranchChanges>;
}

export interface AiApi {
  generatePrDescription: (
    data: PrDescriptionRequest,
  ) => Promise<PrDescriptionResponse>;
  generatePrDescriptionFromPr: (
    data: PrDescriptionFromPrRequest,
  ) => Promise<PrDescriptionResponse>;
  generatePrDescriptionFromBranch: (
    data: PrDescriptionFromBranchRequest,
  ) => Promise<PrDescriptionResponse & { branch: string }>;
  getConfig: () => Promise<AiProviderConfig | null>;
  saveConfig: (config: AiProviderConfig) => Promise<boolean>;
  testConnection: () => Promise<{ success: boolean; error?: string }>;
}

export interface AppApi {
  exportCsv: (data: { filePath: string; content: string }) => Promise<boolean>;
  showSaveDialog: (options: {
    defaultPath: string;
  }) => Promise<ElectronSaveDialogResult>;
}

export interface Api {
  db: DbApi;
  github: GitHubApi;
  ai: AiApi;
  app: AppApi;
  on: (channel: string, callback: (...args: any[]) => void) => () => void;
}
