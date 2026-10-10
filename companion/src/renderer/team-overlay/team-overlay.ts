import "../common/base.css";
import "./team-overlay.css";
import type { VRM } from "@pixiv/three-vrm";
import type { ConversationMode } from "../../shared/protocol.js";
import { type MemberId, roster } from "../../shared/team.js";
import { getBridge, type RendererBridge } from "../common/bridge.js";
import { Conversation, revealCharsPerSecond } from "../common/conversation.js";
import { MemberModelLoader } from "../common/member-model.js";
import { requireElement } from "../common/status-chip.js";
import { disposeVrm } from "../common/vrm-loader.js";
import { TeamOverlayStage } from "./team-overlay-stage.js";

const speakerColors: Record<MemberId, string> = {
  konan: "#a9b4ff",
  chizuru: "#e8c39a",
  rias: "#ff9ec4",
  asuna: "#f4b07a",
  kobayashi: "#f09a84",
  yor: "#f2d27a",
  erza: "#f58f8f",
};

/** Models are 10 MB each; keep only the few most recent speakers in memory. */
const maxCachedModels = 3;
/** Stay visible briefly after the last line so the window does not flicker between lines. */
const hideAfterIdleMs = 1500;

class TeamOverlayPage {
  private readonly stageElement = requireElement("stage", HTMLElement);
  private readonly dialog = requireElement("dialog", HTMLElement);
  private readonly dialogName = requireElement("dialog-name", HTMLElement);
  private readonly dialogText = requireElement("dialog-text", HTMLElement);
  private readonly dialogTag = requireElement("dialog-tag", HTMLElement);
  private readonly modeToggle = requireElement("mode-toggle", HTMLButtonElement);
  private readonly empty = requireElement("empty", HTMLElement);
  private readonly conversation = new Conversation();
  private readonly models: MemberModelLoader;
  private readonly cache = new Map<MemberId, Promise<VRM | null>>();
  private readonly stage: TeamOverlayStage;
  private mode: ConversationMode = "simulated";
  private shownLineId: number | null = null;
  private lastRenderedText = "";
  private idleSince: number | null = Date.now();
  private visible = false;

  constructor(
    private readonly bridge: RendererBridge,
    canvas: HTMLCanvasElement,
  ) {
    this.models = new MemberModelLoader(bridge);
    this.stage = new TeamOverlayStage(canvas, () => this.tick());
  }

  start(): void {
    this.bridge.onSignal((signal) => this.conversation.handle(signal, this.mode));
    this.bridge.onConversationMode((mode) => this.applyMode(mode));
    this.bridge
      .getConversationMode()
      .then((mode) => this.applyMode(mode))
      .catch((error: unknown) => console.error("[team] failed to read conversation mode", error));
    this.bridge.onModelChanged((memberId) => this.forget(memberId));
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

  private forget(memberId: MemberId): void {
    const cached = this.cache.get(memberId);
    this.cache.delete(memberId);
    cached
      ?.then((vrm) => {
        if (vrm !== null && this.stage.currentSpeaker() !== memberId) {
          disposeVrm(vrm);
        }
      })
      .catch((error: unknown) => console.error(`[team] failed to release model for ${memberId}`, error));
  }

  private modelFor(memberId: MemberId): Promise<VRM | null> {
    const cached = this.cache.get(memberId);
    if (cached !== undefined) {
      // Re-insert to mark as most recently used.
      this.cache.delete(memberId);
      this.cache.set(memberId, cached);
      return cached;
    }
    const loading = this.models
      .load(memberId)
      .then((loaded) => loaded?.vrm ?? null)
      .catch((error: unknown) => {
        console.error(`[team] model for ${memberId} failed to load`, error);
        return null;
      });
    this.cache.set(memberId, loading);
    while (this.cache.size > maxCachedModels) {
      const oldest = this.cache.keys().next().value as MemberId;
      this.forget(oldest);
    }
    return loading;
  }

  private showSpeaker(memberId: MemberId): void {
    this.modelFor(memberId)
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
      this.dialog.hidden = true;
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
    const { line, startedAt } = current;
    if (line.id !== this.shownLineId) {
      this.shownLineId = line.id;
      if (this.stage.currentSpeaker() !== line.memberId) {
        this.showSpeaker(line.memberId);
      }
      const profile = roster[line.memberId];
      this.dialog.hidden = false;
      this.dialog.style.setProperty("--speaker", speakerColors[line.memberId]);
      this.dialogName.textContent = profile.displayName;
      const role = document.createElement("span");
      role.textContent = profile.role;
      this.dialogName.append(role);
      this.dialogTag.hidden = !line.simulated;
    }

    // Typewriter reveal, in step with the lip-sync in the stage.
    const revealed = Math.min(line.text.length, Math.floor(((now - startedAt) / 1000) * revealCharsPerSecond));
    const text = line.text.slice(0, revealed);
    if (text !== this.lastRenderedText) {
      this.lastRenderedText = text;
      this.dialogText.textContent = text;
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
