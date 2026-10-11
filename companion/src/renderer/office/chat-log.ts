import type { ChatEvent, PermissionAsk } from "../../shared/office-chat.js";

export type ChatEntry =
  | { type: "user"; text: string }
  | { type: "reply"; text: string }
  | { type: "note"; text: string; tone: "muted" | "error" }
  | { type: "permission"; ask: PermissionAsk; state: "open" | "allowed" | "denied" };

/**
 * The visible conversation, built from chat events. Streaming text joins the reply
 * it belongs to; a tool call or a permission card ends that reply, so the next
 * text starts a new one under it, in the order things happened.
 */
export class ChatLog {
  readonly entries: ChatEntry[] = [];

  /** Applies one event and returns the index of the entry it added or changed, or null. */
  apply(event: ChatEvent): number | null {
    switch (event.kind) {
      case "user":
        return this.push({ type: "user", text: event.text });
      case "text": {
        const last = this.entries.at(-1);
        if (last?.type === "reply") {
          last.text += event.text;
          return this.entries.length - 1;
        }
        // A reply that resumes after a tool call often starts with the space that joined it.
        const text = event.text.trimStart();
        return text === "" ? null : this.push({ type: "reply", text });
      }
      case "tool":
        return this.push({ type: "note", text: `${event.toolName}: ${event.summary}`, tone: "muted" });
      case "permission":
        return this.push({ type: "permission", ask: event.ask, state: "open" });
      case "permission-settled": {
        const index = this.entries.findIndex((entry) => entry.type === "permission" && entry.ask.id === event.id);
        const entry = this.entries[index];
        if (entry?.type !== "permission") {
          return null;
        }
        entry.state = event.allowed ? "allowed" : "denied";
        return index;
      }
      case "done":
        return event.ok ? null : this.push({ type: "note", text: event.message ?? "Run berhenti.", tone: "muted" });
      case "error":
        return this.push({ type: "note", text: event.message, tone: "error" });
    }
  }

  clear(): void {
    this.entries.length = 0;
  }

  private push(entry: ChatEntry): number {
    this.entries.push(entry);
    return this.entries.length - 1;
  }
}

/** Last folder name of a Windows or POSIX path, for a short label. */
export function folderName(path: string): string {
  const parts = path.split(/[\\/]+/).filter((part) => part !== "");
  return parts.at(-1) ?? path;
}

const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;
const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "5 menit lalu", "kemarin", "12 Okt": how long ago a session was last used, in the chat's voice. */
export function relativeTimeLabel(then: number, now: number): string {
  const ago = Math.max(0, now - then);
  if (ago < minuteMs) {
    return "baru aja";
  }
  if (ago < hourMs) {
    return `${Math.floor(ago / minuteMs)} menit lalu`;
  }
  if (ago < dayMs) {
    return `${Math.floor(ago / hourMs)} jam lalu`;
  }
  if (ago < 2 * dayMs) {
    return "kemarin";
  }
  if (ago < 7 * dayMs) {
    return `${Math.floor(ago / dayMs)} hari lalu`;
  }
  const date = new Date(then);
  return `${date.getDate()} ${monthNames[date.getMonth()]}`;
}
