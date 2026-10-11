import type { MentionTarget } from "../../shared/office-chat.js";
import { insertMention, type MentionQuery, matchingTargets, mentionQuery } from "./mentions.js";

/**
 * The list that opens when you type `@` in the office chat: each teammate with their role,
 * filtered as you type, picked with the arrow keys and Enter (or Tab), or by clicking.
 */
export class MentionPicker {
  private open: { mention: MentionQuery; targets: MentionTarget[]; active: number } | null = null;

  constructor(
    private readonly input: HTMLTextAreaElement,
    private readonly list: HTMLUListElement,
  ) {
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", list.id);
    input.setAttribute("aria-expanded", "false");
    input.addEventListener("input", () => this.update());
    input.addEventListener("click", () => this.update());
    input.addEventListener("blur", () => {
      // Let a click on an option land before the list goes away.
      window.setTimeout(() => this.close(), 120);
    });
  }

  /** Handles the picker's keys; returns true when the key was used, so the chat must not send. */
  handleKey(event: KeyboardEvent): boolean {
    const open = this.open;
    if (open === null) {
      return false;
    }
    switch (event.key) {
      case "ArrowDown":
        this.setActive((open.active + 1) % open.targets.length);
        return true;
      case "ArrowUp":
        this.setActive((open.active - 1 + open.targets.length) % open.targets.length);
        return true;
      case "Enter":
      case "Tab":
        this.choose(open.targets[open.active] as MentionTarget);
        return true;
      case "Escape":
        this.close();
        return true;
      default:
        return false;
    }
  }

  private update(): void {
    const mention = mentionQuery(this.input.value, this.input.selectionStart ?? this.input.value.length);
    const targets = mention === null ? [] : matchingTargets(mention.query);
    if (mention === null || targets.length === 0) {
      this.close();
      return;
    }
    this.open = { mention, targets, active: 0 };
    this.list.replaceChildren(
      ...targets.map((target, index) => {
        const option = document.createElement("li");
        option.id = `chat-mention-${target.agentType}`;
        option.setAttribute("role", "option");
        const name = document.createElement("span");
        name.className = "chat-mention-name";
        name.textContent = target.displayName;
        const role = document.createElement("span");
        role.className = "chat-mention-role";
        role.textContent = target.role;
        option.append(name, role);
        // mousedown, not click: it fires before the textarea's blur closes the list.
        option.addEventListener("mousedown", (event) => {
          event.preventDefault();
          this.choose(target);
        });
        option.addEventListener("mousemove", () => this.setActive(index));
        return option;
      }),
    );
    this.list.hidden = false;
    this.input.setAttribute("aria-expanded", "true");
    this.setActive(0);
  }

  private setActive(index: number): void {
    if (this.open === null) {
      return;
    }
    this.open.active = index;
    for (const [position, option] of [...this.list.children].entries()) {
      option.setAttribute("aria-selected", String(position === index));
    }
    const active = this.list.children[index];
    if (active !== undefined) {
      this.input.setAttribute("aria-activedescendant", active.id);
      active.scrollIntoView({ block: "nearest" });
    }
  }

  private choose(target: MentionTarget): void {
    if (this.open === null) {
      return;
    }
    const caret = this.input.selectionStart ?? this.input.value.length;
    const next = insertMention(this.input.value, this.open.mention, caret, target);
    this.input.value = next.text;
    this.input.setSelectionRange(next.caret, next.caret);
    this.close();
    this.input.focus();
  }

  private close(): void {
    this.open = null;
    this.list.hidden = true;
    this.list.replaceChildren();
    this.input.setAttribute("aria-expanded", "false");
    this.input.removeAttribute("aria-activedescendant");
  }
}
