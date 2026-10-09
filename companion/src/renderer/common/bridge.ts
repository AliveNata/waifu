import type { CompanionApi, CursorOffset, HookServerStatus, ModelFile } from "../../shared/protocol.js";
import type { Reaction } from "../../shared/reaction.js";

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

function createWebBridge(): RendererBridge {
  let events: EventSource | null = null;
  const reactionListeners = new Set<(reaction: Reaction) => void>();

  const ensureEventStream = (): void => {
    if (events !== null) {
      return;
    }
    events = new EventSource("/events");
    events.addEventListener("reaction", (event) => {
      const reaction = JSON.parse((event as MessageEvent<string>).data) as Reaction;
      for (const listener of reactionListeners) {
        listener(reaction);
      }
    });
  };

  return {
    hasNativeMenu: false,
    async loadSavedModel() {
      const response = await fetch("/model");
      if (response.status === 204) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`GET /model answered ${response.status}`);
      }
      const name = decodeURIComponent(response.headers.get("x-model-name") ?? "model.vrm");
      return { name, bytes: await response.arrayBuffer() };
    },
    pickModel: pickFileFromBrowser,
    async getServerStatus(): Promise<HookServerStatus> {
      return { state: "listening", port: Number(window.location.port) };
    },
    openMenu() {
      throw new Error("native menu is only available in Electron");
    },
    onReaction(listener) {
      ensureEventStream();
      reactionListeners.add(listener);
      return () => reactionListeners.delete(listener);
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
