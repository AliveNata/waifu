import { requireElement } from "../common/status-chip.js";
import { addSong, embedUrl, type MusicState, nextSong, parseMusicState, removeSong } from "./music.js";

const storageKey = "alyxlabs-office-music";
const embedOrigin = "https://www.youtube-nocookie.com";

/**
 * The office music panel: YouTube's player (it must stay visible), on/off, next, the song list,
 * and a field to add a link. Closing the panel stops the music. Songs, the current one and
 * whether it was on are remembered in this browser profile, which the office window keeps.
 */
export class MusicPanel {
  private readonly panel = requireElement("music", HTMLElement);
  private readonly toggle = requireElement("music-toggle", HTMLButtonElement);
  private readonly closeButton = requireElement("music-close", HTMLButtonElement);
  private readonly screen = requireElement("music-screen", HTMLElement);
  private readonly note = requireElement("music-note", HTMLElement);
  private readonly now = requireElement("music-now", HTMLElement);
  private readonly power = requireElement("music-power", HTMLButtonElement);
  private readonly next = requireElement("music-next", HTMLButtonElement);
  private readonly list = requireElement("music-list", HTMLOListElement);
  private readonly form = requireElement("music-add", HTMLFormElement);
  private readonly input = requireElement("music-link", HTMLInputElement);
  private readonly error = requireElement("music-error", HTMLElement);
  private state: MusicState;
  private frame: HTMLIFrameElement | null = null;
  /** The song the player was last built for, so re-rendering does not restart it. */
  private playing: string | null = null;
  /** Songs YouTube refused to play here this session, so a list of them cannot skip forever. */
  private readonly refused = new Set<string>();

  constructor() {
    this.state = parseMusicState(this.read());
  }

  start(): void {
    this.toggle.hidden = false;
    this.toggle.addEventListener("click", () => this.setOpen(this.panel.hidden));
    this.closeButton.addEventListener("click", () => this.setOpen(false));
    this.power.addEventListener("click", () => this.update({ ...this.state, on: !this.state.on }));
    this.next.addEventListener("click", () => this.update(nextSong(this.state)));
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      const result = addSong(this.state, this.input.value);
      if (!result.added) {
        this.showError(result.reason);
        return;
      }
      this.input.value = "";
      this.showError(null);
      this.update(result.state);
    });
    this.panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.setOpen(false);
        this.toggle.focus();
      }
    });
    window.addEventListener("message", (event) => this.onPlayerMessage(event));
    // Music that was on when the office closed comes back on with it.
    this.setOpen(this.state.on);
  }

  private setOpen(open: boolean): void {
    this.panel.hidden = !open;
    this.toggle.setAttribute("aria-expanded", String(open));
    if (!open && this.state.on) {
      // The player has to be visible to play, so a closed panel means no music.
      this.update({ ...this.state, on: false });
      return;
    }
    this.render();
  }

  private update(state: MusicState): void {
    this.state = state;
    this.write();
    this.render();
  }

  private render(): void {
    const { songs, current, on } = this.state;
    const song = songs[current] ?? null;
    this.power.textContent = on ? "Matiin" : "Putar";
    this.power.setAttribute("aria-pressed", String(on));
    this.power.disabled = song === null;
    this.next.disabled = songs.length < 2;
    this.now.textContent =
      song === null ? "" : `${on ? "Lagi diputer" : "Berikutnya"}: lagu ${current + 1} dari ${songs.length}`;
    this.renderPlayer(on && !this.panel.hidden ? song : null);
    this.renderList();
  }

  /** Builds the player only when the song changes or music turns on, so it never restarts by itself. */
  private renderPlayer(song: string | null): void {
    if (song === this.playing) {
      return;
    }
    this.playing = song;
    this.frame?.remove();
    this.frame = null;
    if (song === null) {
      this.note.hidden = false;
      this.note.textContent =
        this.state.songs.length === 0 ? "Belum ada lagu. Tambahin link YouTube di bawah." : "Musik mati";
      return;
    }
    this.note.hidden = false;
    this.note.textContent = "Memuat video";
    const frame = document.createElement("iframe");
    frame.className = "music-frame";
    frame.title = "Pemutar YouTube";
    frame.allow = "autoplay; encrypted-media";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    // The player runs its own scripts and may open YouTube in a new window, but never navigates the office.
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation allow-popups");
    const origin = window.location.origin.startsWith("http") ? window.location.origin : null;
    frame.src = embedUrl(song, origin);
    frame.addEventListener("load", () => {
      this.note.hidden = true;
      // Ask the player to report its state, so a video that refuses to play here can be skipped.
      frame.contentWindow?.postMessage(
        JSON.stringify({ event: "listening", id: "music", channel: "widget" }),
        embedOrigin,
      );
    });
    this.frame = frame;
    this.screen.append(frame);
  }

  private renderList(): void {
    const { songs, current } = this.state;
    this.list.replaceChildren(
      ...songs.map((song, index) => {
        const item = document.createElement("li");
        item.className = "music-song";
        if (index === current) {
          item.setAttribute("aria-current", "true");
        }
        const label = document.createElement("span");
        label.className = "music-song-label";
        label.textContent = `Lagu ${index + 1}`;
        const id = document.createElement("span");
        id.className = "music-song-id";
        id.textContent = song;
        const play = document.createElement("button");
        play.className = "chat-link";
        play.type = "button";
        play.textContent = "Putar";
        play.setAttribute("aria-label", `Putar lagu ${index + 1}`);
        play.hidden = index === current && this.state.on;
        play.addEventListener("click", () => this.update({ ...this.state, current: index, on: true }));
        const remove = document.createElement("button");
        remove.className = "chat-link";
        remove.type = "button";
        remove.textContent = "Hapus";
        remove.setAttribute("aria-label", `Hapus lagu ${index + 1} dari daftar`);
        remove.addEventListener("click", () => this.update(removeSong(this.state, index)));
        item.append(label, id, play, remove);
        return item;
      }),
    );
  }

  /** YouTube's player says when a video cannot be played embedded; then the next song plays. */
  private onPlayerMessage(event: MessageEvent): void {
    if (event.origin !== embedOrigin || event.source !== this.frame?.contentWindow || typeof event.data !== "string") {
      return;
    }
    let message: unknown;
    try {
      message = JSON.parse(event.data);
    } catch {
      // Not one of the player's JSON messages.
      return;
    }
    if (typeof message !== "object" || message === null || (message as { event?: unknown }).event !== "onError") {
      return;
    }
    const failed = this.state.songs[this.state.current];
    if (failed !== undefined) {
      this.refused.add(failed);
    }
    const playable = this.state.songs.some((song) => !this.refused.has(song));
    this.showError(
      playable
        ? "Video ini nggak bisa diputer di luar YouTube, lanjut ke lagu berikutnya."
        : "Nggak ada lagu di daftar yang bisa diputer di luar YouTube.",
    );
    this.update(playable ? nextSong(this.state) : { ...this.state, on: false });
  }

  private showError(text: string | null): void {
    this.error.hidden = text === null;
    this.error.textContent = text ?? "";
  }

  private read(): string | null {
    try {
      return window.localStorage.getItem(storageKey);
    } catch (error) {
      // Storage can be blocked; the defaults still work for this session.
      console.warn("[music] could not read saved music settings", error);
      return null;
    }
  }

  private write(): void {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(this.state));
    } catch (error) {
      console.warn("[music] could not save music settings", error);
    }
  }
}
