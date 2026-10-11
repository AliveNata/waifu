import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain, Menu, screen } from "electron";
import { HookServer, permissionPath } from "../server/hook-server.js";
import type { ChatEvent } from "../shared/office-chat.js";
import {
  type CursorOffset,
  type HookServerStatus,
  ipcChannels,
  isConversationMode,
  type ModelFile,
  resolveHookPort,
} from "../shared/protocol.js";
import type { CompanionSignal } from "../shared/reaction.js";
import { isMemberId, type MemberId, memberIds, roster } from "../shared/team.js";
import { findBaseModel, repoRootFrom } from "../tools/base-model.js";
import { findMemberModel } from "../tools/member-models.js";
import { resolveClaudeCommand } from "./chat/claude-command.js";
import { OfficeChat } from "./chat/office-chat.js";
import { hookResponse, PermissionGate } from "./chat/permission-gate.js";
import { type CompanionSettings, loadSettings, saveSettings } from "./settings-store.js";

const overlaySize = { width: 340, height: 440 };
const teamOverlaySize = { width: 360, height: 480 };
const overlayMargin = 24;
const cursorPollMs = 50;

const rendererDir = join(import.meta.dirname, "../../renderer");
const preloadPath = join(import.meta.dirname, "preload.cjs");

let settings: CompanionSettings;
let settingsPath: string;
let overlayWindow: BrowserWindow | null = null;
let officeWindow: BrowserWindow | null = null;
let teamOverlayWindow: BrowserWindow | null = null;
let serverStatus: HookServerStatus;
let isQuitting = false;
const permissionGate = new PermissionGate();
/** Proves a permission request came from a chat run this app started. New every launch. */
const permissionToken = randomBytes(24).toString("hex");
let officeChat: OfficeChat | null = null;
/** The visible conversation, replayed when the office window opens again. */
let chatHistory: ChatEvent[] = [];
const maxChatHistory = 400;

function rendererWindows(): BrowserWindow[] {
  return [overlayWindow, officeWindow, teamOverlayWindow].filter(
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

/** Crashes allowed inside this window before auto-reload gives up, so a model that always crashes cannot loop forever. */
const maxReloadsPerWindow = 3;
const reloadWindowMs = 60_000;

/**
 * A crashed renderer leaves a transparent window that looks like the overlay
 * vanished. Log why, so the cause shows up in the terminal, and reload the page.
 */
function watchRenderer(window: BrowserWindow, name: string): void {
  const recentCrashes: number[] = [];
  window.webContents.on("render-process-gone", (_event, details) => {
    console.error(`[main] ${name} renderer gone: ${details.reason} (exit code ${details.exitCode})`);
    if (details.reason === "clean-exit" || window.isDestroyed()) {
      return;
    }
    const now = Date.now();
    while (recentCrashes.length > 0 && now - (recentCrashes[0] as number) > reloadWindowMs) {
      recentCrashes.shift();
    }
    recentCrashes.push(now);
    if (recentCrashes.length > maxReloadsPerWindow) {
      console.error(`[main] ${name} keeps crashing, not reloading again. Try another model or restart the app.`);
      return;
    }
    window.webContents.reload();
  });
}

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
    show: settings.companionVisible,
    alwaysOnTop: settings.alwaysOnTop,
    backgroundColor: "#00000000",
    title: "2B",
    webPreferences,
  });
  watchRenderer(window, "overlay");
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

/**
 * Top-right twin of the overlay where team members talk. Starts hidden and is
 * shown without taking focus only while someone is speaking, so an empty
 * transparent window never blocks clicks on whatever is underneath.
 */
function createTeamOverlayWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();
  const window = new BrowserWindow({
    ...teamOverlaySize,
    x: workArea.x + workArea.width - teamOverlaySize.width - overlayMargin,
    y: workArea.y + overlayMargin,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: settings.alwaysOnTop,
    backgroundColor: "#00000000",
    title: "Tim 2B",
    webPreferences,
  });
  watchRenderer(window, "team overlay");
  window.loadFile(join(rendererDir, "team-overlay/index.html")).catch((error: unknown) => {
    console.error("[main] failed to load team overlay page", error);
  });
  window.on("closed", () => {
    teamOverlayWindow = null;
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
    title: "Kantor AlyxLabs",
    backgroundColor: "#e9e4da",
    autoHideMenuBar: true,
    webPreferences,
  });
  watchRenderer(officeWindow, "office");
  // Claude Code may have been installed or logged in since the last check.
  officeChat?.checkCli().catch((error: unknown) => console.error("[main] claude CLI check failed", error));
  officeWindow.loadFile(join(rendererDir, "office/index.html")).catch((error: unknown) => {
    console.error("[main] failed to load office page", error);
  });
  officeWindow.on("closed", () => {
    officeWindow = null;
    // Nobody can see a permission card any more, so the run stops and open cards become denies.
    officeChat?.stop();
    permissionGate.denyAll("Kantor ditutup.");
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
        label: `${roster[memberId].displayName} (${roster[memberId].role})${modelPathFor(memberId) === null ? "" : "  \u2713"}`,
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
        teamOverlayWindow?.setAlwaysOnTop(item.checked);
        updateSettings({ alwaysOnTop: item.checked }).catch((error: unknown) => {
          console.error("[main] failed to save settings", error);
        });
      },
    },
    {
      label: "Tampilkan isi percakapan asli",
      type: "checkbox",
      checked: settings.conversationMode === "real",
      click: (item) => {
        const mode = item.checked ? "real" : "simulated";
        updateSettings({ conversationMode: mode })
          .then(() => broadcast(ipcChannels.conversationMode, mode))
          .catch((error: unknown) => console.error("[main] failed to save settings", error));
      },
    },
    {
      label: "Close-up kantor pas ada yang kerja",
      type: "checkbox",
      checked: settings.closeupEnabled,
      click: (item) => setCloseupEnabled(item.checked),
    },
    {
      label: "Tampilkan 2B di desktop",
      type: "checkbox",
      checked: settings.companionVisible,
      click: (item) => setCompanionVisible(item.checked),
    },
    {
      label: "Chat ke Claude di kantor",
      type: "checkbox",
      checked: settings.chatEnabled,
      click: (item) => setChatEnabled(item.checked),
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

/** A model picked in the menu wins over one dropped into models/ under the member's name. */
function modelPathFor(memberId: MemberId): string | null {
  return settings.modelPaths[memberId] ?? findMemberModel(repoRootFrom(import.meta.dirname), memberId);
}

function setCloseupEnabled(enabled: boolean): void {
  updateSettings({ closeupEnabled: enabled })
    .then(() => broadcast(ipcChannels.closeupEnabled, enabled))
    .catch((error: unknown) => console.error("[main] failed to save settings", error));
}

function sendToOffice(channel: string, value?: unknown): void {
  if (officeWindow !== null && !officeWindow.isDestroyed()) {
    officeWindow.webContents.send(channel, value);
  }
}

/** Hides 2B's overlay window without quitting: the office (or the next launch) brings her back. */
function setCompanionVisible(visible: boolean): void {
  const window = overlayWindow;
  if (window !== null && !window.isDestroyed()) {
    if (visible) {
      window.showInactive();
    } else {
      window.hide();
    }
  }
  updateSettings({ companionVisible: visible })
    .then(() => broadcast(ipcChannels.companionVisible, visible))
    .catch((error: unknown) => console.error("[main] failed to save settings", error));
}

function setChatEnabled(enabled: boolean): void {
  if (!enabled) {
    officeChat?.stop();
    permissionGate.denyAll("Chat kantor dimatiin.");
  }
  updateSettings({ chatEnabled: enabled })
    .then(() => broadcast(ipcChannels.chatEnabled, enabled))
    .catch((error: unknown) => console.error("[main] failed to save settings", error));
}

function recordChatEvent(event: ChatEvent): void {
  chatHistory.push(event);
  if (chatHistory.length > maxChatHistory) {
    chatHistory = chatHistory.slice(-maxChatHistory);
  }
  sendToOffice(ipcChannels.chatEvent, event);
}

function requireChat(): OfficeChat {
  if (officeChat === null) {
    throw new Error("office chat is not ready yet");
  }
  return officeChat;
}

function startOfficeChat(): void {
  const permissionUrl =
    serverStatus.state === "listening" ? `http://127.0.0.1:${serverStatus.port}${permissionPath}` : null;
  const chat = new OfficeChat(
    {
      findCommand: () => resolveClaudeCommand(process.env, process.platform, existsSync),
      settingsDir: app.getPath("userData"),
      permissionUrl,
      token: permissionToken,
      gate: permissionGate,
    },
    settings.chatProjectDir,
    settings.chatSessionId,
  );
  chat.on("event", recordChatEvent);
  chat.on("status", (status) => sendToOffice(ipcChannels.chatStatus, status));
  chat.on("session", (sessionId) => {
    updateSettings({ chatSessionId: sessionId }).catch((error: unknown) =>
      console.error("[main] failed to save the chat session", error),
    );
  });
  permissionGate.on("ask", (ask) => recordChatEvent({ kind: "permission", ask }));
  permissionGate.on("settled", (id, allowed) => recordChatEvent({ kind: "permission-settled", id, allowed }));
  officeChat = chat;
  chat.checkCli().catch((error: unknown) => console.error("[main] claude CLI check failed", error));
}

function registerChatIpc(): void {
  ipcMain.handle(ipcChannels.getCompanionVisible, () => settings.companionVisible);
  ipcMain.on(ipcChannels.setCompanionVisible, (_event, visible: unknown) => {
    if (typeof visible !== "boolean") {
      console.error(`[main] ignoring non-boolean companion setting: ${String(visible)}`);
      return;
    }
    setCompanionVisible(visible);
  });
  ipcMain.handle(ipcChannels.getChatEnabled, () => settings.chatEnabled);
  ipcMain.on(ipcChannels.setChatEnabled, (_event, enabled: unknown) => {
    if (typeof enabled !== "boolean") {
      console.error(`[main] ignoring non-boolean chat setting: ${String(enabled)}`);
      return;
    }
    setChatEnabled(enabled);
  });
  ipcMain.handle(ipcChannels.getChatStatus, () => requireChat().status());
  ipcMain.handle(ipcChannels.getChatHistory, () => chatHistory);
  ipcMain.on(ipcChannels.sendChat, (_event, text: unknown) => {
    if (typeof text !== "string") {
      console.error("[main] ignoring a non-text chat message");
      return;
    }
    if (!settings.chatEnabled) {
      recordChatEvent({ kind: "error", message: "Chat kantor lagi dimatiin." });
      return;
    }
    requireChat().send(text);
  });
  ipcMain.on(ipcChannels.stopChat, () => requireChat().stop());
  ipcMain.on(ipcChannels.newChat, () => {
    requireChat().newConversation();
    chatHistory = [];
  });
  ipcMain.handle(ipcChannels.pickChatProject, async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = {
      title: "Pilih folder project buat chat kantor (cuma folder project lo sendiri)",
      properties: ["openDirectory"],
    };
    const result =
      parent === null ? await dialog.showOpenDialog(options) : await dialog.showOpenDialog(parent, options);
    const [selected] = result.filePaths;
    if (result.canceled || selected === undefined) {
      return null;
    }
    const chat = requireChat();
    const changed = chat.status().projectDir !== selected;
    chat.setProjectDir(selected);
    if (changed) {
      chatHistory = [];
    }
    await updateSettings({ chatProjectDir: selected });
    return selected;
  });
  ipcMain.on(ipcChannels.answerPermission, (_event, id: unknown, allowed: unknown) => {
    if (typeof id !== "string" || typeof allowed !== "boolean") {
      console.error("[main] ignoring a malformed permission answer");
      return;
    }
    permissionGate.answer(id, allowed);
  });
}

function registerIpc(): void {
  registerChatIpc();
  ipcMain.handle(ipcChannels.loadSavedModel, async (_event, memberId: unknown) => {
    if (!isMemberId(memberId)) {
      throw new Error(`unknown member: ${String(memberId)}`);
    }
    const modelPath = modelPathFor(memberId);
    return modelPath === null ? null : readModel(modelPath);
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
  ipcMain.handle(ipcChannels.loadBaseModel, async () => {
    const path = findBaseModel(repoRootFrom(import.meta.dirname), process.env);
    return path === null ? null : readModel(path);
  });
  ipcMain.handle(ipcChannels.getConversationMode, () => settings.conversationMode);
  ipcMain.handle(ipcChannels.getCloseupEnabled, () => settings.closeupEnabled);
  ipcMain.on(ipcChannels.setCloseupEnabled, (_event, enabled: unknown) => {
    if (typeof enabled !== "boolean") {
      console.error(`[main] ignoring non-boolean close-up setting: ${String(enabled)}`);
      return;
    }
    setCloseupEnabled(enabled);
  });
  ipcMain.on(ipcChannels.setConversationMode, (_event, mode: unknown) => {
    if (!isConversationMode(mode)) {
      console.error(`[main] ignoring unknown conversation mode: ${String(mode)}`);
      return;
    }
    updateSettings({ conversationMode: mode })
      .then(() => broadcast(ipcChannels.conversationMode, mode))
      .catch((error: unknown) => console.error("[main] failed to save settings", error));
  });
  ipcMain.on(ipcChannels.teamOverlayVisible, (_event, visible: unknown) => {
    const window = teamOverlayWindow;
    if (window === null || window.isDestroyed()) {
      return;
    }
    if (visible === true && !window.isVisible()) {
      window.showInactive();
    } else if (visible !== true && window.isVisible()) {
      window.hide();
    }
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
  const server = new HookServer({
    host: "127.0.0.1",
    port,
    log: (line) => console.log(line),
    permissions: {
      token: permissionToken,
      handle: async (toolName, input, signal) => hookResponse(await permissionGate.request(toolName, input, signal)),
    },
  });
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
  startOfficeChat();
  overlayWindow = createOverlayWindow();
  teamOverlayWindow = createTeamOverlayWindow();
  if (settings.officeOpen) {
    openOfficeWindow();
  }
  const cursorTimer = startCursorTracking();

  app.on("before-quit", () => {
    isQuitting = true;
    clearInterval(cursorTimer);
    officeChat?.stop();
    permissionGate.denyAll("Companion ditutup.");
    server.close().catch((error: unknown) => console.error("[main] failed to close hook server", error));
  });
}

// Lets tests (and a second profile) run with their own settings instead of the user's.
const userDataOverride = process.env.WAIFU_USER_DATA_DIR;
if (userDataOverride !== undefined && userDataOverride !== "") {
  app.setPath("userData", userDataOverride);
}

// A second instance would fail to bind the hook port, so focus the first one instead.
if (!app.requestSingleInstanceLock()) {
  // Without this line the second launch just vanishes, which looks like a crash.
  console.error(
    "[main] Companion udah jalan di proses lain, jadi yang ini ditutup. Overlay yang lama dimunculin lagi. " +
      "Kalau overlay-nya tetap nggak kelihatan, tutup proses electron lama (Task Manager) lalu jalanin npm start lagi.",
  );
  app.quit();
} else {
  app.on("second-instance", () => {
    // Launching again is how someone gets a hidden 2B back without opening the office.
    setCompanionVisible(true);
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
