import type { HookServerStatus } from "../../shared/protocol.js";
import { type Reaction, statusText } from "../../shared/reaction.js";

export function requireElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) {
    throw new Error(`#${id} is missing or not a ${type.name}`);
  }
  return element;
}

/**
 * The status chip at the bottom of both pages. Priority: hook server errors,
 * then short-lived notices (e.g. a model failed to load), then 2B's mood.
 */
export class StatusChip {
  private serverError: string | null = null;
  private notice: { text: string; until: number } | null = null;
  private lastKey = "";

  constructor(private readonly element: HTMLElement) {}

  applyServerStatus(status: HookServerStatus): void {
    this.serverError = status.state === "error" ? status.message : null;
  }

  showNotice(text: string, now: number, durationMs = 8000): void {
    this.notice = { text, until: now + durationMs };
  }

  render(reaction: Reaction, now: number): void {
    if (this.notice !== null && now >= this.notice.until) {
      this.notice = null;
    }
    let text: string | null;
    let tone: "neutral" | "attention" | "error";
    if (this.serverError !== null) {
      text = this.serverError;
      tone = "error";
    } else if (this.notice !== null) {
      text = this.notice.text;
      tone = "error";
    } else {
      text = statusText(reaction);
      tone = reaction.mood === "waiting" ? "attention" : "neutral";
    }
    const key = `${tone}|${text ?? ""}`;
    if (key === this.lastKey) {
      return;
    }
    this.lastKey = key;
    this.element.hidden = text === null;
    this.element.textContent = text ?? "";
    this.element.dataset.tone = tone;
  }
}
