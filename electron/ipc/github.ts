import { ipcMain } from "electron";
import type { GitHubService } from "../services/github";
import { validateGitHubToken } from "../services/github";
import { IPC } from "../shared/contract";
import {
  assertId,
  assertRepo,
  assertString,
  assertTimestamp,
  optionalBoolean,
} from "./validate";

export function registerGitHubHandlers(github: GitHubService): void {
  ipcMain.handle(IPC.github.getUserActivity, (_, payload) => {
    const { accountId, repo, since, until, forceRefresh } = payload ?? {};
    assertId(accountId, "accountId");
    assertRepo(repo, "repo");
    assertTimestamp(since, "since");
    assertTimestamp(until, "until");
    optionalBoolean(forceRefresh, "forceRefresh");
    return github.getUserActivity({
      accountId,
      repo,
      since,
      until,
      forceRefresh,
    });
  });

  ipcMain.handle(IPC.github.validateToken, (_, payload) => {
    const { token } = payload ?? {};
    assertString(token, "token");
    return validateGitHubToken(token);
  });

  ipcMain.handle(IPC.github.getCommitDiffs, (_, payload) => {
    const { accountId, repo, since, until } = payload ?? {};
    assertId(accountId, "accountId");
    assertRepo(repo, "repo");
    assertTimestamp(since, "since");
    assertTimestamp(until, "until");
    return github.getCommitDiffs({ accountId, repo, since, until });
  });

  ipcMain.handle(IPC.github.getBranches, (_, payload) => {
    const { accountId, repo } = payload ?? {};
    assertId(accountId, "accountId");
    assertRepo(repo, "repo");
    return github.getBranches(accountId, repo);
  });

  ipcMain.handle(IPC.github.getBranchChanges, (_, payload) => {
    const { accountId, repo, branch } = payload ?? {};
    assertId(accountId, "accountId");
    assertRepo(repo, "repo");
    assertString(branch, "branch");
    return github.getBranchChanges(accountId, repo, branch);
  });
}
