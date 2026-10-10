// Sandboxed preloads cannot require local modules, so channel names are
// duplicated from src/shared/protocol.ts. test/protocol.test.ts keeps
// the two lists in sync.
import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import type { CompanionApi, ConversationMode, CursorOffset, HookServerStatus, ModelFile } from "../shared/protocol.js";
import type { CompanionSignal } from "../shared/reaction.js";
import type { MemberId } from "../shared/team.js";

const channels = {
  loadSavedModel: "companion:load-saved-model",
  pickModel: "companion:pick-model",
  loadBaseModel: "companion:load-base-model",
  getConversationMode: "companion:get-conversation-mode",
  setConversationMode: "companion:set-conversation-mode",
  conversationMode: "companion:conversation-mode",
  getCloseupEnabled: "companion:get-closeup-enabled",
  setCloseupEnabled: "companion:set-closeup-enabled",
  closeupEnabled: "companion:closeup-enabled",
  teamOverlayVisible: "companion:team-overlay-visible",
  getServerStatus: "companion:get-server-status",
  openMenu: "companion:open-menu",
  signal: "companion:signal",
  modelChanged: "companion:model-changed",
  cursor: "companion:cursor",
  serverStatus: "companion:server-status",
};

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, value: T): void => listener(value);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.off(channel, handler);
  };
}

const api: CompanionApi = {
  loadSavedModel: (memberId) => ipcRenderer.invoke(channels.loadSavedModel, memberId) as Promise<ModelFile | null>,
  pickModel: (memberId) => ipcRenderer.invoke(channels.pickModel, memberId) as Promise<ModelFile | null>,
  loadBaseModel: () => ipcRenderer.invoke(channels.loadBaseModel) as Promise<ModelFile | null>,
  getConversationMode: () => ipcRenderer.invoke(channels.getConversationMode) as Promise<ConversationMode>,
  setConversationMode: (mode) => ipcRenderer.send(channels.setConversationMode, mode),
  onConversationMode: (listener) => subscribe<ConversationMode>(channels.conversationMode, listener),
  getCloseupEnabled: () => ipcRenderer.invoke(channels.getCloseupEnabled) as Promise<boolean>,
  setCloseupEnabled: (enabled) => ipcRenderer.send(channels.setCloseupEnabled, enabled),
  onCloseupEnabled: (listener) => subscribe<boolean>(channels.closeupEnabled, listener),
  setTeamOverlayVisible: (visible) => ipcRenderer.send(channels.teamOverlayVisible, visible),
  getServerStatus: () => ipcRenderer.invoke(channels.getServerStatus) as Promise<HookServerStatus>,
  openMenu: () => ipcRenderer.send(channels.openMenu),
  onSignal: (listener) => subscribe<CompanionSignal>(channels.signal, listener),
  onModelChanged: (listener) => subscribe<MemberId>(channels.modelChanged, listener),
  onCursor: (listener) => subscribe<CursorOffset>(channels.cursor, listener),
  onServerStatus: (listener) => subscribe<HookServerStatus>(channels.serverStatus, listener),
};

contextBridge.exposeInMainWorld("companion", api);
