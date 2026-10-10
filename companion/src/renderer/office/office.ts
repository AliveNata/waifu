import "../common/base.css";
import "./office.css";
import type { MemberId } from "../../shared/team.js";
import { memberIds, roster } from "../../shared/team.js";
import { getBridge, type RendererBridge } from "../common/bridge.js";
import { MemberModelLoader } from "../common/member-model.js";
import { ReactionTracker } from "../common/reaction-tracker.js";
import { requireElement, StatusChip } from "../common/status-chip.js";
import { loadVrm } from "../common/vrm-loader.js";
import { VrmOfficeAvatar } from "./avatar.js";
import { closeupRect, OfficeStage } from "./office-stage.js";

class OfficePage {
  private readonly status = new StatusChip(requireElement("status", HTMLElement));
  private readonly caption = requireElement("closeup-caption", HTMLElement);
  private readonly closeupToggle = requireElement("closeup-toggle", HTMLButtonElement);
  private readonly menuButton = requireElement("menu-button", HTMLButtonElement);
  private readonly dialog = requireElement("model-dialog", HTMLDialogElement);
  private readonly modelList = requireElement("model-list", HTMLUListElement);
  private readonly tracker = new ReactionTracker(Date.now());
  private readonly loadGenerations = new Map<MemberId, number>();
  private readonly stage: OfficeStage;
  private readonly models: MemberModelLoader;
  private baseHintShown = false;
  private lastCaption = "";

  constructor(
    private readonly bridge: RendererBridge,
    canvas: HTMLCanvasElement,
  ) {
    this.stage = new OfficeStage(canvas, () => this.tick());
    this.models = new MemberModelLoader(bridge);
  }

  start(): void {
    this.bridge.onSignal((signal) => {
      if (signal.kind === "reaction") {
        this.tracker.apply(signal.reaction);
      } else if (signal.kind === "member") {
        this.stage.applyMemberSignal(signal.member);
      }
    });
    this.bridge.onModelChanged((memberId) => this.loadSaved(memberId));
    this.bridge.onServerStatus((status) => this.status.applyServerStatus(status));
    this.bridge
      .getServerStatus()
      .then((status) => this.status.applyServerStatus(status))
      .catch((error: unknown) => console.error("[office] failed to read hook server status", error));

    this.closeupToggle.addEventListener("click", () => {
      const enabled = this.closeupToggle.getAttribute("aria-pressed") !== "true";
      this.closeupToggle.setAttribute("aria-pressed", String(enabled));
      this.closeupToggle.textContent = enabled ? "Sembunyikan close-up" : "Tampilkan close-up";
      this.stage.setCloseupEnabled(enabled);
    });

    if (this.bridge.hasNativeMenu) {
      this.menuButton.addEventListener("click", () => this.bridge.openMenu());
    } else {
      this.menuButton.textContent = "Model";
      this.buildModelDialog();
      this.menuButton.addEventListener("click", () => this.dialog.showModal());
    }

    for (const memberId of memberIds) {
      this.loadSaved(memberId);
    }
  }

  private buildModelDialog(): void {
    for (const memberId of memberIds) {
      const profile = roster[memberId];
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button";
      button.textContent = `${profile.displayName} (${profile.role})`;
      button.addEventListener("click", () => {
        this.dialog.close();
        this.bridge
          .pickModel(memberId)
          .then((file) => (file === null ? undefined : this.loadModel(memberId, file.bytes)))
          .catch((error: unknown) => this.reportFailure(memberId, error));
      });
      item.append(button);
      this.modelList.append(item);
    }
  }

  private nextGeneration(memberId: MemberId): number {
    const generation = (this.loadGenerations.get(memberId) ?? 0) + 1;
    this.loadGenerations.set(memberId, generation);
    return generation;
  }

  private isCurrent(memberId: MemberId, generation: number): boolean {
    return this.loadGenerations.get(memberId) === generation;
  }

  private loadSaved(memberId: MemberId): void {
    const generation = this.nextGeneration(memberId);
    this.models
      .load(memberId)
      .then((loaded) => {
        if (!this.isCurrent(memberId, generation)) {
          return;
        }
        if (loaded === null) {
          this.useBoxPlaceholder(memberId);
          return;
        }
        this.stage.setAvatar(memberId, new VrmOfficeAvatar(loaded.vrm));
      })
      .catch((error: unknown) => this.reportFailure(memberId, error));
  }

  private async loadModel(memberId: MemberId, bytes: ArrayBuffer): Promise<void> {
    const generation = this.nextGeneration(memberId);
    const vrm = await loadVrm(bytes);
    if (this.isCurrent(memberId, generation)) {
      this.stage.setAvatar(memberId, new VrmOfficeAvatar(vrm));
    }
  }

  /** Last resort when even the anime base model is missing. Says once how to get it. */
  private useBoxPlaceholder(memberId: MemberId): void {
    this.stage.setAvatar(memberId, this.stage.placeholderFor(memberId));
    if (!this.baseHintShown) {
      this.baseHintShown = true;
      this.status.showNotice(
        "Model anime belum ada. Jalanin npm run fetch-base-model di folder companion.",
        Date.now(),
      );
    }
  }

  private reportFailure(memberId: MemberId, error: unknown): void {
    console.error(`[office] model for ${memberId} failed to load`, error);
    const message = error instanceof Error ? error.message : String(error);
    this.status.showNotice(
      `Model ${roster[memberId].displayName} gagal dimuat, pakai model cadangan. ${message}`,
      Date.now(),
    );
    const generation = this.nextGeneration(memberId);
    this.models
      .loadBase(memberId)
      .then((loaded) => {
        if (!this.isCurrent(memberId, generation)) {
          return;
        }
        if (loaded === null) {
          this.stage.setAvatar(memberId, this.stage.placeholderFor(memberId));
        } else {
          this.stage.setAvatar(memberId, new VrmOfficeAvatar(loaded.vrm));
        }
      })
      .catch((fallbackError: unknown) => {
        console.error(`[office] base model fallback for ${memberId} failed`, fallbackError);
        this.stage.setAvatar(memberId, this.stage.placeholderFor(memberId));
      });
  }

  private tick(): void {
    const now = Date.now();
    const reaction = this.tracker.current(now);
    this.stage.setKonanReaction(reaction);
    this.status.render(reaction, now);
    this.renderCaption();
  }

  private renderCaption(): void {
    const focus = this.stage.closeupFocus();
    if (focus === null) {
      if (!this.caption.hidden) {
        this.caption.hidden = true;
        this.lastCaption = "";
      }
      return;
    }
    const rect = closeupRect(window.innerWidth, window.innerHeight);
    const key = `${focus.label}|${rect.x}|${rect.y}|${rect.width}`;
    if (key === this.lastCaption) {
      return;
    }
    this.lastCaption = key;
    this.caption.hidden = false;
    this.caption.textContent = `${focus.label} · layar simulasi`;
    this.caption.style.left = `${rect.x}px`;
    this.caption.style.width = `${rect.width}px`;
    this.caption.style.bottom = `${window.innerHeight - rect.y}px`;
  }
}

const bridge = getBridge();
document.documentElement.dataset.shell = bridge.hasNativeMenu ? "electron" : "web";
const canvas = document.getElementById("scene");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("#scene canvas is missing");
}
new OfficePage(bridge, canvas).start();
