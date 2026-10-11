import { type CompanionPose, type PoseCommand, parsePoseCommand } from "../../shared/companion-pose.js";
import { crisisNote, looksLikeCrisis, type TwobStatus } from "../../shared/twob-chat.js";
import type { RendererBridge } from "../common/bridge.js";
import { ipcErrorMessage } from "../common/ipc-error.js";
import { requireElement } from "../common/status-chip.js";

/** How a pose reads in the log, so the user sees what 2B just did on the desktop. */
const poseLabels: Record<CompanionPose, string> = {
  "raise-hand": "angkat tangan",
  ponder: "merenung",
  wave: "dadah",
  peace: "peace",
  "thumbs-up": "jempol",
  "cross-arms": "silang tangan",
  clap: "tepuk tangan",
  "scratch-head": "garuk kepala",
  stretch: "ngulet",
  tongue: "melet",
};

const faceLabels: Record<NonNullable<PoseCommand["face"]>, string> = {
  smile: "senyum",
  pout: "cemberut",
  surprised: "kaget",
  sad: "sedih",
  angry: "marah",
  sleepy: "ngantuk",
};

export function poseNote(command: PoseCommand): string {
  const parts = [
    command.pose === null ? null : poseLabels[command.pose],
    command.face === null ? null : faceLabels[command.face],
  ].filter((part): part is string => part !== null);
  return `2B ${parts.join(", ")} di desktop.`;
}

export interface TwobPanelHost {
  /** Sesi 2B started or ended: the chat panel swaps its header, log and placeholder. */
  modeChanged(active: boolean): void;
  /** Moves focus back to the message box. */
  focusInput(): void;
  /** Shows an error in the main chat log, for failures before the session (and its log) exists. */
  reportError(message: string): void;
}

/**
 * Sesi 2B in the office chat: 2B's own conversation through the user's Groq key. Messages
 * here never reach Claude Code. The log lives only in this page and is cleared when the
 * session ends.
 */
export class TwobChatPanel {
  private readonly log = requireElement("twob-log", HTMLOListElement);
  private readonly keyForm = requireElement("twob-key", HTMLFormElement);
  private readonly keyInput = requireElement("twob-key-input", HTMLInputElement);
  private readonly keyError = requireElement("twob-key-error", HTMLElement);
  private readonly keyCancel = requireElement("twob-key-cancel", HTMLButtonElement);
  private readonly keySave = requireElement("twob-key-save", HTMLButtonElement);
  private readonly modelButton = requireElement("twob-model-open", HTMLButtonElement);
  private readonly modelDialog = requireElement("twob-models", HTMLDialogElement);
  private readonly modelState = requireElement("twob-models-state", HTMLElement);
  private readonly modelList = requireElement("twob-model-list", HTMLUListElement);
  private active = false;
  private busy = false;
  /** A message typed before the key was set, sent once the session starts. */
  private pending: string | null = null;

  constructor(
    private readonly bridge: RendererBridge,
    private readonly host: TwobPanelHost,
  ) {}

  start(): void {
    this.keyForm.addEventListener("submit", (event) => {
      event.preventDefault();
      this.saveKey();
    });
    this.keyCancel.addEventListener("click", () => {
      this.keyForm.hidden = true;
      this.pending = null;
      this.host.focusInput();
    });
    this.modelButton.addEventListener("click", () => this.openModels());
    this.bridge.onTwobKeyRequested(() => this.showKeyForm(null));
  }

  isActive(): boolean {
    return this.active;
  }

  isBusy(): boolean {
    return this.busy;
  }

  /** Starts Sesi 2B, asking for a key first when there is none, then sends `firstMessage` if any. */
  begin(firstMessage: string): void {
    this.bridge
      .getTwobStatus()
      .then((status) => {
        if (status.keySource === null) {
          this.showKeyForm(firstMessage);
          return;
        }
        return this.enter(status, firstMessage);
      })
      .catch((error: unknown) => this.host.reportError(`Sesi 2B gagal dimulai: ${ipcErrorMessage(error)}`));
  }

  /** A message typed while Sesi 2B is on: a pose request is handled here, anything else goes to Groq. */
  send(text: string): void {
    const command = parsePoseCommand(text);
    this.entry("user", text);
    if (command !== null) {
      this.bridge.performCompanionCommand({ ...command, line: null });
      this.note(poseNote(command));
      return;
    }
    if (looksLikeCrisis(text)) {
      this.note(crisisNote, "crisis");
    }
    this.setBusy(true);
    this.bridge
      .sendTwob(text)
      .then((reply) => this.entry("twob", reply.text))
      .catch((error: unknown) => this.error(ipcErrorMessage(error)))
      .finally(() => this.setBusy(false));
  }

  /** Ends the session and forgets it: the log is cleared and main drops the conversation. */
  end(): void {
    if (!this.active) {
      return;
    }
    this.bridge.endTwob();
    this.active = false;
    this.log.replaceChildren();
    this.log.hidden = true;
    this.keyForm.hidden = true;
    this.host.modeChanged(false);
  }

  private async enter(status: TwobStatus, firstMessage: string): Promise<void> {
    await this.bridge.startTwob();
    this.active = true;
    this.log.hidden = false;
    this.keyForm.hidden = true;
    this.host.modeChanged(true);
    const source = status.keySource === "env" ? "key dari GROQ_API_KEY" : "key Groq lo";
    this.note(`Sesi 2B mulai, pakai ${source} dengan model ${status.model}. Pesan di sini nggak lewat Claude.`);
    if (firstMessage !== "") {
      this.send(firstMessage);
    } else {
      this.host.focusInput();
    }
  }

  private showKeyForm(pending: string | null): void {
    this.pending = pending;
    this.keyError.hidden = true;
    this.keyInput.value = "";
    this.keyForm.hidden = false;
    this.keyInput.focus();
  }

  private saveKey(): void {
    this.keySave.disabled = true;
    this.bridge
      .saveTwobKey(this.keyInput.value)
      .then((status) => {
        this.keyInput.value = "";
        this.keyForm.hidden = true;
        const pending = this.pending;
        this.pending = null;
        if (this.active) {
          this.note("API key Groq disimpan.");
          return;
        }
        if (pending !== null) {
          return this.enter(status, pending);
        }
        this.host.focusInput();
      })
      .catch((error: unknown) => {
        this.keyError.textContent = ipcErrorMessage(error);
        this.keyError.hidden = false;
      })
      .finally(() => {
        this.keySave.disabled = false;
      });
  }

  private openModels(): void {
    this.modelList.replaceChildren();
    this.modelState.textContent = "Lagi ambil daftar model dari Groq...";
    this.modelState.dataset.tone = "muted";
    this.modelDialog.showModal();
    Promise.all([this.bridge.listTwobModels(), this.bridge.getTwobStatus()])
      .then(([models, status]) => {
        if (models.length === 0) {
          this.modelState.textContent = "Akun Groq lo belum punya model chat yang bisa dipakai.";
          return;
        }
        this.modelState.textContent = "";
        for (const model of models) {
          const item = document.createElement("li");
          const button = document.createElement("button");
          button.type = "button";
          button.className = "button";
          button.textContent = model === status.model ? `${model} (dipakai sekarang)` : model;
          button.disabled = model === status.model;
          button.addEventListener("click", () => this.pickModel(model));
          item.append(button);
          this.modelList.append(item);
        }
        this.modelList.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
      })
      .catch((error: unknown) => {
        this.modelState.textContent = `Gagal ambil daftar model: ${ipcErrorMessage(error)}`;
        this.modelState.dataset.tone = "error";
      });
  }

  private pickModel(model: string): void {
    this.bridge
      .setTwobModel(model)
      .then(() => {
        this.modelDialog.close();
        this.note(`Model ganti ke ${model}.`);
        this.host.focusInput();
      })
      .catch((error: unknown) => {
        this.modelState.textContent = `Gagal ganti model: ${ipcErrorMessage(error)}`;
        this.modelState.dataset.tone = "error";
      });
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.host.modeChanged(this.active);
  }

  private entry(speaker: "user" | "twob", text: string): void {
    const item = document.createElement("li");
    item.className = "chat-entry";
    const name = document.createElement("span");
    name.className = "chat-speaker";
    name.textContent = speaker === "user" ? "Lo" : "2B";
    item.append(name, text);
    this.append(item);
  }

  private note(text: string, tone: "muted" | "crisis" = "muted"): void {
    const item = document.createElement("li");
    item.className = tone === "crisis" ? "chat-permission twob-crisis" : "chat-entry chat-note";
    item.textContent = text;
    this.append(item);
  }

  private error(text: string): void {
    const item = document.createElement("li");
    item.className = "chat-entry chat-note";
    item.dataset.tone = "error";
    item.textContent = text;
    this.append(item);
  }

  private append(item: HTMLLIElement): void {
    const nearBottom = this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight < 40;
    this.log.append(item);
    if (nearBottom) {
      this.log.scrollTop = this.log.scrollHeight;
    }
  }
}
