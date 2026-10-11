import { type ChatEvent, summarizeToolInput } from "../../shared/office-chat.js";

/** What one line of `claude -p --output-format stream-json` means for the office chat. */
export interface StreamLine {
  events: ChatEvent[];
  /** Set by the init and result messages, so the next run can `--resume` the same conversation. */
  sessionId: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/** Subagents run their own conversations; the office chat shows the main thread only. */
function isMainThread(message: Record<string, unknown>): boolean {
  return message.parent_tool_use_id === null || message.parent_tool_use_id === undefined;
}

function streamEvent(message: Record<string, unknown>): ChatEvent[] {
  const event = asRecord(message.event);
  const delta = asRecord(event?.delta);
  if (event?.type === "content_block_delta" && delta?.type === "text_delta" && typeof delta.text === "string") {
    return [{ kind: "text", text: delta.text }];
  }
  return [];
}

function assistantMessage(message: Record<string, unknown>): ChatEvent[] {
  if (typeof message.error === "string") {
    return [{ kind: "error", message: `Claude error: ${message.error}` }];
  }
  const content = asRecord(message.message)?.content;
  if (!Array.isArray(content)) {
    return [];
  }
  // Text already arrived as stream deltas; complete messages only add the tool calls.
  return content.flatMap((block): ChatEvent[] => {
    const record = asRecord(block);
    if (record?.type !== "tool_use" || typeof record.name !== "string") {
      return [];
    }
    return [{ kind: "tool", toolName: record.name, summary: summarizeToolInput(record.name, record.input) }];
  });
}

function resultMessage(message: Record<string, unknown>): ChatEvent[] {
  const ok = message.subtype === "success" && message.is_error !== true;
  if (ok) {
    return [{ kind: "done", ok: true, message: null }];
  }
  const reason =
    typeof message.result === "string" && message.result.length > 0
      ? message.result
      : `run berhenti (${String(message.subtype)})`;
  return [{ kind: "done", ok: false, message: reason }];
}

/**
 * Parses one stdout line. Lines that are not JSON objects (a stray warning) are
 * reported by the caller, not thrown, so one odd line never ends the chat.
 */
export function parseStreamLine(line: string): StreamLine | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  const message = asRecord(parsed);
  if (message === null) {
    return null;
  }
  const sessionId = typeof message.session_id === "string" ? message.session_id : null;
  const capturesSession = (message.type === "system" && message.subtype === "init") || message.type === "result";
  const result: StreamLine = { events: [], sessionId: capturesSession ? sessionId : null };
  if (!isMainThread(message)) {
    return result;
  }
  switch (message.type) {
    case "stream_event":
      result.events = streamEvent(message);
      break;
    case "assistant":
      result.events = assistantMessage(message);
      break;
    case "result":
      result.events = resultMessage(message);
      break;
    default:
      break;
  }
  return result;
}
