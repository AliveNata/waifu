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
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const maxTextLength = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHookEventName(value: unknown): value is HookEventName {
  return typeof value === "string" && (supportedHookEventNames as readonly string[]).includes(value);
}

function readOptionalText(record: Record<string, unknown>, key: string): ParseResult<string | undefined> {
  const value = record[key];
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }
  if (typeof value !== "string") {
    return { ok: false, error: `${key} must be a string` };
  }
  return { ok: true, value: value.slice(0, maxTextLength) };
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
  return { ok: true, value: payload };
}
