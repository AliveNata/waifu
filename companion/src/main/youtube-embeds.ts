import type { Session } from "electron";

/** The only player the office embeds: YouTube's privacy-enhanced one. */
export const youtubeEmbedPages = ["https://www.youtube-nocookie.com/embed/*"];

/**
 * Pages open from local files, which send no Referer, and YouTube refuses to play embeds without
 * one (error 153). The player page gets its own address as the Referer; nothing else is touched.
 */
export function allowYoutubeEmbeds(session: Session): void {
  session.webRequest.onBeforeSendHeaders({ urls: youtubeEmbedPages }, (details, callback) => {
    callback({ requestHeaders: { ...details.requestHeaders, Referer: "https://www.youtube-nocookie.com/" } });
  });
}

const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com",
]);

/** A YouTube link the player wants to open (its logo, the title), which goes to the system browser. */
export function isYoutubeLink(link: string): boolean {
  try {
    const url = new URL(link);
    return url.protocol === "https:" && youtubeHosts.has(url.hostname);
  } catch {
    // Not a URL: never opened.
    return false;
  }
}
