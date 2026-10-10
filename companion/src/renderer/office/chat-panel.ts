import type { ChatEvent, ChatStatus } from "../../shared/office-chat.js";
import type { RendererBridge } from "../common/bridge.js";
import { requireElement } from "../common/status-chip.js";
import { type ChatEntry, ChatLog, folderName } from "./chat-log.js";

/**
 * The office chat: type a task for 2B, watch the reply stream in, and allow or
 * deny each tool call that needs permission. Electron only; the browser page
 * keeps it hidden because the chat runs Claude Code on this machine.
 */
export class ChatPanel {
  private readonly root = requireElement("chat", HTMLElement);
  private readonly toggle = requireElement("chat-toggle", HTMLButtonElement);
  private readonly folderButton = requireElement("chat-folder", HTMLButtonElement);
  private readonly newButton = requireElement("chat-new", HTMLButtonElement);
  private readonly problem = requireElement("chat-problem", HTMLElement);
  private readonly empty = requireElement("chat-empty", HTMLElement);
  private readonly list = requireElement("chat-log", HTMLOListElement);
  private readonly working = requireElement("chat-working", HTMLElement);
  private readonly form = requireElement("chat-form", HTMLFormElement);
  private readonly input = requireElement("chat-input", HTMLTextAreaElement);
  private readonly sendButton = requireElement("chat-send", HTMLButtonElement);
  private readonly stopButton = requireElement("chat-stop", HTMLButtonElement);
  private readonly announcer = requireElement("chat-announce", HTMLElement);
  private readonly log = new ChatLog();
  private readonly items: HTMLLIElement[] = [];
  private status: ChatStatus = { state: "idle", projectDir: null, problem: null };
  private enabled = false;

  constructor(private readonly bridge: RendererBridge) {}

  start(): void {
    if (!this.bridge.hasNativeMenu) {
      return;
    }
    this.toggle.hidden = false;
    this.toggle.addEventListener("click", () => this.bridge.setChatEnabled(!this.enabled));
    this.folderButton.addEventListener("click", () => {
      this.bridge
        .pickChatProject()
        .then((folder) => {
          if (folder !== null) {
            this.resetLog();
          }
        })
        .catch((error: unknown) => this.showLocalError("Gagal milih folder", error));
    });
    this.newButton.addEventListener("click", () => {
      this.bridge.newChat();
      this.resetLog();
      this.input.focus();
    });
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.submit();
    });
    // Enter sends, Shift+Enter adds a line, the way chat boxes usually behave.
    this.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        this.submit();
      }
    });
    this.stopButton.addEventListener("click", () => this.bridge.stopChat());

    this.bridge.onChatEnabled((enabled) => this.applyEnabled(enabled));
    this.bridge.onChatStatus((status) => this.applyStatus(status));
    this.bridge.onChatEvent((event) => this.applyEvent(event, true));
    Promise.all([this.bridge.getChatEnabled(), this.bridge.getChatStatus(), this.bridge.getChatHistory()])
      .then(([enabled, status, history]) => {
        this.applyEnabled(enabled);
        this.applyStatus(status);
        for (const event of history) {
          this.applyEvent(event, false);
        }
      })
      .catch((error: unknown) => this.showLocalError("Chat gagal dimuat", error));
    this.render();
  }

  private submit(): void {
    const text = this.input.value.trim();
    if (text === "" || this.status.state !== "idle") {
      return;
    }
    this.bridge.sendChat(text);
    this.input.value = "";
  }

  private applyEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.root.hidden = !enabled;
    this.toggle.textContent = enabled ? "Tutup chat" : "Buka chat";
    this.toggle.setAttribute("aria-expanded", String(enabled));
  }

  private applyStatus(status: ChatStatus): void {
    this.status = status;
    this.render();
  }

  private applyEvent(event: ChatEvent, live: boolean): void {
    const index = this.log.apply(event);
    if (index !== null) {
      this.renderEntry(index);
      if (live && event.kind === "permission") {
        // The card is what needs the user now: bring it into view and put keyboard focus on the
        // card itself, one Tab away from Izinkan, so a stray Enter never approves anything.
        this.items[index]?.focus();
      }
    }
    if (live) {
      this.announce(event);
    }
    this.render();
  }

  private resetLog(): void {
    this.log.clear();
    for (const item of this.items) {
      item.remove();
    }
    this.items.length = 0;
    this.render();
  }

  private announce(event: ChatEvent): void {
    if (event.kind === "permission") {
      this.announcer.textContent = `2B minta izin pakai ${event.ask.toolName}: ${event.ask.summary}`;
    } else if (event.kind === "done") {
      this.announcer.textContent = event.ok ? "2B selesai." : `2B berhenti. ${event.message ?? ""}`;
    } else if (event.kind === "error") {
      this.announcer.textContent = event.message;
    }
  }

  private render(): void {
    const { state, projectDir, problem } = this.status;
    const folder = projectDir === null ? null : folderName(projectDir);
    const busy = state === "working";

    this.folderButton.textContent = folder === null ? "Pilih folder" : `Folder: ${folder}`;
    this.folderButton.title = projectDir ?? "Folder project tempat 2B kerja";
    this.folderButton.disabled = busy;
    this.newButton.disabled = busy || this.log.entries.length === 0;

    this.problem.hidden = problem === null;
    this.problem.textContent = problem ?? "";

    this.empty.hidden = this.log.entries.length > 0 || problem !== null;
    this.empty.textContent =
      folder === null
        ? "Pilih folder project dulu. 2B kerja dan minta izin di folder itu."
        : `Belum ada obrolan. Ketik tugas, 2B kerjain di folder ${folder}.`;

    this.working.hidden = !busy;
    this.working.textContent = folder === null ? "" : `2B lagi kerja di ${folder}.`;

    const ready = state === "idle" && projectDir !== null;
    this.input.disabled = state === "unavailable" || projectDir === null;
    this.sendButton.hidden = busy;
    this.sendButton.disabled = !ready;
    this.stopButton.hidden = !busy;
  }

  private renderEntry(index: number): void {
    const entry = this.log.entries[index] as ChatEntry;
    let item = this.items[index];
    if (item === undefined) {
      item = document.createElement("li");
      this.items[index] = item;
      this.list.append(item);
    }
    const nearBottom = this.list.scrollHeight - this.list.scrollTop - this.list.clientHeight < 40;
    item.replaceChildren();
    item.className = "chat-entry";
    item.removeAttribute("tabindex");
    switch (entry.type) {
      case "user":
      case "reply": {
        const speaker = document.createElement("span");
        speaker.className = "chat-speaker";
        speaker.textContent = entry.type === "user" ? "Lo" : "2B";
        item.append(speaker, entry.text);
        break;
      }
      case "note":
        item.classList.add("chat-note");
        item.dataset.tone = entry.tone;
        item.textContent = entry.text;
        break;
      case "permission":
        this.renderPermission(item, entry);
        break;
    }
    // Follow new content only when the reader is already at the end, so scrolling back stays put.
    if (nearBottom) {
      this.list.scrollTop = this.list.scrollHeight;
    }
  }

  private renderPermission(item: HTMLLIElement, entry: Extract<ChatEntry, { type: "permission" }>): void {
    const { ask, state } = entry;
    if (state !== "open") {
      item.classList.add("chat-note");
      item.dataset.tone = "muted";
      item.textContent = `${state === "allowed" ? "Diizinkan" : "Ditolak"}, ${ask.toolName}: ${ask.summary}`;
      return;
    }
    item.classList.add("chat-permission");
    // Focusable as a whole so keyboard users land on the card, never straight on "Izinkan".
    item.tabIndex = -1;
    const title = document.createElement("p");
    title.className = "chat-permission-title";
    title.textContent = `2B minta izin pakai ${ask.toolName}`;
    const detail = document.createElement("pre");
    detail.textContent = ask.detail;
    const actions = document.createElement("div");
    actions.className = "chat-permission-actions";
    const allow = document.createElement("button");
    allow.type = "button";
    allow.className = "button allow";
    allow.textContent = "Izinkan";
    allow.addEventListener("click", () => this.bridge.answerPermission(ask.id, true));
    const deny = document.createElement("button");
    deny.type = "button";
    deny.className = "button";
    deny.textContent = "Tolak";
    deny.addEventListener("click", () => this.bridge.answerPermission(ask.id, false));
    actions.append(allow, deny);
    item.append(title, detail, actions);
  }

  private showLocalError(context: string, error: unknown): void {
    console.error(`[chat] ${context}`, error);
    const message = error instanceof Error ? error.message : String(error);
    this.applyEvent({ kind: "error", message: `${context}: ${message}` }, true);
  }
}
