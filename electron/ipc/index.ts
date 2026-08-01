import type Database from "better-sqlite3";
import { GitHubService } from "../services/github";
import { registerAccountHandlers } from "./accounts";
import { registerProjectHandlers } from "./projects";
import { registerSessionHandlers } from "./sessions";
import { registerGitHubHandlers } from "./github";
import { registerAiHandlers } from "./ai";
import { registerAppHandlers } from "./app";

export function registerIpcHandlers(db: Database.Database): GitHubService {
  const github = new GitHubService(db);

  registerAccountHandlers(db, (accountId) => github.invalidateAccount(accountId));
  registerProjectHandlers(db);
  registerSessionHandlers(db);
  registerGitHubHandlers(github);
  registerAiHandlers(github);
  registerAppHandlers();

  return github;
}
