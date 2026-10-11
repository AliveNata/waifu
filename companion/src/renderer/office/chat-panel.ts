import { type ChatEvent, type ChatSessionList, type ChatStatus, twobMessage } from "../../shared/office-chat.js";
import type { RendererBridge } from "../common/bridge.js";
import { requireElement } from "../common/status-chip.js";
import { type ChatEntry, ChatLog, folderName, relativeTimeLabel } from "./chat-log.js";
import { MentionPicker } from "./mention-picker.js";
import { TwobChatPanel } from "./twob-chat-panel.js";

const claudePlaceholder = "Tugas buat 2B, atau @ buat manggil tim";
const twobPlaceholder = "Cerita ke 2B, atau suruh dia pose (misal: angkat tangan)";

/**
 * The office chat: type a task for 2B, watch the reply stream in, and allow or
 * deny each tool call that needs permission. Electron only; the browser page
 * keeps it hidden because the chat runs Claude Code on this machine.
 */
export class ChatPanel {
  private readonly root = requireElement("chat", HTMLElement);
  private readonly toggle = requireElement("chat-toggle", HTMLButtonElement);
  private readonly title = requireElement("chat-title", HTMLElement);
  private readonly twobBadge = requireElement("twob-badge", HTMLElement);
  private readonly twobModel = requireElement("twob-model-open", HTMLButtonElement);
  private readonly twobEnd = requireElement("twob-end", HTMLButtonElement);
  private readonly folderButton = requireElement("chat-folder", HTMLButtonElement);
  private readonly newButton = requireElement("chat-new", HTMLButtonElement);
  private readonly sessionsButton = requireElement("chat-sessions-open", HTMLButtonElement);
  private readonly sessionsDialog = requireElement("chat-sessions", HTMLDialogElement);
  private readonly sessionsState = requireElement("chat-sessions-state", HTMLElement);
  private readonly sessionList = requireElement("chat-session-list", HTMLUListElement);
  private readonly problem = requireElement("chat-problem", HTMLElement);
  private readonly empty = requireElement("chat-empty", HTMLElement);
  private readonly list = requireElement("chat-log", HTMLOListElement);
  private readonly working = requireElement("chat-working", HTMLElement);
  private readonly form = requireElement("chat-form", HTMLFormElement);
  private readonly input = requireElement("chat-input", HTMLTextAreaElement);
  private readonly sendButton = requireElement("chat-send", HTMLButtonElement);
  private readonly stopButton = requireElement("chat-stop", HTMLButtonElement);
  private readonly announcer = requireElement("chat-announce", HTMLElement);
  private readonly mentions = new MentionPicker(this.input, requireElement("chat-mentions", HTMLUListElement));
  private readonly log = new ChatLog();
  private readonly items: HTMLLIElement[] = [];
  private status: ChatStatus = { state: "idle", projectDir: null, problem: null };
  private enabled = false;

  private readonly twob: TwobChatPanel;

  constructor(private readonly bridge: RendererBridge) {
    this.twob = new TwobChatPanel(bridge, {
      modeChanged: () => this.render(),
      focusInput: () => this.input.focus(),
      reportError: (message) => this.applyEvent({ kind: "error", message }, true),
    });
  }

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
    this.sessionsButton.addEventListener("click", () => this.openSessions());
    this.twob.start();
    this.twobEnd.addEventListener("click", () => {
      this.twob.end();
      const index = this.log.note("Sesi 2B selesai dan obrolannya udah dihapus. Pesan berikutnya ke Claude.");
      this.renderEntry(index);
      this.announcer.textContent = "Sesi 2B selesai. Pesan berikutnya ke Claude.";
      this.render();
      this.input.focus();
    });
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.submit();
    });
    // Enter sends, Shift+Enter adds a line, the way chat boxes usually behave. While the @ list
    // is open, its keys (arrows, Enter, Tab, Escape) pick a teammate instead.
    this.input.addEventListener("keydown", (event) => {
      if (!event.isComposing && this.mentions.handleKey(event)) {
        event.preventDefault();
        return;
      }
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
    if (text === "") {
      return;
    }
    // Sesi 2B first: those messages go to Groq through 2B and never to Claude Code.
    if (this.twob.isActive()) {
      if (!this.twob.isBusy()) {
        this.twob.send(twobMessage(text) ?? text);
        this.input.value = "";
      }
      return;
    }
    const toTwob = twobMessage(text);
    if (toTwob !== null) {
      this.twob.begin(toTwob);
      this.input.value = "";
      return;
    }
    if (this.status.state === "working") {
      return;
    }
    // Without Claude or a folder, main answers with the reason, so the user is not left guessing.
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
    const twob = this.twob.isActive();
    this.root.dataset.mode = twob ? "twob" : "claude";
    this.title.textContent = twob ? "Sesi 2B" : "Chat ke 2B";
    this.twobBadge.hidden = !twob;
    this.twobModel.hidden = !twob;
    this.twobEnd.hidden = !twob;
    this.folderButton.hidden = twob;
    this.newButton.hidden = twob;
    this.sessionsButton.hidden = twob;
    this.list.hidden = twob;
    this.input.placeholder = twob ? twobPlaceholder : claudePlaceholder;
    if (twob) {
      const typing = this.twob.isBusy();
      this.problem.hidden = true;
      this.empty.hidden = true;
      this.working.hidden = !typing;
      this.working.textContent = "2B lagi ngetik...";
      this.input.disabled = false;
      this.sendButton.hidden = false;
      this.sendButton.disabled = typing;
      this.stopButton.hidden = true;
      return;
    }

    const { state, projectDir, problem } = this.status;
    const folder = projectDir === null ? null : folderName(projectDir);
    const busy = state === "working";

    this.folderButton.textContent = folder === null ? "Pilih folder" : `Folder: ${folder}`;
    this.folderButton.title = projectDir ?? "Folder project tempat 2B kerja";
    this.folderButton.disabled = busy;
    this.newButton.disabled = busy || this.log.entries.length === 0;
    this.sessionsButton.disabled = busy || projectDir === null;

    this.problem.hidden = problem === null;
    this.problem.textContent = problem ?? "";

    this.empty.hidden = this.log.entries.length > 0 || problem !== null;
    this.empty.textContent =
      folder === null
        ? "Pilih folder project dulu. 2B kerja dan minta izin di folder itu. Atau ketik @2B buat Sesi 2B tanpa Claude."
        : `Belum ada obrolan. Ketik tugas, 2B kerjain di folder ${folder}. Ketik @2B buat Sesi 2B tanpa Claude.`;

    this.working.hidden = !busy;
    this.working.textContent = folder === null ? "" : `2B lagi kerja di ${folder}.`;

    const ready = state === "idle" && projectDir !== null;
    // Stays typeable without Claude or a folder: "@2B ..." starts Sesi 2B, which needs neither.
    this.input.disabled = false;
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

  private openSessions(): void {
    this.sessionList.replaceChildren();
    this.setSessionsState("Lagi baca daftar sesi...", "muted");
    this.sessionsDialog.showModal();
    this.bridge
      .listChatSessions()
      .then((list) => this.renderSessions(list))
      .catch((error: unknown) => {
        console.error("[chat] could not list sessions", error);
        this.setSessionsState(
          `Gagal baca daftar sesi: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      });
  }

  private renderSessions(list: ChatSessionList): void {
    const folder = this.status.projectDir === null ? "ini" : folderName(this.status.projectDir);
    if (list.sessions.length === 0) {
      this.setSessionsState(`Belum ada sesi Claude Code yang tersimpan buat folder ${folder}.`, "muted");
      return;
    }
    this.setSessionsState("", "muted");
    const now = Date.now();
    for (const session of list.sessions) {
      const current = session.id === list.currentId;
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button";
      button.disabled = current;
      if (current) {
        button.dataset.current = "true";
      }
      const title = document.createElement("span");
      title.className = "session-title";
      title.textContent = session.title;
      const time = document.createElement("span");
      time.className = "session-time";
      time.textContent = current
        ? `${relativeTimeLabel(session.updatedAt, now)}, lagi dipakai di sini`
        : relativeTimeLabel(session.updatedAt, now);
      button.append(title, time);
      button.addEventListener("click", () => this.resumeSession(session.id));
      item.append(button);
      this.sessionList.append(item);
    }
    this.sessionList.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }

  private resumeSession(sessionId: string): void {
    for (const button of this.sessionList.querySelectorAll("button")) {
      button.disabled = true;
    }
    this.setSessionsState("Lagi buka sesinya...", "muted");
    this.bridge
      .resumeChatSession(sessionId)
      .then((events) => {
        this.resetLog();
        for (const event of events) {
          this.applyEvent(event, false);
        }
        this.sessionsDialog.close();
        this.announcer.textContent = "Sesi lama dibuka. Pesan berikutnya nerusin sesi itu.";
        this.input.focus();
      })
      .catch((error: unknown) => {
        console.error("[chat] could not resume the session", error);
        this.setSessionsState(`Gagal buka sesi: ${error instanceof Error ? error.message : String(error)}`, "error");
        for (const button of this.sessionList.querySelectorAll<HTMLButtonElement>("button:not([data-current])")) {
          button.disabled = false;
        }
      });
  }

  private setSessionsState(text: string, tone: "muted" | "error"): void {
    this.sessionsState.textContent = text;
    this.sessionsState.dataset.tone = tone;
  }

  private showLocalError(context: string, error: unknown): void {
    console.error(`[chat] ${context}`, error);
    const message = error instanceof Error ? error.message : String(error);
    this.applyEvent({ kind: "error", message: `${context}: ${message}` }, true);
  }
}
