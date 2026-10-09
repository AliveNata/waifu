import type { CompanionApi, CursorOffset, HookServerStatus, ModelFile } from "../../shared/protocol.js";
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

function createWebBridge(): RendererBridge {
  let events: EventSource | null = null;
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
    async loadSavedModel(memberId: MemberId) {
      const response = await fetch(`/model/${memberId}`);
      if (response.status === 204) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`GET /model/${memberId} answered ${response.status}`);
      }
      const name = decodeURIComponent(response.headers.get("x-model-name") ?? "model.vrm");
      return { name, bytes: await response.arrayBuffer() };
    },
    pickModel: () => pickFileFromBrowser(),
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
