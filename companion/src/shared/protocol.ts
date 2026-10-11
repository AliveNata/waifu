import type { ChatEvent, ChatSessionList, ChatStatus } from "./office-chat.js";
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

/** "simulated" shows role-flavored lines, "real" shows the actual task titles and report summaries. */
export type ConversationMode = "simulated" | "real";

export function isConversationMode(value: unknown): value is ConversationMode {
  return value === "simulated" || value === "real";
}

export interface CompanionApi {
  /** Model for a team member. Null when none is configured yet. */
  loadSavedModel(memberId: MemberId): Promise<ModelFile | null>;
  /** Asks the user for a .vrm for a team member and remembers it. */
  pickModel(memberId: MemberId): Promise<ModelFile | null>;
  /** Anime base model used for members without their own .vrm. Null until `npm run fetch-base-model`. */
  loadBaseModel(): Promise<ModelFile | null>;
  getConversationMode(): Promise<ConversationMode>;
  setConversationMode(mode: ConversationMode): void;
  onConversationMode(listener: (mode: ConversationMode) => void): () => void;
  /** Whether the office shows the close-up panel while someone works. */
  getCloseupEnabled(): Promise<boolean>;
  setCloseupEnabled(enabled: boolean): void;
  onCloseupEnabled(listener: (enabled: boolean) => void): () => void;
  /** Whether 2B's desktop companion window is shown. */
  getCompanionVisible(): Promise<boolean>;
  setCompanionVisible(visible: boolean): void;
  onCompanionVisible(listener: (visible: boolean) => void): () => void;
  /** Whether the office shows the chat to Claude. */
  getChatEnabled(): Promise<boolean>;
  setChatEnabled(enabled: boolean): void;
  onChatEnabled(listener: (enabled: boolean) => void): () => void;
  getChatStatus(): Promise<ChatStatus>;
  onChatStatus(listener: (status: ChatStatus) => void): () => void;
  onChatEvent(listener: (event: ChatEvent) => void): () => void;
  /** This conversation so far, so a reopened office window shows it again. */
  getChatHistory(): Promise<ChatEvent[]>;
  sendChat(text: string): void;
  stopChat(): void;
  /** Starts a fresh conversation in the same folder. */
  newChat(): void;
  /** Asks for the project folder the chat works in. Resolves with the folder, or null when cancelled. */
  pickChatProject(): Promise<string | null>;
  /** Claude Code sessions saved on this machine for the chat's folder, newest first. */
  listChatSessions(): Promise<ChatSessionList>;
  /** Carries on a stored session. Resolves with the end of its conversation, to show in the log. */
  resumeChatSession(sessionId: string): Promise<ChatEvent[]>;
  answerPermission(id: string, allowed: boolean): void;
  /** Shows or hides the team overlay window. The browser fallback has no window to hide. */
  setTeamOverlayVisible(visible: boolean): void;
  getServerStatus(): Promise<HookServerStatus>;
  openMenu(): void;
  /**
   * Moves this window by a screen offset from where it was when the drag began. The overlay
   * drags itself this way because a CSS drag region would swallow every click on 2B.
   */
  beginWindowDrag(): void;
  dragWindow(dx: number, dy: number): void;
  onSignal(listener: (signal: CompanionSignal) => void): () => void;
  onModelChanged(listener: (memberId: MemberId) => void): () => void;
  onCursor(listener: (offset: CursorOffset) => void): () => void;
  onServerStatus(listener: (status: HookServerStatus) => void): () => void;
}

export const ipcChannels = {
  loadSavedModel: "companion:load-saved-model",
  pickModel: "companion:pick-model",
  loadBaseModel: "companion:load-base-model",
  getConversationMode: "companion:get-conversation-mode",
  setConversationMode: "companion:set-conversation-mode",
  conversationMode: "companion:conversation-mode",
  getCloseupEnabled: "companion:get-closeup-enabled",
  setCloseupEnabled: "companion:set-closeup-enabled",
  closeupEnabled: "companion:closeup-enabled",
  getCompanionVisible: "companion:get-companion-visible",
  setCompanionVisible: "companion:set-companion-visible",
  companionVisible: "companion:companion-visible",
  getChatEnabled: "companion:get-chat-enabled",
  setChatEnabled: "companion:set-chat-enabled",
  chatEnabled: "companion:chat-enabled",
  getChatStatus: "companion:get-chat-status",
  chatStatus: "companion:chat-status",
  chatEvent: "companion:chat-event",
  getChatHistory: "companion:get-chat-history",
  sendChat: "companion:send-chat",
  stopChat: "companion:stop-chat",
  newChat: "companion:new-chat",
  pickChatProject: "companion:pick-chat-project",
  listChatSessions: "companion:list-chat-sessions",
  resumeChatSession: "companion:resume-chat-session",
  answerPermission: "companion:answer-permission",
  teamOverlayVisible: "companion:team-overlay-visible",
  getServerStatus: "companion:get-server-status",
  openMenu: "companion:open-menu",
  beginWindowDrag: "companion:begin-window-drag",
  dragWindow: "companion:drag-window",
  signal: "companion:signal",
  modelChanged: "companion:model-changed",
  cursor: "companion:cursor",
  serverStatus: "companion:server-status",
} as const;
