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

export interface ReportData {
  month: number;
  year: number;
  sessions: Session[];
  projects: Project[];
  prs: PullRequest[];
  commits?: Commit[];
}

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
}

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
}

export interface AppApi {
  exportCsv: (data: { filePath: string; content: string }) => Promise<boolean>;
  showSaveDialog: (options: {
    defaultPath: string;
  }) => Promise<ElectronSaveDialogResult>;
}

export interface ElectronSaveDialogResult {
  canceled: boolean;
  filePath?: string;
}

export interface Api {
  db: DbApi;
  github: GitHubApi;
  ai: AiApi;
  app: AppApi;
  on: (channel: string, callback: (...args: any[]) => void) => () => void;
}

export type Language = "es" | "en";

export interface AiProviderConfig {
  apiKey: string;
  model: string;
}

export interface PrDescriptionRequest {
  accountId: number;
  repo: string;
  since: number;
  until: number;
  notes: string;
  language: Language;
}

export interface PrDescriptionResponse {
  description: string;
}

export interface AiApi {
  generatePrDescription: (data: PrDescriptionRequest) => Promise<PrDescriptionResponse>;
  getConfig: () => Promise<AiProviderConfig | null>;
  saveConfig: (config: AiProviderConfig) => Promise<boolean>;
  testConnection: () => Promise<{ success: boolean; error?: string }>;
}
