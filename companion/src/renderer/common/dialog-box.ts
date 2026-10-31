import { type MemberId, roster } from "../../shared/team.js";
import { type DialogLine, revealCharsPerSecond } from "./conversation.js";

/**
 * Each member's name color is their identity marker: hair color, lightened for
 * contrast on the navy dialog box (all above 5.7:1, even over a white wallpaper).
 */
export const speakerColors: Record<MemberId, string> = {
  twob: "#d9dde6",
  chizuru: "#e8c39a",
  rias: "#ff9ec4",
  asuna: "#f4b07a",
  kobayashi: "#f09a84",
  yor: "#f2d27a",
  erza: "#f58f8f",
  ruby: "#f3a6e0",
  // Picked per role until the models' own colors are known, as light as the others for contrast.
  arisu: "#8fd3e8",
  komachi: "#a9b8ff",
  miruku: "#d2b8ff",
  huagua: "#9fe3b8",
};

/** The part of a line already "spoken", in step with the lip-sync that reads the same clock. */
export function revealedText(text: string, startedAt: number, now: number): string {
  const count = Math.floor(((now - startedAt) / 1000) * revealCharsPerSecond);
  return text.slice(0, Math.max(0, Math.min(text.length, count)));
}

function requireChild<T extends HTMLElement>(root: HTMLElement, selector: string, type: new () => T): T {
  const element = root.querySelector(selector);
  if (!(element instanceof type)) {
    throw new Error(`${selector} is missing inside the dialog box`);
  }
  return element;
}

/**
 * Visual-novel style box naming who speaks, with a typewriter reveal. Shared by
 * the team overlay and the office so both read the same conversation the same way.
 */
export class DialogBox {
  private readonly name: HTMLElement;
  private readonly text: HTMLElement;
  private readonly tag: HTMLElement;
  private shownLineId: number | null = null;
  private renderedText = "";

  constructor(readonly root: HTMLElement) {
    this.name = requireChild(root, ".dialog-name", HTMLElement);
    this.text = requireChild(root, ".dialog-text", HTMLElement);
    this.tag = requireChild(root, ".dialog-tag", HTMLElement);
  }

  /** Renders the current line, or hides the box. Returns true when a new line just started. */
  render(current: { line: DialogLine; startedAt: number } | null, now: number): boolean {
    if (current === null) {
      this.root.hidden = true;
      return false;
    }
    const { line, startedAt } = current;
    const isNew = line.id !== this.shownLineId;
    if (isNew) {
      this.shownLineId = line.id;
      const profile = roster[line.memberId];
      this.root.hidden = false;
      this.root.style.setProperty("--speaker", speakerColors[line.memberId]);
      this.name.textContent = profile.displayName;
      const role = document.createElement("span");
      role.textContent = profile.role;
      this.name.append(role);
      this.tag.hidden = !line.simulated;
    }
    const text = revealedText(line.text, startedAt, now);
    if (text !== this.renderedText || isNew) {
      this.renderedText = text;
      this.text.textContent = text;
    }
    return isNew;
  }
}
