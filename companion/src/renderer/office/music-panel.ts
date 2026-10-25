import { requireElement } from "../common/status-chip.js";
import {
  addSong,
  clampVolume,
  embedUrl,
  type MusicState,
  nextSong,
  oembedUrl,
  parseMusicState,
  parseTitles,
  removeSong,
  titleFrom,
  volumeCommand,
} from "./music.js";

const storageKey = "alyxlabs-office-music";
const titlesKey = "alyxlabs-office-music-titles";
const embedOrigin = "https://www.youtube-nocookie.com";

/**
 * The office music: on/off, next, the song list with titles, and a field to add a link. Only the
 * sound plays: YouTube's player sits out of sight, outside the panel, so closing the panel leaves
 * the music on. Songs, the current one and whether it was on are remembered in this browser
 * profile, which the office window keeps.
 */
export class MusicPanel {
  private readonly panel = requireElement("music", HTMLElement);
  private readonly toggle = requireElement("music-toggle", HTMLButtonElement);
  private readonly closeButton = requireElement("music-close", HTMLButtonElement);
  private readonly engine = requireElement("music-engine", HTMLElement);
  private readonly now = requireElement("music-now", HTMLElement);
  private readonly power = requireElement("music-power", HTMLButtonElement);
  private readonly next = requireElement("music-next", HTMLButtonElement);
  private readonly volume = requireElement("music-volume", HTMLInputElement);
  private readonly volumeValue = requireElement("music-volume-value", HTMLOutputElement);
  private readonly list = requireElement("music-list", HTMLOListElement);
  private readonly form = requireElement("music-add", HTMLFormElement);
  private readonly input = requireElement("music-link", HTMLInputElement);
  private readonly error = requireElement("music-error", HTMLElement);
  private state: MusicState;
  private titles: Record<string, string>;
  private frame: HTMLIFrameElement | null = null;
  /** The song the player was last built for, so re-rendering does not restart it. */
  private playing: string | null = null;
  private loading = false;
  /** Songs YouTube refused to play here this session, so a list of them cannot skip forever. */
  private readonly refused = new Set<string>();
  /** Titles already being looked up, so a re-render does not ask twice. */
  private readonly lookingUp = new Set<string>();

  constructor() {
    this.state = parseMusicState(this.read(storageKey));
    this.titles = parseTitles(this.read(titlesKey));
  }

  start(): void {
    this.toggle.hidden = false;
    this.toggle.addEventListener("click", () => this.setOpen(this.panel.hidden));
    this.closeButton.addEventListener("click", () => this.setOpen(false));
    this.power.addEventListener("click", () => this.update({ ...this.state, on: !this.state.on }));
    this.next.addEventListener("click", () => this.update(nextSong(this.state)));
    this.volume.addEventListener("input", () => {
      this.update({ ...this.state, volume: clampVolume(Number(this.volume.value)) });
      this.sendVolume();
    });
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
    // Music that was on when the office closed comes back on with it, with the panel closed.
    this.render();
  }

  private setOpen(open: boolean): void {
    this.panel.hidden = !open;
    this.toggle.setAttribute("aria-expanded", String(open));
    this.render();
  }

  private update(state: MusicState): void {
    this.state = state;
    this.write(storageKey, this.state);
    this.render();
  }

  private titleOf(song: string): string {
    return this.titles[song] ?? song;
  }

  private render(): void {
    const { songs, current, on } = this.state;
    const song = songs[current] ?? null;
    // While the panel is closed, the button is the only sign that music is playing.
    this.toggle.textContent = on ? "Musik nyala" : "Musik";
    this.power.textContent = on ? "Matiin" : "Putar";
    this.power.setAttribute("aria-pressed", String(on));
    this.power.disabled = song === null;
    this.next.disabled = songs.length < 2;
    this.volume.value = String(this.state.volume);
    this.volumeValue.textContent = `${this.state.volume}%`;
    this.renderPlayer(on ? song : null);
    if (song === null) {
      this.now.textContent = "Belum ada lagu. Tambahin link YouTube di bawah.";
    } else if (!on) {
      this.now.textContent = `Musik mati. Berikutnya: ${this.titleOf(song)}`;
    } else {
      this.now.textContent = `${this.loading ? "Memuat" : "Lagi diputer"}: ${this.titleOf(song)}`;
    }
    this.renderList();
    // Titles are only needed once someone looks or listens; opening the office alone asks nothing.
    if (on || !this.panel.hidden) {
      for (const id of songs) {
        this.lookUpTitle(id);
      }
    }
  }

  /** Builds the player only when the song changes or music turns on, so it never restarts by itself. */
  private renderPlayer(song: string | null): void {
    if (song === this.playing) {
      return;
    }
    this.playing = song;
    this.frame?.remove();
    this.frame = null;
    this.loading = song !== null;
    if (song === null) {
      return;
    }
    const frame = document.createElement("iframe");
    frame.title = "Pemutar musik YouTube";
    frame.tabIndex = -1;
    frame.allow = "autoplay; encrypted-media";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    // The player runs its own scripts, but never navigates the office or opens windows from here.
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
    const origin = window.location.origin.startsWith("http") ? window.location.origin : null;
    frame.src = embedUrl(song, origin);
    frame.addEventListener("load", () => {
      this.loading = false;
      this.render();
      // Ask the player to report its state, so a video that refuses to play here can be skipped.
      frame.contentWindow?.postMessage(
        JSON.stringify({ event: "listening", id: "music", channel: "widget" }),
        embedOrigin,
      );
      this.sendVolume();
    });
    this.frame = frame;
    this.engine.append(frame);
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
        label.textContent = this.titleOf(song);
        label.title = this.titleOf(song);
        const play = document.createElement("button");
        play.className = "chat-link";
        play.type = "button";
        play.textContent = "Putar";
        play.setAttribute("aria-label", `Putar ${this.titleOf(song)}`);
        play.hidden = index === current && this.state.on;
        play.addEventListener("click", () => this.update({ ...this.state, current: index, on: true }));
        const remove = document.createElement("button");
        remove.className = "chat-link";
        remove.type = "button";
        remove.textContent = "Hapus";
        remove.setAttribute("aria-label", `Hapus ${this.titleOf(song)} dari daftar`);
        remove.addEventListener("click", () => this.update(removeSong(this.state, index)));
        item.append(label, play, remove);
        return item;
      }),
    );
  }

  /** Sets the player's volume; with no player yet, the next one gets it when it loads. */
  private sendVolume(): void {
    this.frame?.contentWindow?.postMessage(volumeCommand(this.state.volume), embedOrigin);
  }

  /** Asks YouTube for a song's title once; until it answers, or when it cannot, the id stands in. */
  private lookUpTitle(id: string): void {
    if (this.titles[id] !== undefined || this.lookingUp.has(id)) {
      return;
    }
    this.lookingUp.add(id);
    fetch(oembedUrl(id))
      .then((response) => (response.ok ? response.json() : null))
      .then((answer: unknown) => {
        const title = titleFrom(answer);
        if (title !== null) {
          this.titles = { ...this.titles, [id]: title };
          this.write(titlesKey, this.titles);
          this.render();
        }
      })
      .catch((error: unknown) => {
        // Offline or blocked: the list keeps showing the video id.
        console.warn("[music] could not look up a song title", error);
      });
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
        ? "Lagu ini nggak bisa diputer di luar YouTube, lanjut ke lagu berikutnya."
        : "Nggak ada lagu di daftar yang bisa diputer di luar YouTube.",
    );
    this.update(playable ? nextSong(this.state) : { ...this.state, on: false });
  }

  private showError(text: string | null): void {
    this.error.hidden = text === null;
    this.error.textContent = text ?? "";
  }

  private read(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      // Storage can be blocked; the defaults still work for this session.
      console.warn("[music] could not read saved music settings", error);
      return null;
    }
  }

  private write(key: string, value: unknown): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("[music] could not save music settings", error);
    }
  }
}
