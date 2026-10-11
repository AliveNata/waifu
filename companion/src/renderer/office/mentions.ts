import { type MentionTarget, mentionTargets } from "../../shared/office-chat.js";

/** The `@...` being typed right before the caret, if any. */
export interface MentionQuery {
  /** Index of the `@`. */
  start: number;
  /** What follows the `@`, up to the caret. */
  query: string;
}

export function mentionQuery(text: string, caret: number): MentionQuery | null {
  const match = /(^|[\s(])@([\w-]*)$/.exec(text.slice(0, caret));
  if (match === null) {
    return null;
  }
  const query = match[2] ?? "";
  return { start: caret - query.length - 1, query };
}

/** Cast members whose name or role starts with the query, or all of them for a bare `@`. */
export function matchingTargets(query: string, targets: readonly MentionTarget[] = mentionTargets()): MentionTarget[] {
  const lower = query.toLowerCase();
  return targets.filter(
    (target) =>
      target.displayName.toLowerCase().startsWith(lower) ||
      target.role
        .toLowerCase()
        .split(/[\s/+]+/)
        .some((word) => word.startsWith(lower)),
  );
}

/** Replaces the `@query` with `@Name ` and returns the new text and caret position. */
export function insertMention(
  text: string,
  mention: MentionQuery,
  caret: number,
  target: MentionTarget,
): { text: string; caret: number } {
  const inserted = `@${target.displayName} `;
  const next = text.slice(0, mention.start) + inserted + text.slice(caret).replace(/^ /, "");
  return { text: next, caret: mention.start + inserted.length };
}
