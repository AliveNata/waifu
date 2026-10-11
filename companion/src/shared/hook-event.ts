/**
 * Subset of the Claude Code hook payload that the companion cares about.
 * Claude Code sends much more (tool_input, transcript_path, ...), but the bridge
 * strips everything else so file contents never leave the hook process.
 */
export const supportedHookEventNames = [
  "SessionStart",
  "UserPromptSubmit",
  "SubagentStart",
  "PreToolUse",
  "PostToolUse",
  "Notification",
  "Stop",
  "SubagentStop",
  "PreCompact",
  "SessionEnd",
] as const;

export type HookEventName = (typeof supportedHookEventNames)[number];

export interface CompanionHookPayload {
  hook_event_name: HookEventName;
  tool_name?: string;
  message?: string;
  /** Set on SubagentStart/Stop and on every event fired from inside a subagent. */
  agent_id?: string;
  /** Subagent name, matching the `name` frontmatter of its definition. */
  agent_type?: string;
  /** Main session handing work to a subagent: which agent, and the short task title (tool_input.description). */
  subagent_type?: string;
  task_description?: string;
  /** Start of the subagent's final report (last_assistant_message on SubagentStop). */
  summary?: string;
}

/** Tool names Claude Code uses when the main session hands work to a subagent. */
export const delegationToolNames: ReadonlySet<string> = new Set(["Agent", "Task"]);

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const maxTextLength = 200;
const maxDescriptionLength = 120;
/** Room for a short report the member reads out sentence by sentence, not the whole transcript. */
const maxSummaryLength = 1200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHookEventName(value: unknown): value is HookEventName {
  return typeof value === "string" && (supportedHookEventNames as readonly string[]).includes(value);
}

function readOptionalText(
  record: Record<string, unknown>,
  key: string,
  limit = maxTextLength,
): ParseResult<string | undefined> {
  const value = record[key];
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }
  if (typeof value !== "string") {
    return { ok: false, error: `${key} must be a string` };
  }
  return { ok: true, value: value.slice(0, limit) };
}

/** Collapses whitespace and cuts at a word boundary so a report fits a dialog box. */
export function shortenText(text: string, limit: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= limit) {
    return flat;
  }
  const cut = flat.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Like `shortenText`, but keeps line breaks: a report's bullets and paragraphs mark where
 * one spoken sentence ends and the next begins.
 */
export function shortenReport(text: string, limit: number): string {
  const tidy = text
    .split("\n")
    .map((line) => line.replace(/[ \t\r\f\v]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (tidy.length <= limit) {
    return tidy;
  }
  const cut = tidy.slice(0, limit - 1);
  const lastBreak = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\n"));
  return `${(lastBreak > limit * 0.6 ? cut.slice(0, lastBreak) : cut).trimEnd()}…`;
}

/** Reads the flattened field the bridge sends, or the raw Claude Code field it came from. */
function readEither(record: Record<string, unknown>, flatKey: string, rawValue: unknown): string | undefined {
  const flat = record[flatKey];
  if (typeof flat === "string" && flat !== "") {
    return flat;
  }
  return typeof rawValue === "string" && rawValue !== "" ? rawValue : undefined;
}

export function parseHookPayload(input: unknown): ParseResult<CompanionHookPayload> {
  if (!isRecord(input)) {
    return { ok: false, error: "payload must be a JSON object" };
  }
  const eventName = input.hook_event_name;
  if (!isHookEventName(eventName)) {
    return { ok: false, error: `unsupported hook_event_name: ${String(eventName)}` };
  }

  const toolName = readOptionalText(input, "tool_name");
  if (!toolName.ok) {
    return toolName;
  }
  const message = readOptionalText(input, "message");
  if (!message.ok) {
    return message;
  }
  const agentId = readOptionalText(input, "agent_id");
  if (!agentId.ok) {
    return agentId;
  }
  const agentType = readOptionalText(input, "agent_type");
  if (!agentType.ok) {
    return agentType;
  }

  const payload: CompanionHookPayload = { hook_event_name: eventName };
  if (toolName.value !== undefined) {
    payload.tool_name = toolName.value;
  }
  if (message.value !== undefined) {
    payload.message = message.value;
  }
  // Empty strings show up for internal agents and carry no identity.
  if (agentId.value) {
    payload.agent_id = agentId.value;
  }
  if (agentType.value) {
    payload.agent_type = agentType.value;
  }

  if (toolName.value !== undefined && delegationToolNames.has(toolName.value)) {
    // Only the agent name and the short title: the full prompt never leaves the hook process.
    const toolInput = isRecord(input.tool_input) ? input.tool_input : {};
    const subagentType = readEither(input, "subagent_type", toolInput.subagent_type);
    const description = readEither(input, "task_description", toolInput.description);
    if (subagentType !== undefined) {
      payload.subagent_type = subagentType.slice(0, maxTextLength);
    }
    if (description !== undefined) {
      payload.task_description = shortenText(description, maxDescriptionLength);
    }
  }
  if (eventName === "SubagentStop") {
    const summary = readEither(input, "summary", input.last_assistant_message);
    if (summary !== undefined) {
      payload.summary = shortenReport(summary, maxSummaryLength);
    }
  }
  return { ok: true, value: payload };
}
