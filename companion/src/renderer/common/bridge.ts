import type {
  CompanionApi,
  ConversationMode,
  CursorOffset,
  HookServerStatus,
  ModelFile,
} from "../../shared/protocol.js";
import { isConversationMode } from "../../shared/protocol.js";
import type { CompanionSignal } from "../../shared/reaction.js";
import type { MemberId } from "../../shared/team.js";

declare global {
  interface Window {
    companion?: CompanionApi;
  }
}

export interface RendererBridge extends CompanionApi {
  /** Electron shows a native menu, the browser fallback has a plain "change model" button instead. */
  readonly hasNativeMenu: boolean;
}

export function getBridge(): RendererBridge {
  const electronApi = window.companion;
  if (electronApi !== undefined) {
    return { ...electronApi, hasNativeMenu: true };
  }
  return createWebBridge();
}

function pickFileFromBrowser(): Promise<ModelFile | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".vrm";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file === undefined) {
        resolve(null);
        return;
      }
      file
        .arrayBuffer()
        .then((bytes) => resolve({ name: file.name, bytes }))
        .catch(reject);
    });
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

const conversationModeKey = "waifu.conversationMode";

/** Browser storage can be unavailable (private mode, blocked site data); the mode then just resets per page load. */
function readStoredMode(): ConversationMode {
  try {
    const stored = window.localStorage.getItem(conversationModeKey);
    return isConversationMode(stored) ? stored : "simulated";
  } catch (error) {
    console.warn("[bridge] localStorage unavailable, using simulated conversation", error);
    return "simulated";
  }
}

function storeMode(mode: ConversationMode): void {
  try {
    window.localStorage.setItem(conversationModeKey, mode);
  } catch (error) {
    console.warn("[bridge] could not persist conversation mode", error);
  }
}

async function fetchModel(path: string): Promise<ModelFile | null> {
  const response = await fetch(path);
  if (response.status === 204) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`GET ${path} answered ${response.status}`);
  }
  const name = decodeURIComponent(response.headers.get("x-model-name") ?? "model.vrm");
  return { name, bytes: await response.arrayBuffer() };
}

const closeupEnabledKey = "waifu.closeupEnabled";

function readStoredCloseup(): boolean {
  try {
    return window.localStorage.getItem(closeupEnabledKey) !== "false";
  } catch (error) {
    console.warn("[bridge] localStorage unavailable, close-up stays on", error);
    return true;
  }
}

function storeCloseup(enabled: boolean): void {
  try {
    window.localStorage.setItem(closeupEnabledKey, String(enabled));
  } catch (error) {
    console.warn("[bridge] could not persist close-up setting", error);
  }
}

function createWebBridge(): RendererBridge {
  let events: EventSource | null = null;
  let conversationMode = readStoredMode();
  const modeListeners = new Set<(mode: ConversationMode) => void>();
  let closeupEnabled = readStoredCloseup();
  const closeupListeners = new Set<(enabled: boolean) => void>();
  const signalListeners = new Set<(signal: CompanionSignal) => void>();

  const ensureEventStream = (): void => {
    if (events !== null) {
      return;
    }
    events = new EventSource("/events");
    // Hooks that arrive before the stream opens are lost, so tests and tooling wait for this marker.
    events.addEventListener("open", () => {
      document.documentElement.dataset.events = "connected";
    });
    events.addEventListener("error", () => {
      document.documentElement.dataset.events = "disconnected";
    });
    events.addEventListener("signal", (event) => {
      const signal = JSON.parse((event as MessageEvent<string>).data) as CompanionSignal;
      for (const listener of signalListeners) {
        listener(signal);
      }
    });
  };

  return {
    hasNativeMenu: false,
    loadSavedModel: (memberId: MemberId) => fetchModel(`/model/${memberId}`),
    pickModel: () => pickFileFromBrowser(),
    loadBaseModel: () => fetchModel("/model/base"),
    async getConversationMode() {
      return conversationMode;
    },
    setConversationMode(mode) {
      conversationMode = mode;
      storeMode(mode);
      for (const listener of modeListeners) {
        listener(mode);
      }
    },
    onConversationMode(listener) {
      modeListeners.add(listener);
      return () => modeListeners.delete(listener);
    },
    async getCloseupEnabled() {
      return closeupEnabled;
    },
    setCloseupEnabled(enabled) {
      closeupEnabled = enabled;
      storeCloseup(enabled);
      for (const listener of closeupListeners) {
        listener(enabled);
      }
    },
    onCloseupEnabled(listener) {
      closeupListeners.add(listener);
      return () => closeupListeners.delete(listener);
    },
    // The chat runs Claude Code on this machine, so it lives in Electron only: a browser
    // tab talking to it over HTTP would be one DNS-rebinding page away from a stranger.
    async getChatEnabled() {
      return false;
    },
    setChatEnabled() {
      console.warn("[bridge] the office chat is only available in the Electron app");
    },
    onChatEnabled() {
      return () => undefined;
    },
    async getChatStatus() {
      return { state: "unavailable", projectDir: null, problem: "Chat ke Claude cuma ada di aplikasi Electron." };
    },
    onChatStatus() {
      return () => undefined;
    },
    onChatEvent() {
      return () => undefined;
    },
    async getChatHistory() {
      return [];
    },
    sendChat() {
      throw new Error("the office chat is only available in the Electron app");
    },
    stopChat() {
      throw new Error("the office chat is only available in the Electron app");
    },
    newChat() {
      throw new Error("the office chat is only available in the Electron app");
    },
    async pickChatProject() {
      throw new Error("the office chat is only available in the Electron app");
    },
    answerPermission() {
      throw new Error("the office chat is only available in the Electron app");
    },
    setTeamOverlayVisible() {
      // A browser tab has no window to hide; the page hides its own content instead.
    },
    async getServerStatus(): Promise<HookServerStatus> {
      return { state: "listening", port: Number(window.location.port) };
    },
    openMenu() {
      throw new Error("native menu is only available in Electron");
    },
    onSignal(listener) {
      ensureEventStream();
      signalListeners.add(listener);
      return () => signalListeners.delete(listener);
    },
    onModelChanged() {
      // Each browser tab picks its own model, so there is nothing to sync.
      return () => undefined;
    },
    onCursor(listener) {
      const handler = (event: PointerEvent): void => {
        const offset: CursorOffset = {
          dx: event.clientX - window.innerWidth / 2,
          dy: event.clientY - window.innerHeight * 0.3,
        };
        listener(offset);
      };
      window.addEventListener("pointermove", handler);
      return () => window.removeEventListener("pointermove", handler);
    },
    onServerStatus() {
      return () => undefined;
    },
  };
}
