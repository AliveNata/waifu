import "../common/base.css";
import "./office.css";
import { normalizeDisplaySettings, type OfficeDisplaySettings } from "../../shared/display-settings.js";
import type { ConversationMode } from "../../shared/protocol.js";
import { idleReaction } from "../../shared/reaction.js";
import { normalizeSoundSettings, type OfficeSoundSettings } from "../../shared/sound-settings.js";
import type { MemberId } from "../../shared/team.js";
import { memberIds, roster } from "../../shared/team.js";
import { getBridge, type RendererBridge } from "../common/bridge.js";
import { Conversation, type DialogLine } from "../common/conversation.js";
import { DialogBox } from "../common/dialog-box.js";
import { MemberModelLoader } from "../common/member-model.js";
import { ReactionTracker } from "../common/reaction-tracker.js";
import { SpeakerModels } from "../common/speaker-models.js";
import { type SpeakerFraming, SpeakerStage } from "../common/speaker-stage.js";
import { requireElement, StatusChip } from "../common/status-chip.js";
import { loadVrm } from "../common/vrm-loader.js";
import { VrmOfficeAvatar } from "./avatar.js";
import { ChatPanel } from "./chat-panel.js";
import { FoodPicker } from "./food-picker.js";
import { FrameRate, frameLabel } from "./frame-rate.js";
import { MusicPanel } from "./music-panel.js";
import { OfficePointer } from "./office-pointer.js";
import { type CloseupRect, closeupRect, OfficeStage, portraitSize, teamDialogDock } from "./office-stage.js";
import { loadFoodModels } from "./scene/food-models.js";
import { loadFurnitureModels } from "./scene/furniture-models.js";
import { setSceneQuality } from "./scene/palette.js";
import { SpeechBubbles } from "./speech-bubbles.js";
import { StatusDialog } from "./status-dialog.js";

/** Head and shoulders: the portrait is small, so the face has to fill it. */
const portraitFraming: SpeakerFraming = { height: 0.55, drop: 0.06 };
/** Keep the portrait loaded briefly after a line, so back-to-back lines do not flicker. */
const portraitHoldMs = 1500;

const firstPersonControls =
  "WASD jalan · Shift lari · mouse buat noleh · E buat interaksi · I pesan makanan · H sembunyiin tampilan · Esc buat berhenti";
const firstPersonPaused = "Klik kantornya buat lanjut jalan · Esc buat keluar dari mode Alyx";

class OfficePage {
  private readonly status = new StatusChip(requireElement("status", HTMLElement));
  private readonly caption = requireElement("closeup-caption", HTMLElement);
  private readonly statusDialog: StatusDialog;
  private readonly fpsMeter = requireElement("fps-meter", HTMLElement);
  private readonly fpsSetting = requireElement("fps-setting", HTMLInputElement);
  private readonly soundSetting = requireElement("sound-setting", HTMLInputElement);
  private readonly soundVolume = requireElement("sound-volume", HTMLInputElement);
  private readonly soundVolumeValue = requireElement("sound-volume-value", HTMLOutputElement);
  private officeSound: OfficeSoundSettings = normalizeSoundSettings(undefined);
  private readonly renderScaleSetting = requireElement("render-scale", HTMLSelectElement);
  private readonly fpsCapSetting = requireElement("fps-cap", HTMLSelectElement);
  private officeDisplay: OfficeDisplaySettings = normalizeDisplaySettings(undefined);
  private readonly freeCameraButton = requireElement("free-camera", HTMLButtonElement);
  private readonly cameraHint = requireElement("camera-hint", HTMLElement);
  private readonly firstPersonButton = requireElement("first-person", HTMLButtonElement);
  private readonly firstPersonHint = requireElement("first-person-hint", HTMLElement);
  private readonly crosshair = requireElement("crosshair", HTMLElement);
  private readonly interactPrompt = requireElement("interact-prompt", HTMLElement);
  /** The label the prompt shows now, to rebuild it only when it changes. */
  private interactLabel: string | null = null;
  /** A note shown in place of the E prompt for a moment, and until when. */
  private flashText: string | null = null;
  private flashUntil = 0;
  private readonly frameRate = new FrameRate();
  private fpsVisible = false;
  private fpsShownAt = 0;
  private hudHidden = false;
  private readonly pointer: OfficePointer;
  private readonly speechBubbles = new SpeechBubbles(requireElement("speech-layer", HTMLElement));
  private readonly chatPanel = requireElement("chat", HTMLElement);
  private readonly dialogBox = new DialogBox(requireElement("office-dialog", HTMLElement));
  private readonly portraitCanvas = requireElement("speaker-portrait", HTMLCanvasElement);
  private readonly portrait = new SpeakerStage(this.portraitCanvas, () => undefined, portraitFraming);
  private portraitIdleSince: number | null = null;
  private chatWorking = false;
  private readonly closeupSetting = requireElement("closeup-setting", HTMLInputElement);
  private readonly menuButton = requireElement("menu-button", HTMLButtonElement);
  private readonly companionToggle = requireElement("companion-toggle", HTMLButtonElement);
  private companionVisible = true;
  private readonly dialog = requireElement("model-dialog", HTMLDialogElement);
  private readonly modelList = requireElement("model-list", HTMLUListElement);
  private readonly tracker = new ReactionTracker(Date.now());
  private readonly conversation = new Conversation();
  private conversationMode: ConversationMode = "simulated";
  private readonly loadGenerations = new Map<MemberId, number>();
  private readonly stage: OfficeStage;
  private readonly foodPicker: FoodPicker;
  private readonly models: MemberModelLoader;
  private readonly speakerModels: SpeakerModels;
  private baseHintShown = false;
  private lastCaption = "";
  private lastDialogLayout = "";

  constructor(
    private readonly bridge: RendererBridge,
    canvas: HTMLCanvasElement,
  ) {
    this.stage = new OfficeStage(canvas, () => this.tick());
    this.foodPicker = new FoodPicker(
      requireElement("food-picker", HTMLElement),
      (kind) => this.stage.orderFoodAsAlyx(kind),
      () => this.stage.foodOrderStatus(),
    );
    this.stage.setPhoneView(() => this.foodPicker.view());
    this.statusDialog = new StatusDialog(
      requireElement("status-dialog", HTMLDialogElement),
      requireElement("status-dialog-summary", HTMLElement),
      requireElement("status-dialog-rows", HTMLTableSectionElement),
      requireElement("status-dialog-close", HTMLButtonElement),
      () => this.stage.statusNow(),
    );
    this.pointer = new OfficePointer(
      canvas,
      this.stage,
      requireElement("member-tip", HTMLElement),
      () => this.statusDialog.open(),
      () => document.querySelector("dialog[open]") !== null,
    );
    this.models = new MemberModelLoader(bridge);
    this.speakerModels = new SpeakerModels(this.models, () => this.portrait.currentSpeaker());
  }

  start(): void {
    this.pointer.start();
    this.bridge
      .getFpsVisible()
      .then((visible) => this.applyFpsVisible(visible))
      .catch((error: unknown) => console.error("[office] could not read the fps setting", error));
    this.bridge.onFpsVisible((visible) => this.applyFpsVisible(visible));
    this.fpsSetting.addEventListener("change", () => this.bridge.setFpsVisible(this.fpsSetting.checked));
    this.bridge
      .getOfficeSound()
      .then((settings) => this.applyOfficeSound(settings))
      .catch((error: unknown) => console.error("[office] could not read the sound setting", error));
    this.bridge.onOfficeSound((settings) => this.applyOfficeSound(settings));
    this.soundSetting.addEventListener("change", () =>
      this.bridge.setOfficeSound({ ...this.officeSound, enabled: this.soundSetting.checked }),
    );
    // The number follows the thumb while dragging; the setting is saved once it is let go.
    this.soundVolume.addEventListener("input", () => {
      this.soundVolumeValue.textContent = `${this.soundVolume.value}%`;
    });
    this.soundVolume.addEventListener("change", () =>
      this.bridge.setOfficeSound({ ...this.officeSound, volume: Number(this.soundVolume.value) }),
    );
    this.bridge
      .getOfficeDisplay()
      .then((settings) => this.applyOfficeDisplay(settings))
      .catch((error: unknown) => console.error("[office] could not read the display setting", error));
    this.bridge.onOfficeDisplay((settings) => this.applyOfficeDisplay(settings));
    // The selects only offer valid steps; normalizing keeps a hand-edited page from slipping through.
    this.renderScaleSetting.addEventListener("change", () =>
      this.bridge.setOfficeDisplay(
        normalizeDisplaySettings({ ...this.officeDisplay, renderScale: Number(this.renderScaleSetting.value) }),
      ),
    );
    this.fpsCapSetting.addEventListener("change", () =>
      this.bridge.setOfficeDisplay(
        normalizeDisplaySettings({ ...this.officeDisplay, fpsCap: Number(this.fpsCapSetting.value) }),
      ),
    );
    // Browsers hold audio back until the page has been used, so any click or key may start it.
    for (const type of ["pointerdown", "keydown"] as const) {
      window.addEventListener(type, () => this.stage.wakeSound(), { capture: true });
    }
    this.freeCameraButton.addEventListener("click", () => this.setFreeCamera(!this.stage.freeCameraOn()));
    this.firstPersonButton.addEventListener("click", () => this.setFirstPerson(!this.stage.firstPersonOn()));
    window.addEventListener("keydown", (event) => this.handleShortcut(event));
    requireElement("status-open", HTMLButtonElement).addEventListener("click", () => this.statusDialog.open());
    this.bridge.onSignal((signal) => {
      this.conversation.handle(signal, this.conversationMode);
      if (signal.kind === "reaction") {
        this.tracker.apply(signal.reaction);
      } else if (signal.kind === "member") {
        this.stage.applyMemberSignal(signal.member);
      } else {
        const { memberId } = signal.delegation;
        // Subagents outside the roster (Explore, Plan, ...) have no desk to take a brief to.
        if (memberId !== null && memberId !== "twob") {
          this.stage.applyDelegation(memberId);
        }
      }
    });
    // The office chat's run ending (Stop, an error, or done) ends its subagents too, but a stopped
    // run sends no SubagentStop or Stop hook, so the office would show them working for minutes.
    this.bridge.onChatStatus((status) => {
      if (this.chatWorking && status.state !== "working") {
        const now = Date.now();
        this.stage.endAllRuns(now);
        this.tracker.apply(idleReaction(now));
      }
      this.chatWorking = status.state === "working";
    });
    this.bridge.onModelChanged((memberId) => {
      this.speakerModels.forget(memberId);
      this.loadSaved(memberId);
    });
    this.bridge.onServerStatus((status) => this.status.applyServerStatus(status));
    this.bridge
      .getServerStatus()
      .then((status) => this.status.applyServerStatus(status))
      .catch((error: unknown) => console.error("[office] failed to read hook server status", error));

    this.bridge.onConversationMode((mode) => {
      this.conversationMode = mode;
    });
    this.bridge
      .getConversationMode()
      .then((mode) => {
        this.conversationMode = mode;
      })
      .catch((error: unknown) => console.error("[office] failed to read conversation mode", error));

    this.bridge.onCloseupEnabled((enabled) => this.applyCloseupEnabled(enabled));
    this.bridge
      .getCloseupEnabled()
      .then((enabled) => this.applyCloseupEnabled(enabled))
      .catch((error: unknown) => console.error("[office] failed to read close-up setting", error));
    this.closeupSetting.addEventListener("change", () => this.bridge.setCloseupEnabled(this.closeupSetting.checked));

    if (this.bridge.hasNativeMenu) {
      this.companionToggle.hidden = false;
      this.companionToggle.addEventListener("click", () => this.bridge.setCompanionVisible(!this.companionVisible));
      this.bridge.onCompanionVisible((visible) => this.applyCompanionVisible(visible));
      this.bridge
        .getCompanionVisible()
        .then((visible) => this.applyCompanionVisible(visible))
        .catch((error: unknown) => console.error("[office] failed to read the companion setting", error));
      // The office's settings (resolution, frame cap, sound, ...) live in the app menu, which
      // otherwise only opens from 2B or the team overlay: hidden 2B would leave no way in.
      this.menuButton.textContent = "Pengaturan";
      this.menuButton.addEventListener("click", () => this.bridge.openMenu());
    } else {
      this.menuButton.textContent = "Model";
      this.buildModelDialog();
      this.menuButton.addEventListener("click", () => this.dialog.showModal());
    }

    for (const memberId of memberIds) {
      this.loadSaved(memberId);
    }
    this.loadCourier();
  }

  /** The courier is optional: no models/courier.vrm keeps orders appearing on the mat as before. */
  private loadCourier(): void {
    this.bridge
      .loadCourierModel()
      .then(async (file) => {
        if (file !== null) {
          this.stage.setCourier(new VrmOfficeAvatar(await loadVrm(file.bytes)));
        }
      })
      .catch((error: unknown) => {
        console.error("[office] courier model failed to load", error);
        this.status.showNotice("Model kurir gagal dimuat, pesanan tetap ditaruh di depan pintu.", Date.now());
      });
  }

  private applyCompanionVisible(visible: boolean): void {
    this.companionVisible = visible;
    this.companionToggle.textContent = visible ? "Sembunyiin 2B" : "Tampilin 2B";
  }

  private applyCloseupEnabled(enabled: boolean): void {
    this.closeupSetting.checked = enabled;
    this.stage.setCloseupEnabled(enabled);
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
    this.stage.setTwobReaction(reaction);
    this.status.render(reaction, now);
    const rect = this.layoutCloseup();
    this.renderCaption(rect);
    this.speechBubbles.render(this.stage.speechAnchors(), this.stage.closeupFocus() === null ? null : rect);
    this.renderDialog(now);
    this.pointer.refresh();
    this.statusDialog.render();
    this.renderFps();
    this.renderFirstPerson();
  }

  /** The aim dot, what E would do, and the controls or the paused note, while walking as Alyx. */
  private renderFirstPerson(): void {
    const on = this.stage.firstPersonOn();
    const walking = this.stage.firstPersonWalking();
    this.crosshair.hidden = !walking;
    const hint = walking ? firstPersonControls : firstPersonPaused;
    if (this.firstPersonHint.textContent !== hint) {
      this.firstPersonHint.textContent = hint;
    }
    this.firstPersonHint.hidden = !on;
    if (on) {
      this.foodPicker.render();
    } else {
      this.foodPicker.close();
    }
    const flashing = this.flashText !== null && performance.now() < this.flashUntil;
    const label = flashing ? null : walking ? (this.stage.firstPersonTarget()?.label ?? null) : null;
    const shown = flashing ? `!${this.flashText}` : label;
    if (shown !== this.interactLabel) {
      this.interactLabel = shown;
      if (flashing) {
        this.interactPrompt.replaceChildren(this.flashText ?? "");
      } else if (label !== null) {
        const key = document.createElement("kbd");
        key.textContent = "E";
        this.interactPrompt.replaceChildren(key, ` ${label}`);
      }
    }
    this.interactPrompt.hidden = shown === null;
  }

  /** A short note in the prompt under the aim dot, for a key that does nothing right now. */
  private flashPrompt(text: string): void {
    this.flashText = text;
    this.flashUntil = performance.now() + 2200;
  }

  /**
   * H in Alyx mode hides the frame rate, the controls line and the buttons, leaving the aim dot
   * and the E prompt so he can still use things. Leaving Alyx mode brings them all back.
   */
  private setHudHidden(hidden: boolean): void {
    this.hudHidden = hidden;
    document.documentElement.dataset.hud = hidden ? "hidden" : "shown";
  }

  private setFirstPerson(on: boolean): void {
    if (!on) {
      this.setHudHidden(false);
    }
    this.stage.setFirstPerson(on);
    if (on) {
      this.setFreeCamera(false);
    }
    this.firstPersonButton.setAttribute("aria-pressed", String(on));
  }

  private renderFps(): void {
    const at = performance.now();
    this.frameRate.tick(at);
    // Twice a second: often enough to follow, slow enough to read.
    if (!this.fpsVisible || at - this.fpsShownAt < 500) {
      return;
    }
    this.fpsShownAt = at;
    this.fpsMeter.textContent = frameLabel(
      this.frameRate.fps(),
      this.frameRate.frameMs(),
      this.stage.drawCalls(),
      this.stage.frameCpuMs(),
      this.stage.frameTeamMs(),
      this.stage.gpuName(),
    );
  }

  private applyFpsVisible(visible: boolean): void {
    this.fpsVisible = visible;
    this.fpsMeter.hidden = !visible;
    this.fpsSetting.checked = visible;
    this.fpsShownAt = 0;
  }

  private applyOfficeDisplay(settings: OfficeDisplaySettings): void {
    this.officeDisplay = settings;
    this.renderScaleSetting.value = String(settings.renderScale);
    this.fpsCapSetting.value = String(settings.fpsCap);
    this.stage.setDisplay(settings);
  }

  private applyOfficeSound(settings: OfficeSoundSettings): void {
    this.officeSound = settings;
    this.soundSetting.checked = settings.enabled;
    this.soundVolume.value = String(settings.volume);
    this.soundVolumeValue.textContent = `${settings.volume}%`;
    this.stage.setSound(settings);
  }

  private setFreeCamera(on: boolean): void {
    if (on) {
      this.stage.setFirstPerson(false);
      this.firstPersonButton.setAttribute("aria-pressed", "false");
    }
    this.stage.setFreeCamera(on);
    this.freeCameraButton.setAttribute("aria-pressed", String(on));
    this.cameraHint.hidden = !on;
  }

  /**
   * F shows or hides the frame rate; in Alyx mode H hides the interface and I opens the food list.
   * Escape leaves the free camera. Never while typing or in a dialog.
   */
  private handleShortcut(event: KeyboardEvent): void {
    const target = event.target;
    const typing =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable);
    if (typing || document.querySelector("dialog[open]") !== null || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (this.foodPicker.handleKey(event)) {
      event.preventDefault();
    } else if (event.code === "KeyI" && this.stage.firstPersonOn()) {
      event.preventDefault();
      if (this.stage.canOpenFoodApp()) {
        this.foodPicker.toggle();
      } else {
        // The phone stays away while there is still food on the bar.
        this.flashPrompt("Masih ada makanan di bar");
      }
    } else if (event.code === "KeyF") {
      event.preventDefault();
      this.bridge.setFpsVisible(!this.fpsVisible);
    } else if (event.code === "KeyH" && this.stage.firstPersonOn()) {
      event.preventDefault();
      this.setHudHidden(!this.hudHidden);
    } else if (event.key === "Escape" && this.stage.freeCameraOn()) {
      this.setFreeCamera(false);
    } else if (event.key === "Escape" && this.stage.firstPersonOn() && !this.stage.firstPersonWalking()) {
      // The first Esc only frees the mouse (the browser's own rule); the next one leaves.
      this.setFirstPerson(false);
    }
  }

  /**
   * Docks the close-up on the chat panel. While the close-up shows, the chat gives up some height
   * (its log scrolls) so both fit in the window.
   */
  private layoutCloseup(): CloseupRect {
    const showing = this.stage.closeupFocus() !== null;
    const state = showing ? "on" : "off";
    if (this.chatPanel.dataset.closeup !== state) {
      this.chatPanel.dataset.closeup = state;
    }
    let chat: CloseupRect | null = null;
    if (!this.chatPanel.hidden) {
      const box = this.chatPanel.getBoundingClientRect();
      chat = { x: box.left, y: box.top, width: box.width, height: box.height };
    }
    const rect = closeupRect(window.innerWidth, window.innerHeight, chat);
    this.stage.setCloseupLayout(rect);
    return rect;
  }

  /** Top right, with the speaker's portrait above it, so the left side stays for the chat and close-up. */
  private renderDialog(now: number): void {
    const current = this.conversation.current(now);
    const started = this.dialogBox.render(current, now);
    this.renderPortrait(current, started, now);
    if (current === null) {
      return;
    }
    const dock = teamDialogDock(window.innerWidth);
    const layout = `${dock.dialog.x}|${dock.dialog.y}|${dock.dialog.width}`;
    if (layout !== this.lastDialogLayout) {
      this.lastDialogLayout = layout;
      const style = this.dialogBox.root.style;
      style.left = `${dock.dialog.x}px`;
      style.top = `${dock.dialog.y}px`;
      style.width = `${dock.dialog.width}px`;
      const portrait = this.portraitCanvas.style;
      portrait.left = `${dock.portrait.x}px`;
      portrait.top = `${dock.portrait.y}px`;
      portrait.width = `${portraitSize.width}px`;
      portrait.height = `${portraitSize.height}px`;
    }
  }

  /** The speaker's face above the dialog: same line, same clock, so lips match the typewriter text. */
  private renderPortrait(current: { line: DialogLine; startedAt: number } | null, started: boolean, now: number): void {
    this.portrait.setLine(current);
    if (current === null) {
      this.portraitCanvas.hidden = true;
      this.portraitIdleSince ??= now;
      const onStage = this.portrait.currentSpeaker();
      if (onStage !== null && now - this.portraitIdleSince >= portraitHoldMs) {
        // Nothing to say for a while: take the model off stage so the portrait stops rendering.
        this.portrait.setSpeaker(onStage, null);
      }
      return;
    }
    this.portraitIdleSince = null;
    const memberId = current.line.memberId;
    this.portraitCanvas.hidden = this.portrait.currentSpeaker() !== memberId;
    if (started && this.portrait.currentSpeaker() !== memberId) {
      this.speakerModels
        .modelFor(memberId)
        .then((vrm) => {
          // Only swap if this member is still the one talking when the model arrives.
          if (this.conversation.current(Date.now())?.line.memberId === memberId) {
            this.portrait.setSpeaker(memberId, vrm);
            this.portraitCanvas.hidden = vrm === null;
          }
        })
        .catch((error: unknown) => console.error(`[office] could not show ${memberId} above the dialog`, error));
    }
  }

  private renderCaption(rect: CloseupRect): void {
    const focus = this.stage.closeupFocus();
    if (focus === null) {
      if (!this.caption.hidden) {
        this.caption.hidden = true;
        this.lastCaption = "";
      }
      return;
    }
    const key = `${focus.label}|${rect.x}|${rect.y}|${rect.width}`;
    if (key === this.lastCaption) {
      return;
    }
    this.lastCaption = key;
    this.caption.hidden = false;
    this.caption.textContent = `${focus.label} · simulated screen`;
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
// Started before the 3D scene, so the chat and the music still work on a machine where WebGL fails.
const chatShown = new ChatPanel(bridge).start();
new MusicPanel().start();
// Materials read the quality as they are built, so it has to be known before the office exists.
const quality = bridge.getOfficeQuality().catch((error: unknown) => {
  console.error("[office] could not read the graphics quality, using low", error);
  return "low" as const;
});
/** Resolves after the browser has painted, so what is on the page now is on screen before a long task. */
function afterPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

// Building the room holds the page for a few seconds on slow graphics, so the chat shows its
// saved state and gets painted first, instead of the window staying blank until the room is up.
// The bar's food and drinks are small models; they load alongside, and one that fails is logged and left out.
const foodModels = loadFoodModels();
const furnitureModels = loadFurnitureModels();
Promise.all([quality, chatShown, foodModels, furnitureModels])
  .then(async ([chosen]) => {
    await afterPaint();
    setSceneQuality(chosen);
    new OfficePage(bridge, canvas).start();
    // Hook signals are only listened to from here on: anything that drives the office waits for this.
    document.documentElement.dataset.office = "ready";
  })
  .catch((error: unknown) => {
    console.error("[office] failed to start the office scene", error);
  });
