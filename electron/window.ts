import { app, BrowserWindow } from "electron";
import path from "path";

const isDev = !app.isPackaged;
const PORT = 5170;

let mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function createWindow(onDidFinishLoad?: () => void): void {
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

  if (onDidFinishLoad) {
    mainWindow.webContents.on("did-finish-load", onDidFinishLoad);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
