import { Octokit } from "@octokit/rest";
import type Database from "better-sqlite3";
import { accountQueries } from "../db/queries";
import { safeGetToken } from "./tokens";
import { mapWithConcurrency } from "../lib/concurrency";
import type {
  BranchChanges,
  BranchInfo,
  CommitInfo,
  FileDiff,
  GitHubActivity,
  PullRequest,
  UserActivityParams,
} from "../shared/contract";

const ACTIVITY_CACHE_TTL_MS = 5 * 60 * 1000;
const COMMIT_FETCH_CONCURRENCY = 4;

interface RepoContext {
  octokit: Octokit;
  owner: string;
  repoName: string;
  username: string;
}

interface CacheEntry<T> {
  expires: number;
  value: T;
}

export class GitHubService {
  private octokitCache = new Map<number, Octokit>();
  private activityCache = new Map<string, CacheEntry<GitHubActivity>>();

  constructor(private db: Database.Database) {}

  // Llamar cuando cambia o se elimina el token de una cuenta.
  invalidateAccount(accountId: number): void {
    this.octokitCache.delete(accountId);
  }

  private getContext(accountId: number, repo: string): RepoContext {
    const account = accountQueries.getById(this.db, accountId);
    if (!account) throw new Error("Cuenta no encontrada.");

    let octokit = this.octokitCache.get(accountId);
    if (!octokit) {
      const token = safeGetToken(accountId);
      if (!token) throw new Error("No se encontró token para esta cuenta.");
      octokit = new Octokit({ auth: token });
      this.octokitCache.set(accountId, octokit);
    }

    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName) {
      throw new Error("El formato del repo debe ser usuario/repo.");
    }

    return { octokit, owner, repoName, username: account.username };
  }

  async getUserActivity({
    accountId,
    repo,
    since,
    until,
    forceRefresh,
  }: UserActivityParams): Promise<GitHubActivity> {
    const cacheKey = `${accountId}|${repo}|${since}|${until}`;
    if (!forceRefresh) {
      const cached = this.activityCache.get(cacheKey);
      if (cached && cached.expires > Date.now()) return cached.value;
    }

    const ctx = this.getContext(accountId, repo);
    const prs = await this.listUserPrs(ctx, since, until);
    const prsWithCommits = await mapWithConcurrency(
      prs,
      COMMIT_FETCH_CONCURRENCY,
      async (pr) => ({
        ...pr,
        commits: await this.listPrCommits(ctx, pr.number),
      }),
    );

    const value: GitHubActivity = { prs: prsWithCommits };
    this.activityCache.set(cacheKey, {
      expires: Date.now() + ACTIVITY_CACHE_TTL_MS,
      value,
    });
    return value;
  }

  // Search API: filtra en servidor por autor y rango de fechas en vez de
  // descargar todos los PRs del repo. Fallback a pulls.list si el search
  // no está disponible (rate limit o validación).
  private async listUserPrs(
    ctx: RepoContext,
    since: number,
    until: number,
  ): Promise<PullRequest[]> {
    const { octokit, owner, repoName, username } = ctx;
    try {
      const q = `repo:${owner}/${repoName} is:pr author:${username} created:${new Date(since).toISOString()}..${new Date(until).toISOString()}`;
      const items = await octokit.paginate(
        octokit.rest.search.issuesAndPullRequests,
        { q, per_page: 100 },
      );
      return items.map((item) => ({
        id: item.id,
        number: item.number,
        title: item.title,
        state: item.state,
        created_at: item.created_at,
        updated_at: item.updated_at,
        merged_at: item.pull_request?.merged_at ?? null,
        html_url: item.html_url,
        account_username: username,
      }));
    } catch (error: any) {
      if (error.status === 403 || error.status === 422) {
        return this.listUserPrsLegacy(ctx, since, until);
      }
      if (error.status === 404) {
        throw new Error(
          `Repositorio "${owner}/${repoName}" no encontrado. Verifica que el formato sea correcto (ej: usuario/repo) y que tengas acceso.`,
        );
      }
      throw new Error(`Error al obtener PRs: ${error.message}`);
    }
  }

  private async listUserPrsLegacy(
    ctx: RepoContext,
    since: number,
    until: number,
  ): Promise<PullRequest[]> {
    const { octokit, owner, repoName, username } = ctx;
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

    return prs
      .filter((pr) => pr.user && pr.user.login === username)
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
        updated_at: pr.updated_at,
        merged_at: pr.merged_at ?? null,
        html_url: pr.html_url,
        account_username: username,
      }));
  }

  private async listPrCommits(
    ctx: RepoContext,
    prNumber: number,
  ): Promise<PullRequest["commits"]> {
    const { octokit, owner, repoName, username } = ctx;
    try {
      const prCommits = await octokit.paginate(octokit.rest.pulls.listCommits, {
        owner,
        repo: repoName,
        pull_number: prNumber,
        per_page: 100,
      });
      return prCommits
        .filter((c) => c.author && c.author.login === username)
        .map((c) => ({
          sha: c.sha,
          message: c.commit.message.split("\n")[0],
          date: c.commit.committer?.date || "",
          html_url: c.html_url,
          account_username: username,
        }));
    } catch (error: any) {
      console.error(`Error fetching commits for PR #${prNumber}:`, error);
      return [];
    }
  }

  async getCommitDiffs({
    accountId,
    repo,
    since,
    until,
  }: UserActivityParams): Promise<{
    commits: CommitInfo[];
    diffs: FileDiff[];
  }> {
    const ctx = this.getContext(accountId, repo);
    const { octokit, owner, repoName, username } = ctx;

    let repoCommits: any[];
    try {
      repoCommits = await octokit.paginate(octokit.rest.repos.listCommits, {
        owner,
        repo: repoName,
        since: new Date(since).toISOString(),
        until: new Date(until).toISOString(),
        per_page: 100,
      });
    } catch (error: any) {
      throw new Error(`Error al obtener commits: ${error.message}`);
    }

    const userCommits = repoCommits.filter(
      (c) => c.author && c.author.login === username,
    );

    const commits: CommitInfo[] = userCommits.map((c) => ({
      sha: c.sha,
      message: c.commit.message.split("\n")[0],
      date: c.commit.committer?.date || "",
    }));

    const perCommitDiffs = await mapWithConcurrency(
      userCommits,
      COMMIT_FETCH_CONCURRENCY,
      async (c): Promise<FileDiff[]> => {
        try {
          const commitData = await octokit.rest.repos.getCommit({
            owner,
            repo: repoName,
            ref: c.sha,
          });
          return (commitData.data.files || []).map((file) => ({
            filename: file.filename,
            patch: file.patch || "",
            additions: file.additions,
            deletions: file.deletions,
          }));
        } catch (error: any) {
          console.error(
            `Error fetching diff for commit ${c.sha.substring(0, 7)}:`,
            error,
          );
          return [];
        }
      },
    );

    return { commits, diffs: perCommitDiffs.flat() };
  }

  async getPrCommitsAndDiffs(
    accountId: number,
    repo: string,
    prNumber: number,
  ): Promise<{ commits: CommitInfo[]; diffs: FileDiff[] }> {
    const ctx = this.getContext(accountId, repo);
    const { octokit, owner, repoName, username } = ctx;

    let prCommits: any[];
    try {
      prCommits = await octokit.paginate(octokit.rest.pulls.listCommits, {
        owner,
        repo: repoName,
        pull_number: prNumber,
        per_page: 100,
      });
    } catch (error: any) {
      throw new Error(
        `Error al obtener commits del PR #${prNumber}: ${error.message}`,
      );
    }

    const commits: CommitInfo[] = prCommits
      .filter((c) => c.author && c.author.login === username)
      .map((c) => ({
        sha: c.sha,
        message: c.commit.message.split("\n")[0],
        date: c.commit.committer?.date || "",
      }));

    let diffs: FileDiff[] = [];
    try {
      const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
        owner,
        repo: repoName,
        pull_number: prNumber,
        per_page: 100,
      });
      diffs = files.map((file) => ({
        filename: file.filename,
        patch: file.patch || "",
        additions: file.additions,
        deletions: file.deletions,
      }));
    } catch (error: any) {
      console.error(`Error fetching diffs for PR #${prNumber}:`, error);
    }

    return { commits, diffs };
  }

  private async getDefaultBranch(ctx: RepoContext): Promise<string> {
    const { octokit, owner, repoName } = ctx;
    const { data } = await octokit.rest.repos.get({ owner, repo: repoName });
    return data.default_branch;
  }

  async getBranches(accountId: number, repo: string): Promise<BranchInfo[]> {
    const ctx = this.getContext(accountId, repo);
    const { octokit, owner, repoName } = ctx;

    const defaultBranch = await this.getDefaultBranch(ctx);
    const { data: branches } = await octokit.rest.repos.listBranches({
      owner,
      repo: repoName,
      per_page: 100,
    });

    return branches
      .filter((b) => b.name !== defaultBranch)
      .map((b) => ({
        name: b.name,
        lastCommitDate: (b.commit as any).commit?.committer?.date || "",
      }))
      .sort((a, b) => b.lastCommitDate.localeCompare(a.lastCommitDate));
  }

  async getBranchChanges(
    accountId: number,
    repo: string,
    branchName: string,
  ): Promise<BranchChanges> {
    const ctx = this.getContext(accountId, repo);
    const { octokit, owner, repoName, username } = ctx;

    const defaultBranch = await this.getDefaultBranch(ctx);
    const { data: compare } = await octokit.rest.repos.compareCommits({
      owner,
      repo: repoName,
      base: defaultBranch,
      head: branchName,
    });

    const commits: CommitInfo[] = (compare.commits || [])
      .filter((c) => c.author && c.author.login === username)
      .map((c) => ({
        sha: c.sha,
        message: c.commit.message.split("\n")[0],
        date: c.commit.committer?.date || "",
      }));

    const diffs: FileDiff[] = (compare.files || []).map((f) => ({
      filename: f.filename,
      patch: f.patch || "",
      additions: f.additions,
      deletions: f.deletions,
    }));

    return { branch: branchName, commits, diffs };
  }
}

export async function validateGitHubToken(
  token: string,
): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.users.getAuthenticated();
    return { valid: true, username: data.login };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}
