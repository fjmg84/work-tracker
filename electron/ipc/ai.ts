import { ipcMain } from "electron";
import type { GitHubService } from "../services/github";
import {
  generatePrDescription,
  loadAiConfig,
  saveAiConfig,
  testAiConnection,
} from "../ai";
import { IPC } from "../shared/contract";
import {
  assertId,
  assertLanguage,
  assertRepo,
  assertString,
  assertTimestamp,
  optionalString,
} from "./validate";

export function registerAiHandlers(github: GitHubService): void {
  ipcMain.handle(IPC.ai.generatePrDescription, async (_, payload) => {
    const { accountId, repo, since, until, notes, language } = payload ?? {};
    assertId(accountId, "accountId");
    assertRepo(repo, "repo");
    assertTimestamp(since, "since");
    assertTimestamp(until, "until");
    optionalString(notes, "notes");
    assertLanguage(language, "language");

    const { commits, diffs } = await github.getCommitDiffs({
      accountId,
      repo,
      since,
      until,
    });
    if (commits.length === 0) {
      throw new Error("No se encontraron commits en el período seleccionado.");
    }
    const description = await generatePrDescription({
      commits,
      diffs,
      notes: notes ?? "",
      language,
    });
    return { description };
  });

  ipcMain.handle(IPC.ai.generatePrDescriptionFromPr, async (_, payload) => {
    const { accountId, repo, prNumber, notes, language } = payload ?? {};
    assertId(accountId, "accountId");
    assertRepo(repo, "repo");
    assertId(prNumber, "prNumber");
    optionalString(notes, "notes");
    assertLanguage(language, "language");

    const { commits, diffs } = await github.getPrCommitsAndDiffs(
      accountId,
      repo,
      prNumber,
    );
    if (commits.length === 0) {
      throw new Error("No se encontraron commits en el PR seleccionado.");
    }
    const description = await generatePrDescription({
      commits,
      diffs,
      notes: notes ?? "",
      language,
    });
    return { description };
  });

  ipcMain.handle(IPC.ai.generatePrDescriptionFromBranch, async (_, payload) => {
    const { accountId, repo, branch, notes, language } = payload ?? {};
    assertId(accountId, "accountId");
    assertRepo(repo, "repo");
    assertString(branch, "branch");
    optionalString(notes, "notes");
    assertLanguage(language, "language");

    const { commits, diffs } = await github.getBranchChanges(
      accountId,
      repo,
      branch,
    );
    if (commits.length === 0) {
      throw new Error("No se encontraron commits en la rama seleccionada.");
    }
    const description = await generatePrDescription({
      commits,
      diffs,
      notes: notes ?? "",
      language,
    });
    return { description, branch };
  });

  ipcMain.handle(IPC.ai.getConfig, () => loadAiConfig());

  ipcMain.handle(IPC.ai.saveConfig, (_, config) => {
    const { apiKey, model } = config ?? {};
    assertString(apiKey, "apiKey");
    assertString(model, "model");
    saveAiConfig({ apiKey, model });
    return true;
  });

  ipcMain.handle(IPC.ai.testConnection, () => testAiConnection());
}
