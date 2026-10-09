import type { CompanionSignal } from "./reaction.js";
import type { MemberId } from "./team.js";

export const defaultHookPort = 47823;
export const hookPortEnvVar = "WAIFU_COMPANION_PORT";

export function resolveHookPort(env: Record<string, string | undefined>): number {
  const raw = env[hookPortEnvVar];
  if (raw === undefined || raw === "") {
    return defaultHookPort;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${hookPortEnvVar} must be an integer between 1 and 65535, got "${raw}"`);
  }
  return port;
}

export interface ModelFile {
  name: string;
  bytes: ArrayBuffer;
}

export type HookServerStatus = { state: "listening"; port: number } | { state: "error"; port: number; message: string };

/** Cursor offset from the overlay's head anchor, in screen pixels. */
export interface CursorOffset {
  dx: number;
  dy: number;
}

export interface CompanionApi {
  /** Model for a team member. Null when none is configured yet. */
  loadSavedModel(memberId: MemberId): Promise<ModelFile | null>;
  /** Asks the user for a .vrm for a team member and remembers it. */
  pickModel(memberId: MemberId): Promise<ModelFile | null>;
  getServerStatus(): Promise<HookServerStatus>;
  openMenu(): void;
  onSignal(listener: (signal: CompanionSignal) => void): () => void;
  onModelChanged(listener: (memberId: MemberId) => void): () => void;
  onCursor(listener: (offset: CursorOffset) => void): () => void;
  onServerStatus(listener: (status: HookServerStatus) => void): () => void;
}

export const ipcChannels = {
  loadSavedModel: "companion:load-saved-model",
  pickModel: "companion:pick-model",
  getServerStatus: "companion:get-server-status",
  openMenu: "companion:open-menu",
  signal: "companion:signal",
  modelChanged: "companion:model-changed",
  cursor: "companion:cursor",
  serverStatus: "companion:server-status",
} as const;
