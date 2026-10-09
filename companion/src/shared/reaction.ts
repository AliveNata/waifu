import type { CompanionHookPayload } from "./hook-event.js";

export type Mood = "idle" | "greeting" | "thinking" | "working" | "waiting" | "done";

export interface Reaction {
  mood: Mood;
  /** Tool name or notification message, shown in the status chip. */
  detail: string | null;
  receivedAt: number;
}

/**
 * Moods that fade back to idle on their own. The rest persist until the next
 * hook event, because Claude Code sends no "finished thinking" event.
 */
export const transientMoodDurationMs: Partial<Record<Mood, number>> = {
  greeting: 3500,
  done: 5000,
};

export function reactionForHook(payload: CompanionHookPayload, receivedAt: number): Reaction | null {
  switch (payload.hook_event_name) {
    case "SessionStart":
      return { mood: "greeting", detail: null, receivedAt };
    case "UserPromptSubmit":
      return { mood: "thinking", detail: null, receivedAt };
    case "PreCompact":
      return { mood: "thinking", detail: "Merapikan konteks", receivedAt };
    case "PreToolUse":
    case "PostToolUse":
      return { mood: "working", detail: payload.tool_name ?? null, receivedAt };
    case "Notification":
      return { mood: "waiting", detail: payload.message ?? null, receivedAt };
    case "Stop":
      return { mood: "done", detail: null, receivedAt };
    case "SessionEnd":
      return { mood: "idle", detail: null, receivedAt };
    case "SubagentStop":
      // Subagents finishing is noise for a single-character office: the main
      // agent keeps working, so the current mood should hold.
      return null;
  }
}

export function idleReaction(receivedAt: number): Reaction {
  return { mood: "idle", detail: null, receivedAt };
}

/** Text for the status chip. `null` hides the chip. */
export function statusText(reaction: Reaction): string | null {
  switch (reaction.mood) {
    case "idle":
      return null;
    case "greeting":
      return "Halo, siap kerja";
    case "thinking":
      return reaction.detail ?? "Lagi mikir";
    case "working":
      return reaction.detail === null ? "Lagi ngerjain" : `Ngerjain: ${reaction.detail}`;
    case "waiting":
      return reaction.detail ?? "Nungguin lo";
    case "done":
      return "Selesai";
  }
}

export function isTransientExpired(reaction: Reaction, now: number): boolean {
  const duration = transientMoodDurationMs[reaction.mood];
  return duration !== undefined && now - reaction.receivedAt >= duration;
}
