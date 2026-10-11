import "../common/base.css";
import "./team-overlay.css";
import type { ConversationMode } from "../../shared/protocol.js";
import type { MemberId } from "../../shared/team.js";
import { getBridge, type RendererBridge } from "../common/bridge.js";
import { Conversation } from "../common/conversation.js";
import { DialogBox } from "../common/dialog-box.js";
import { MemberModelLoader } from "../common/member-model.js";
import { SpeakerModels } from "../common/speaker-models.js";
import { SpeakerStage } from "../common/speaker-stage.js";
import { requireElement } from "../common/status-chip.js";

/** Stay visible briefly after the last line so the window does not flicker between lines. */
const hideAfterIdleMs = 1500;

class TeamOverlayPage {
  private readonly stageElement = requireElement("stage", HTMLElement);
  private readonly dialog = new DialogBox(requireElement("dialog", HTMLElement));
  private readonly modeToggle = requireElement("mode-toggle", HTMLButtonElement);
  private readonly empty = requireElement("empty", HTMLElement);
  private readonly conversation = new Conversation();
  private readonly models: SpeakerModels;
  private readonly stage: SpeakerStage;
  private mode: ConversationMode = "simulated";
  private idleSince: number | null = Date.now();
  private visible = false;

  constructor(
    private readonly bridge: RendererBridge,
    canvas: HTMLCanvasElement,
  ) {
    this.stage = new SpeakerStage(canvas, () => this.tick());
    this.models = new SpeakerModels(new MemberModelLoader(bridge), () => this.stage.currentSpeaker());
  }

  start(): void {
    this.bridge.onSignal((signal) => this.conversation.handle(signal, this.mode));
    this.bridge.onConversationMode((mode) => this.applyMode(mode));
    this.bridge
      .getConversationMode()
      .then((mode) => this.applyMode(mode))
      .catch((error: unknown) => console.error("[team] failed to read conversation mode", error));
    this.bridge.onModelChanged((memberId) => this.models.forget(memberId));
    this.modeToggle.addEventListener("click", () => {
      this.bridge.setConversationMode(this.mode === "real" ? "simulated" : "real");
    });
    this.bridge.setTeamOverlayVisible(false);
  }

  private applyMode(mode: ConversationMode): void {
    this.mode = mode;
    const real = mode === "real";
    this.modeToggle.setAttribute("aria-pressed", String(real));
    this.modeToggle.textContent = real ? "Isi asli: nyala" : "Isi asli: mati";
  }

  private showSpeaker(memberId: MemberId): void {
    this.models
      .modelFor(memberId)
      .then((vrm) => {
        // Only swap if this member is still the one talking when the model arrives.
        if (this.conversation.current(Date.now())?.line.memberId === memberId) {
          this.stage.setSpeaker(memberId, vrm);
        }
      })
      .catch((error: unknown) => console.error(`[team] could not show ${memberId}`, error));
  }

  private setVisible(visible: boolean): void {
    if (visible !== this.visible) {
      this.visible = visible;
      this.bridge.setTeamOverlayVisible(visible);
    }
  }

  private tick(): void {
    const now = Date.now();
    const current = this.conversation.current(now);
    this.stage.setLine(current);

    if (current === null) {
      this.idleSince ??= now;
      this.dialog.render(null, now);
      this.stageElement.dataset.state = "idle";
      if (now - this.idleSince >= hideAfterIdleMs) {
        this.setVisible(false);
        // In the browser fallback nothing hides the page, so clear the speaker too.
        if (this.stage.currentSpeaker() !== null) {
          this.stage.setSpeaker(this.stage.currentSpeaker() as MemberId, null);
          this.empty.textContent = "Lagi nggak ada yang ngomong.";
        }
      }
      return;
    }

    this.idleSince = null;
    this.setVisible(true);
    this.stageElement.dataset.state = "speaking";
    if (this.dialog.render(current, now) && this.stage.currentSpeaker() !== current.line.memberId) {
      this.showSpeaker(current.line.memberId);
    }
  }
}

const bridge = getBridge();
document.documentElement.dataset.shell = bridge.hasNativeMenu ? "electron" : "web";
const canvas = document.getElementById("scene");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("#scene canvas is missing");
}
new TeamOverlayPage(bridge, canvas).start();
