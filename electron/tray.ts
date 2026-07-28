import { Tray, Menu, BrowserWindow, nativeImage } from "electron";
import zlib from "zlib";
import db from "./db/connection";
import { sessionQueries } from "./db/queries";

let tray: Tray | null = null;
let timerInterval: NodeJS.Timeout | null = null;
let mainWindow: BrowserWindow | null = null;

function generateClockIcon(): Buffer {
  const size = 16;
  const rows: number[][][] = [];

  for (let y = 0; y < size; y++) {
    const row: number[][] = [];
    for (let x = 0; x < size; x++) {
      const cx = x - 7.5;
      const cy = y - 7.5;
      const dist = Math.sqrt(cx * cx + cy * cy);

      let r = 0, g = 0, b = 0, a = 0;

      if (dist <= 7 && dist >= 5.5) {
        r = g = b = 255;
        a = 255;
      } else if (dist < 5.5) {
        if ((y === 4 || y === 5) && x >= 7 && x <= 10) {
          r = g = b = 255; a = 255;
        } else if ((x === 7 || x === 8) && y >= 3 && y <= 7) {
          r = g = b = 255; a = 255;
        } else if (y === 8 && x === 7) {
          r = g = b = 255; a = 255;
        } else if (dist < 0.8) {
          r = g = b = 255; a = 255;
        }
      }
      row.push([r, g, b, a]);
    }
    rows.push(row);
  }

  function crc32(buf: Buffer): number {
    let c: number;
    const table: number[] = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeData = Buffer.concat([Buffer.from(type), data]);
    const crcVal = Buffer.alloc(4);
    crcVal.writeUInt32BE(crc32(typeData));
    return Buffer.concat([len, typeData, crcVal]);
  }

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;

  const raw: number[] = [];
  for (const row of rows) {
    raw.push(0);
    for (const [r, g, b, a] of row) {
      raw.push(r, g, b, a);
    }
  }

  const compressed = zlib.deflateSync(Buffer.from(raw));

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdrData),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getElapsedMs(session: {
  start_time: number;
  paused_at: number | null;
  total_paused_ms: number;
}): number {
  if (session.paused_at) {
    return session.paused_at - session.start_time - session.total_paused_ms;
  }
  return Date.now() - session.start_time - session.total_paused_ms;
}

function buildMenu(session: any): Menu {
  const isPaused = session && session.paused_at !== null;
  const items: Electron.MenuItemConstructorOptions[] = [];

  if (session) {
    const elapsed = formatElapsed(getElapsedMs(session));
    items.push({ label: `⏱ ${elapsed}`, enabled: false });
    items.push({ type: "separator" });

    if (isPaused) {
      items.push({ label: "▶ Reanudar", click: () => resumeSession() });
    } else {
      items.push({ label: "⏸ Pausar", click: () => pauseSession() });
    }
    items.push({ label: "⏹ Detener", click: () => stopSession() });
    items.push({ type: "separator" });
  }

  items.push({
    label: "Mostrar ventana",
    click: () => {
      mainWindow?.show();
      mainWindow?.focus();
    },
  });
  items.push({ type: "separator" });
  items.push({ label: "Salir", click: () => require("electron").app.quit() });

  return Menu.buildFromTemplate(items);
}

function updateTray(): void {
  if (!tray) return;

  const session = sessionQueries.getActive(db) as any;
  const isPaused = session && session.paused_at !== null;

  if (session) {
    const elapsed = formatElapsed(getElapsedMs(session));
    tray.setTitle(isPaused ? `⏸ ${elapsed}` : `▶ ${elapsed}`);
  } else {
    tray.setTitle("");
  }

  tray.setContextMenu(buildMenu(session));
}

function pauseSession(): void {
  const session = sessionQueries.getActiveUnpaused(db);
  if (session) {
    sessionQueries.markIdlePaused(db, { id: session.id, paused_at: Date.now() });
    updateTray();
    mainWindow?.webContents.send("session:auto-paused");
  }
}

function resumeSession(): void {
  const session = sessionQueries.getActive(db) as any;
  if (session?.paused_at) {
    const pausedDuration = Date.now() - session.paused_at;
    sessionQueries.resume(db, { id: session.id, pausedDuration });
    updateTray();
    mainWindow?.webContents.send("session:auto-paused");
  }
}

function stopSession(): void {
  const session = sessionQueries.getActive(db) as any;
  if (session) {
    const endTime = session.paused_at ?? Date.now();
    sessionQueries.stop(db, { id: session.id, end_time: endTime });
    updateTray();
    mainWindow?.webContents.send("session:auto-paused");
  }
}

export function initTray(win: BrowserWindow): void {
  mainWindow = win;

  if (tray) return;

  const iconBuffer = generateClockIcon();
  const icon = nativeImage.createFromBuffer(iconBuffer);
  tray = new Tray(icon);
  tray.setToolTip("Work Tracker");

  updateTray();

  timerInterval = setInterval(updateTray, 1000);

  win.on("closed", () => {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    tray = null;
    mainWindow = null;
  });
}

export function notifySessionStarted(): void { updateTray(); }
export function notifySessionStopped(): void { updateTray(); }
export function notifySessionPaused(): void { updateTray(); }
export function notifySessionResumed(): void { updateTray(); }
