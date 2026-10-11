import { roster } from "./team.js";

/**
 * Chat with Claude from the office: the user types a task, a headless `claude -p`
 * run in their project works on it, and every tool call that needs permission
 * comes back to the office as a card to allow or deny.
 */

/** A tool call waiting for the user's decision. */
export interface PermissionAsk {
  id: string;
  toolName: string;
  /** One line for the card title, such as the command or the file path. */
  summary: string;
  /** Full input as readable text, truncated for very large writes. */
  detail: string;
}

export type ChatEvent =
  | { kind: "user"; text: string }
  /** A piece of 2B's reply as it streams in. */
  | { kind: "text"; text: string }
  /** A tool Claude started, shown as a one-line note in the log. */
  | { kind: "tool"; toolName: string; summary: string }
  | { kind: "permission"; ask: PermissionAsk }
  | { kind: "permission-settled"; id: string; allowed: boolean }
  /** The run finished. `ok` false carries the reason in `message`. */
  | { kind: "done"; ok: boolean; message: string | null }
  | { kind: "error"; message: string };

export type ChatState = "idle" | "working" | "unavailable";

export interface ChatStatus {
  state: ChatState;
  /** Folder the runs work in, or null until the user picks one. */
  projectDir: string | null;
  /** Why chat is unavailable (CLI missing, not logged in), or null. */
  problem: string | null;
}

/** A Claude Code conversation saved on this machine for the chat's folder, which the chat can carry on. */
export interface ChatSessionSummary {
  id: string;
  /** The session's first prompt, shortened: Claude Code keeps no other title in its local files. */
  title: string;
  /** Last write to the session file, in milliseconds since the epoch. */
  updatedAt: number;
}

export interface ChatSessionList {
  sessions: ChatSessionSummary[];
  /** The conversation the chat carries on right now, or null for a fresh one. */
  currentId: string | null;
}

const maxDetailChars = 4000;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * The one thing a person needs to judge a tool call at a glance: the command
 * for Bash, the path for file tools, the URL for fetches.
 */
export function summarizeToolInput(toolName: string, input: unknown): string {
  const record = asRecord(input);
  const firstLine = (text: string): string => {
    const line = text.split("\n")[0] ?? "";
    return line.length > 160 ? `${line.slice(0, 157)}...` : line;
  };
  const preferred =
    stringField(record, "command") ??
    stringField(record, "file_path") ??
    stringField(record, "notebook_path") ??
    stringField(record, "url") ??
    stringField(record, "pattern") ??
    stringField(record, "query") ??
    stringField(record, "description") ??
    stringField(record, "prompt");
  return preferred === null ? toolName : firstLine(preferred);
}

/** Readable full input for the permission card. Long writes are cut so the card stays usable. */
export function describeToolInput(input: unknown): string {
  const record = asRecord(input);
  const command = stringField(record, "command");
  const text = command ?? JSON.stringify(input, null, 2) ?? "";
  return text.length > maxDetailChars
    ? `${text.slice(0, maxDetailChars)}\n... (${text.length - maxDetailChars} karakter lagi)`
    : text;
}

/** A cast member you can @-mention in the office chat: everyone except 2B, who is the main session. */
export interface MentionTarget {
  displayName: string;
  role: string;
  agentType: string;
}

/** The team from the roster, in roster order. */
export function mentionTargets(): MentionTarget[] {
  return Object.values(roster).flatMap((profile) =>
    profile.agentType === null
      ? []
      : [{ displayName: profile.displayName, role: profile.role, agentType: profile.agentType }],
  );
}

/**
 * Turns `@Erza` (or `@erza`, or an old role name like `@reviewer`) into `@agent-erza`, the form
 * Claude Code resolves to "run this subagent". Only a whole word after a space or the start
 * counts, so emails and handles inside other text stay as they are.
 */
export function expandCastMentions(text: string): string {
  return text.replace(/(^|[\s(])@([A-Za-z][\w-]*)/g, (whole, before: string, name: string) => {
    const lower = name.toLowerCase();
    const profile = Object.values(roster).find(
      (candidate) =>
        candidate.agentType !== null &&
        (candidate.displayName.toLowerCase() === lower ||
          candidate.agentType === lower ||
          candidate.legacyAgentType === lower),
    );
    return profile === undefined || profile.agentType === null ? whole : `${before}@agent-${profile.agentType}`;
  });
}
