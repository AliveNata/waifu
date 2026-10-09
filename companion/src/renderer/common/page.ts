import type { VRM } from "@pixiv/three-vrm";
import type { HookServerStatus, ModelFile } from "../../shared/protocol.js";
import { type Reaction, statusText } from "../../shared/reaction.js";
import type { RendererBridge } from "./bridge.js";
import { ReactionTracker } from "./reaction-tracker.js";
import { disposeVrm, loadVrm } from "./vrm-loader.js";

export interface Stage {
  setModel(vrm: VRM | null): void;
  /** Called every frame with the current (possibly decayed) reaction. */
  setReaction(reaction: Reaction): void;
}

type PanelState = { kind: "empty" } | { kind: "loading"; name: string } | { kind: "error"; message: string };

function requireElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) {
    throw new Error(`#${id} is missing or not a ${type.name}`);
  }
  return element;
}

/**
 * Shared page controller for the overlay and the office: model loading,
 * empty/loading/error panels, the status chip and the menu button.
 */
export class CompanionPage {
  private readonly panel = requireElement("panel", HTMLElement);
  private readonly panelTitle = requireElement("panel-title", HTMLElement);
  private readonly panelBody = requireElement("panel-body", HTMLElement);
  private readonly panelAction = requireElement("panel-action", HTMLButtonElement);
  private readonly status = requireElement("status", HTMLElement);
  private readonly menuButton = requireElement("menu-button", HTMLButtonElement);

  private readonly tracker = new ReactionTracker(Date.now());
  private vrm: VRM | null = null;
  private serverError: string | null = null;
  private lastStatusKey = "";
  private loadGeneration = 0;

  constructor(
    private readonly bridge: RendererBridge,
    private readonly stage: Stage,
  ) {}

  start(): void {
    this.panelAction.addEventListener("click", () => this.pickModel());
    if (this.bridge.hasNativeMenu) {
      this.menuButton.textContent = "Menu";
      this.menuButton.addEventListener("click", () => this.bridge.openMenu());
    } else {
      this.menuButton.textContent = "Ganti model";
      this.menuButton.addEventListener("click", () => this.pickModel());
    }

    this.bridge.onReaction((reaction) => this.tracker.apply(reaction));
    this.bridge.onModelChanged(() => this.loadSaved());
    this.bridge.onServerStatus((status) => this.applyServerStatus(status));
    this.bridge
      .getServerStatus()
      .then((status) => this.applyServerStatus(status))
      .catch((error: unknown) => console.error("[page] failed to read hook server status", error));

    this.loadSaved();
  }

  /** Call once per frame from the stage's render loop. */
  tick(): void {
    const reaction = this.tracker.current(Date.now());
    this.stage.setReaction(reaction);
    this.renderStatus(reaction);
  }

  private applyServerStatus(status: HookServerStatus): void {
    this.serverError = status.state === "error" ? status.message : null;
  }

  private loadSaved(): void {
    this.showPanel({ kind: "loading", name: "model tersimpan" });
    this.bridge
      .loadSavedModel()
      .then((file) => (file === null ? this.showPanel({ kind: "empty" }) : this.loadModel(file)))
      .catch((error: unknown) => this.fail(error));
  }

  private pickModel(): void {
    this.bridge
      .pickModel()
      .then((file) => (file === null ? undefined : this.loadModel(file)))
      .catch((error: unknown) => this.fail(error));
  }

  private async loadModel(file: ModelFile): Promise<void> {
    const generation = ++this.loadGeneration;
    this.showPanel({ kind: "loading", name: file.name });
    const vrm = await loadVrm(file.bytes);
    if (generation !== this.loadGeneration) {
      // A newer load started while this one was parsing.
      disposeVrm(vrm);
      return;
    }
    if (this.vrm !== null) {
      disposeVrm(this.vrm);
    }
    this.vrm = vrm;
    this.stage.setModel(vrm);
    this.hidePanel();
  }

  private fail(error: unknown): void {
    console.error("[page] model load failed", error);
    const message = error instanceof Error ? error.message : String(error);
    this.showPanel({ kind: "error", message });
  }

  private showPanel(state: PanelState): void {
    this.panel.hidden = false;
    this.panel.dataset.state = state.kind;
    switch (state.kind) {
      case "empty":
        this.panelTitle.textContent = "Belum ada model";
        this.panelBody.textContent = "Export Xenovia dari VRoid Studio sebagai .vrm, lalu pilih file-nya di sini.";
        this.panelAction.hidden = false;
        this.panelAction.textContent = "Pilih file .vrm";
        break;
      case "loading":
        this.panelTitle.textContent = "Memuat model";
        this.panelBody.textContent = state.name;
        this.panelAction.hidden = true;
        break;
      case "error":
        this.panelTitle.textContent = "Model gagal dimuat";
        this.panelBody.textContent = state.message;
        this.panelAction.hidden = false;
        this.panelAction.textContent = "Pilih file lain";
        break;
    }
  }

  private hidePanel(): void {
    this.panel.hidden = true;
  }

  private renderStatus(reaction: Reaction): void {
    const text = this.serverError ?? statusText(reaction);
    const tone = this.serverError !== null ? "error" : reaction.mood === "waiting" ? "attention" : "neutral";
    const key = `${tone}|${text ?? ""}`;
    if (key === this.lastStatusKey) {
      return;
    }
    this.lastStatusKey = key;
    this.status.hidden = text === null;
    this.status.textContent = text ?? "";
    this.status.dataset.tone = tone;
  }
}
