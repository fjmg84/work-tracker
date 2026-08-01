import { dialog, ipcMain } from "electron";
import fs from "fs";
import { IPC } from "../shared/contract";
import { assertString } from "./validate";

export function registerAppHandlers(): void {
  ipcMain.handle(IPC.app.exportCsv, (_, payload) => {
    const { filePath, content } = payload ?? {};
    assertString(filePath, "filePath");
    assertString(content, "content");
    fs.writeFileSync(filePath, content, "utf8");
    return true;
  });

  ipcMain.handle(IPC.app.showSaveDialog, (_, payload) => {
    const { defaultPath } = payload ?? {};
    assertString(defaultPath, "defaultPath");
    return dialog.showSaveDialog({
      defaultPath,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
  });
}
