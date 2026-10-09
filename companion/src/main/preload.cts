// Sandboxed preloads cannot require local modules, so channel names are
// duplicated from src/shared/protocol.ts. test/preload-channels.test.ts keeps
// the two lists in sync.
import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import type { CompanionApi, CursorOffset, HookServerStatus, ModelFile } from "../shared/protocol.js";
import type { Reaction } from "../shared/reaction.js";

const channels = {
  loadSavedModel: "companion:load-saved-model",
  pickModel: "companion:pick-model",
  getServerStatus: "companion:get-server-status",
  openMenu: "companion:open-menu",
  reaction: "companion:reaction",
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
  loadSavedModel: () => ipcRenderer.invoke(channels.loadSavedModel) as Promise<ModelFile | null>,
  pickModel: () => ipcRenderer.invoke(channels.pickModel) as Promise<ModelFile | null>,
  getServerStatus: () => ipcRenderer.invoke(channels.getServerStatus) as Promise<HookServerStatus>,
  openMenu: () => ipcRenderer.send(channels.openMenu),
  onReaction: (listener) => subscribe<Reaction>(channels.reaction, listener),
  onModelChanged: (listener) => subscribe<void>(channels.modelChanged, () => listener()),
  onCursor: (listener) => subscribe<CursorOffset>(channels.cursor, listener),
  onServerStatus: (listener) => subscribe<HookServerStatus>(channels.serverStatus, listener),
};

contextBridge.exposeInMainWorld("companion", api);
