import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain, Menu, screen } from "electron";
import { HookServer } from "../server/hook-server.js";
import {
  type CursorOffset,
  type HookServerStatus,
  ipcChannels,
  type ModelFile,
  resolveHookPort,
} from "../shared/protocol.js";
import type { CompanionSignal } from "../shared/reaction.js";
import { isMemberId, type MemberId, memberIds, roster } from "../shared/team.js";
import { type CompanionSettings, loadSettings, saveSettings } from "./settings-store.js";

const overlaySize = { width: 340, height: 440 };
const overlayMargin = 24;
const cursorPollMs = 50;

const rendererDir = join(import.meta.dirname, "../../renderer");
const preloadPath = join(import.meta.dirname, "preload.cjs");

let settings: CompanionSettings;
let settingsPath: string;
let overlayWindow: BrowserWindow | null = null;
let officeWindow: BrowserWindow | null = null;
let serverStatus: HookServerStatus;
let isQuitting = false;

function rendererWindows(): BrowserWindow[] {
  return [overlayWindow, officeWindow].filter(
    (window): window is BrowserWindow => window !== null && !window.isDestroyed(),
  );
}

function broadcast(channel: string, value?: unknown): void {
  for (const window of rendererWindows()) {
    window.webContents.send(channel, value);
  }
}

async function updateSettings(patch: Partial<CompanionSettings>): Promise<void> {
  settings = { ...settings, ...patch };
  await saveSettings(settingsPath, settings);
}

async function readModel(modelPath: string): Promise<ModelFile> {
  const buffer = await readFile(modelPath);
  // Copy into a standalone ArrayBuffer: Node buffers can be views into a larger pool.
  const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  return { name: basename(modelPath), bytes };
}

async function pickModelFile(parent: BrowserWindow | null, memberId: MemberId): Promise<string | null> {
  const options: Electron.OpenDialogOptions = {
    title: `Pilih model .vrm untuk ${roster[memberId].displayName}`,
    filters: [{ name: "VRM model", extensions: ["vrm"] }],
    properties: ["openFile"],
  };
  const result = parent === null ? await dialog.showOpenDialog(options) : await dialog.showOpenDialog(parent, options);
  const [selected] = result.filePaths;
  if (result.canceled || selected === undefined) {
    return null;
  }
  await updateSettings({ modelPaths: { ...settings.modelPaths, [memberId]: selected } });
  return selected;
}

const webPreferences: Electron.WebPreferences = {
  preload: preloadPath,
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
};

function createOverlayWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();
  const window = new BrowserWindow({
    ...overlaySize,
    x: workArea.x + workArea.width - overlaySize.width - overlayMargin,
    y: workArea.y + workArea.height - overlaySize.height - overlayMargin,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: settings.alwaysOnTop,
    backgroundColor: "#00000000",
    title: "Xenovia",
    webPreferences,
  });
  window.loadFile(join(rendererDir, "overlay/index.html")).catch((error: unknown) => {
    console.error("[main] failed to load overlay page", error);
  });
  window.on("closed", () => {
    overlayWindow = null;
    if (!isQuitting) {
      app.quit();
    }
  });
  return window;
}

function openOfficeWindow(): void {
  if (officeWindow !== null && !officeWindow.isDestroyed()) {
    officeWindow.show();
    officeWindow.focus();
    return;
  }
  officeWindow = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 480,
    minHeight: 360,
    title: "Kantor Xenovia",
    backgroundColor: "#e9e4da",
    autoHideMenuBar: true,
    webPreferences,
  });
  officeWindow.loadFile(join(rendererDir, "office/index.html")).catch((error: unknown) => {
    console.error("[main] failed to load office page", error);
  });
  officeWindow.on("closed", () => {
    officeWindow = null;
    if (!isQuitting) {
      updateSettings({ officeOpen: false }).catch((error: unknown) => {
        console.error("[main] failed to save settings", error);
      });
    }
  });
  updateSettings({ officeOpen: true }).catch((error: unknown) => {
    console.error("[main] failed to save settings", error);
  });
}

function showMenu(window: BrowserWindow): void {
  const officeIsOpen = officeWindow !== null && !officeWindow.isDestroyed();
  const menu = Menu.buildFromTemplate([
    {
      label: "Pilih model .vrm",
      submenu: memberIds.map((memberId) => ({
        label: `${roster[memberId].displayName} (${roster[memberId].role})${settings.modelPaths[memberId] === undefined ? "" : "  \u2713"}`,
        click: () => {
          pickModelFile(window, memberId)
            .then((selected) => {
              if (selected !== null) {
                broadcast(ipcChannels.modelChanged, memberId);
              }
            })
            .catch((error: unknown) => console.error("[main] model pick failed", error));
        },
      })),
    },
    {
      label: officeIsOpen ? "Tutup kantor" : "Buka kantor",
      click: () => {
        if (officeIsOpen) {
          officeWindow?.close();
        } else {
          openOfficeWindow();
        }
      },
    },
    {
      label: "Overlay selalu di atas",
      type: "checkbox",
      checked: settings.alwaysOnTop,
      click: (item) => {
        overlayWindow?.setAlwaysOnTop(item.checked);
        updateSettings({ alwaysOnTop: item.checked }).catch((error: unknown) => {
          console.error("[main] failed to save settings", error);
        });
      },
    },
    { type: "separator" },
    { label: "Keluar", click: () => app.quit() },
  ]);
  menu.popup({ window });
}

function startCursorTracking(): NodeJS.Timeout {
  let last: CursorOffset | null = null;
  return setInterval(() => {
    if (overlayWindow === null || overlayWindow.isDestroyed() || !overlayWindow.isVisible()) {
      return;
    }
    const cursor = screen.getCursorScreenPoint();
    const bounds = overlayWindow.getBounds();
    // Anchor at roughly where the face sits in the close-up framing.
    const offset: CursorOffset = {
      dx: cursor.x - (bounds.x + bounds.width / 2),
      dy: cursor.y - (bounds.y + bounds.height * 0.3),
    };
    if (last !== null && last.dx === offset.dx && last.dy === offset.dy) {
      return;
    }
    last = offset;
    overlayWindow.webContents.send(ipcChannels.cursor, offset);
  }, cursorPollMs);
}

function registerIpc(): void {
  ipcMain.handle(ipcChannels.loadSavedModel, async (_event, memberId: unknown) => {
    if (!isMemberId(memberId)) {
      throw new Error(`unknown member: ${String(memberId)}`);
    }
    const modelPath = settings.modelPaths[memberId];
    return modelPath === undefined ? null : readModel(modelPath);
  });
  ipcMain.handle(ipcChannels.pickModel, async (event, memberId: unknown) => {
    if (!isMemberId(memberId)) {
      throw new Error(`unknown member: ${String(memberId)}`);
    }
    const selected = await pickModelFile(BrowserWindow.fromWebContents(event.sender), memberId);
    if (selected === null) {
      return null;
    }
    for (const window of rendererWindows()) {
      if (window.webContents !== event.sender) {
        window.webContents.send(ipcChannels.modelChanged, memberId);
      }
    }
    return readModel(selected);
  });
  ipcMain.handle(ipcChannels.getServerStatus, () => serverStatus);
  ipcMain.on(ipcChannels.openMenu, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window !== null) {
      showMenu(window);
    }
  });
}

async function startHookServer(): Promise<HookServer> {
  const port = resolveHookPort(process.env);
  const server = new HookServer({ host: "127.0.0.1", port });
  server.on("signal", (signal: CompanionSignal) => broadcast(ipcChannels.signal, signal));
  try {
    const boundPort = await server.listen();
    serverStatus = { state: "listening", port: boundPort };
  } catch (error) {
    const message =
      (error as NodeJS.ErrnoException).code === "EADDRINUSE"
        ? `Port ${port} sudah dipakai aplikasi lain. Hook Claude Code tidak tersambung.`
        : `Server hook gagal jalan: ${(error as Error).message}`;
    console.error(`[main] ${message}`, error);
    serverStatus = { state: "error", port, message };
  }
  broadcast(ipcChannels.serverStatus, serverStatus);
  return server;
}

async function bootstrap(): Promise<void> {
  settingsPath = join(app.getPath("userData"), "companion-settings.json");
  settings = await loadSettings(settingsPath);
  registerIpc();
  const server = await startHookServer();
  overlayWindow = createOverlayWindow();
  if (settings.officeOpen) {
    openOfficeWindow();
  }
  const cursorTimer = startCursorTracking();

  app.on("before-quit", () => {
    isQuitting = true;
    clearInterval(cursorTimer);
    server.close().catch((error: unknown) => console.error("[main] failed to close hook server", error));
  });
}

// A second instance would fail to bind the hook port, so focus the first one instead.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    overlayWindow?.show();
  });
  app.on("window-all-closed", () => app.quit());
  app
    .whenReady()
    .then(bootstrap)
    .catch((error: unknown) => {
      console.error("[main] startup failed", error);
      dialog.showErrorBox("Companion gagal jalan", (error as Error).message);
      app.exit(1);
    });
}
