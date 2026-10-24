import "../common/base.css";
import "./office.css";
import type { ConversationMode } from "../../shared/protocol.js";
import { idleReaction } from "../../shared/reaction.js";
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
import { MusicPanel } from "./music-panel.js";
import { type CloseupRect, closeupRect, OfficeStage, portraitSize, teamDialogDock } from "./office-stage.js";
import { setSceneQuality } from "./scene/palette.js";
import { SpeechBubbles } from "./speech-bubbles.js";

/** Head and shoulders: the portrait is small, so the face has to fill it. */
const portraitFraming: SpeakerFraming = { height: 0.55, drop: 0.06 };
/** Keep the portrait loaded briefly after a line, so back-to-back lines do not flicker. */
const portraitHoldMs = 1500;

class OfficePage {
  private readonly status = new StatusChip(requireElement("status", HTMLElement));
  private readonly caption = requireElement("closeup-caption", HTMLElement);
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
    this.models = new MemberModelLoader(bridge);
    this.speakerModels = new SpeakerModels(this.models, () => this.portrait.currentSpeaker());
  }

  start(): void {
    this.bridge.onSignal((signal) => {
      this.conversation.handle(signal, this.conversationMode);
      if (signal.kind === "reaction") {
        this.tracker.apply(signal.reaction);
      } else if (signal.kind === "member") {
        this.stage.applyMemberSignal(signal.member);
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
      // 2B's own Menu button and a right-click anywhere in the office open the same menu,
      // so a second Menu button in the office HUD only crowded the corner.
      this.menuButton.hidden = true;
    } else {
      this.menuButton.textContent = "Model";
      this.buildModelDialog();
      this.menuButton.addEventListener("click", () => this.dialog.showModal());
    }

    for (const memberId of memberIds) {
      this.loadSaved(memberId);
    }
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
new ChatPanel(bridge).start();
new MusicPanel().start();
// Materials read the quality as they are built, so it has to be known before the office exists.
bridge
  .getOfficeQuality()
  .catch((error: unknown) => {
    console.error("[office] could not read the graphics quality, using low", error);
    return "low" as const;
  })
  .then((quality) => {
    setSceneQuality(quality);
    new OfficePage(bridge, canvas).start();
  })
  .catch((error: unknown) => {
    console.error("[office] failed to start the office scene", error);
  });
