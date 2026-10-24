/**
 * Background music for the office: YouTube videos played through YouTube's own embedded player,
 * which has to stay visible. The pieces here are plain data and functions; the panel is in
 * music-panel.ts.
 */

/** The two songs the office starts with. */
export const defaultSongs: readonly string[] = ["6NKt7Y7yOyw", "bhLfxROL-k4"];

export interface MusicState {
  /** YouTube video ids, in play order. */
  songs: string[];
  /** Index into `songs` of the song that plays, or last played. */
  current: number;
  /** Music switched on. Off until the person switches it on the first time. */
  on: boolean;
}

export const initialMusic: MusicState = { songs: [...defaultSongs], current: 0, on: false };

const videoId = /^[A-Za-z0-9_-]{11}$/;
const youtubeHosts = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);

/**
 * The video id in a YouTube link: watch, share (youtu.be), shorts, embed and live links, with or
 * without "https://". Anything else, including links to other sites, gives null.
 */
export function youtubeIdFrom(link: string): string | null {
  const text = link.trim();
  if (videoId.test(text)) {
    return text;
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    // Not a URL at all; the caller tells the person it is not a YouTube link.
    return null;
  }
  const host = url.hostname.toLowerCase();
  let candidate: string | null = null;
  if (host === "youtu.be") {
    candidate = url.pathname.slice(1).split("/")[0] ?? null;
  } else if (youtubeHosts.has(host)) {
    const [first, second] = url.pathname.split("/").filter((part) => part !== "");
    if (first === "watch") {
      candidate = url.searchParams.get("v");
    } else if (first === "shorts" || first === "embed" || first === "live") {
      candidate = second ?? null;
    }
  }
  return candidate !== null && videoId.test(candidate) ? candidate : null;
}

/**
 * The privacy-enhanced embed for one song, playing straight away and looping that same song
 * (YouTube loops a single video only when it is also given as its own playlist).
 */
export function embedUrl(id: string, pageOrigin: string | null): string {
  const params = new URLSearchParams({
    autoplay: "1",
    loop: "1",
    playlist: id,
    playsinline: "1",
    rel: "0",
    enablejsapi: "1",
  });
  if (pageOrigin !== null) {
    params.set("origin", pageOrigin);
  }
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

export function nextSong(state: MusicState): MusicState {
  if (state.songs.length === 0) {
    return state;
  }
  return { ...state, current: (state.current + 1) % state.songs.length };
}

export type AddResult = { state: MusicState; added: true } | { state: MusicState; added: false; reason: string };

export function addSong(state: MusicState, link: string): AddResult {
  const id = youtubeIdFrom(link);
  if (id === null) {
    return { state, added: false, reason: "Itu bukan link video YouTube." };
  }
  if (state.songs.includes(id)) {
    return { state, added: false, reason: "Lagu ini udah ada di daftar." };
  }
  return { state: { ...state, songs: [...state.songs, id] }, added: true };
}

/** Removes a song, keeping the one that plays the same song where it can. */
export function removeSong(state: MusicState, index: number): MusicState {
  if (index < 0 || index >= state.songs.length) {
    return state;
  }
  const songs = state.songs.filter((_, position) => position !== index);
  let current = state.current;
  if (index < current || current >= songs.length) {
    current = Math.max(0, current - 1);
  }
  return { songs, current: songs.length === 0 ? 0 : current, on: songs.length === 0 ? false : state.on };
}

/** Reads saved music settings, falling back to the defaults for anything missing or malformed. */
export function parseMusicState(saved: string | null): MusicState {
  if (saved === null) {
    return initialMusic;
  }
  let value: unknown;
  try {
    value = JSON.parse(saved);
  } catch {
    // A corrupted entry is replaced by the defaults on the next save.
    return initialMusic;
  }
  if (typeof value !== "object" || value === null) {
    return initialMusic;
  }
  const record = value as Record<string, unknown>;
  const songs = Array.isArray(record.songs)
    ? record.songs.filter((song): song is string => typeof song === "string" && videoId.test(song))
    : [...defaultSongs];
  const current =
    typeof record.current === "number" && Number.isInteger(record.current) && record.current >= 0
      ? Math.min(record.current, Math.max(0, songs.length - 1))
      : 0;
  return { songs, current, on: record.on === true && songs.length > 0 };
}
