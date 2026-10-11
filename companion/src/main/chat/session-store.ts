import { createReadStream } from "node:fs";
import { open, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { type ChatEvent, type ChatSessionSummary, summarizeToolInput } from "../../shared/office-chat.js";

/**
 * Claude Code's local sessions: one JSONL file per conversation under
 * `<config dir>/projects/<folder with every non-alphanumeric character as "-">/`.
 * Only this machine's sessions live there; cloud sessions never do.
 */

/** Session ids are UUIDs; checking the shape keeps a crafted id from naming another file. */
const sessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The first prompt is near the top; reading only this much keeps a long session cheap to list. */
const headBytes = 256 * 1024;
const maxTitleChars = 90;

export function isSessionId(value: string): boolean {
  return sessionIdPattern.test(value);
}

export function claudeConfigDir(env: NodeJS.ProcessEnv, home: string): string {
  const custom = env.CLAUDE_CONFIG_DIR;
  return custom !== undefined && custom !== "" ? custom : join(home, ".claude");
}

export function projectSessionsDir(configDir: string, projectDir: string): string {
  return join(configDir, "projects", projectDir.replace(/[^a-zA-Z0-9]/g, "-"));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/**
 * What the person typed, or null for everything else that is stored as a "user" line:
 * tool results, meta notes, subagent turns, and slash-command wrappers like `<command-name>`.
 */
export function promptText(entry: unknown): string | null {
  const record = asRecord(entry);
  if (record === null || record.type !== "user" || record.isMeta === true || record.isSidechain === true) {
    return null;
  }
  const content = asRecord(record.message)?.content;
  let text: string | null = null;
  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    const parts = content.flatMap((block) => {
      const part = asRecord(block);
      return part?.type === "text" && typeof part.text === "string" ? [part.text] : [];
    });
    text = parts.length === 0 ? null : parts.join("\n");
  }
  const trimmed = text?.trim() ?? "";
  return trimmed === "" || trimmed.startsWith("<") ? null : trimmed;
}

function shortTitle(prompt: string): string {
  const flat = prompt.replace(/\s+/g, " ");
  return flat.length <= maxTitleChars ? flat : `${flat.slice(0, maxTitleChars - 1).trimEnd()}…`;
}

async function firstPrompt(file: string): Promise<string | null> {
  const handle = await open(file, "r");
  try {
    const buffer = Buffer.alloc(headBytes);
    const { bytesRead } = await handle.read(buffer, 0, headBytes, 0);
    const lines = buffer.subarray(0, bytesRead).toString("utf8").split("\n");
    for (const line of lines) {
      let entry: unknown;
      try {
        entry = JSON.parse(line);
      } catch {
        // The last line of the head is usually cut mid-way; whole lines before it still count.
        continue;
      }
      const prompt = promptText(entry);
      if (prompt !== null) {
        return prompt;
      }
    }
    return null;
  } finally {
    await handle.close();
  }
}

/** Newest first. Sessions without a typed prompt (only setup or meta lines) are left out. */
export async function listSessions(sessionsDir: string, limit = 30): Promise<ChatSessionSummary[]> {
  let names: string[];
  try {
    names = await readdir(sessionsDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
  const files = await Promise.all(
    names
      .filter((name) => name.endsWith(".jsonl") && isSessionId(name.slice(0, -".jsonl".length)))
      .map(async (name) => ({ name, updatedAt: (await stat(join(sessionsDir, name))).mtimeMs })),
  );
  files.sort((a, b) => b.updatedAt - a.updatedAt);
  const sessions: ChatSessionSummary[] = [];
  for (const file of files) {
    if (sessions.length >= limit) {
      break;
    }
    const prompt = await firstPrompt(join(sessionsDir, file.name));
    if (prompt !== null) {
      sessions.push({ id: file.name.slice(0, -".jsonl".length), title: shortTitle(prompt), updatedAt: file.updatedAt });
    }
  }
  return sessions;
}

/** Chat events for one stored line: the prompt, or the reply text and tool calls of the main session. */
export function eventsForEntry(entry: unknown): ChatEvent[] {
  const prompt = promptText(entry);
  if (prompt !== null) {
    return [{ kind: "user", text: prompt }];
  }
  const record = asRecord(entry);
  if (record === null || record.type !== "assistant" || record.isSidechain === true) {
    return [];
  }
  const content = asRecord(record.message)?.content;
  if (!Array.isArray(content)) {
    return [];
  }
  return content.flatMap((block): ChatEvent[] => {
    const part = asRecord(block);
    if (part?.type === "text" && typeof part.text === "string" && part.text.trim() !== "") {
      return [{ kind: "text", text: part.text }];
    }
    if (part?.type === "tool_use" && typeof part.name === "string") {
      return [{ kind: "tool", toolName: part.name, summary: summarizeToolInput(part.name, part.input) }];
    }
    return [];
  });
}

/**
 * The end of a stored conversation as chat events, so the office shows where it left off.
 * Separate replies get a blank line between them, since the chat log joins adjacent text.
 */
export async function sessionTranscript(file: string, maxEvents = 60): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  const lines = createInterface({
    input: createReadStream(file, { encoding: "utf8" }),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  for await (const line of lines) {
    if (line.trim() === "") {
      continue;
    }
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch (error) {
      console.warn(`[chat] skipping an unreadable line in ${file}`, error);
      continue;
    }
    for (const event of eventsForEntry(entry)) {
      const previous = events.at(-1);
      events.push(
        event.kind === "text" && previous?.kind === "text" ? { kind: "text", text: `\n\n${event.text}` } : event,
      );
    }
    if (events.length > maxEvents * 2) {
      events.splice(0, events.length - maxEvents);
    }
  }
  const tail = events.slice(-maxEvents);
  // Start on a prompt when there is one, so the log does not open mid-reply.
  const firstPromptIndex = tail.findIndex((event) => event.kind === "user");
  return firstPromptIndex > 0 ? tail.slice(firstPromptIndex) : tail;
}
