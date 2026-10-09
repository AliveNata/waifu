import type { CompanionHookPayload } from "./hook-event.js";
import { type MemberId, memberForAgentType } from "./team.js";

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

/** Tool names Claude Code uses when the main session hands work to a subagent. */
const delegationTools = new Set(["Agent", "Task"]);

/** Xenovia's reaction. Only main-session events count: anything carrying an agent_id came from a subagent. */
export function reactionForHook(payload: CompanionHookPayload, receivedAt: number): Reaction | null {
  if (payload.agent_id !== undefined) {
    return null;
  }
  switch (payload.hook_event_name) {
    case "SessionStart":
      return { mood: "greeting", detail: null, receivedAt };
    case "UserPromptSubmit":
      return { mood: "thinking", detail: null, receivedAt };
    case "PreCompact":
      return { mood: "thinking", detail: "Merapikan konteks", receivedAt };
    case "PreToolUse":
    case "PostToolUse": {
      const tool = payload.tool_name ?? null;
      const detail = tool !== null && delegationTools.has(tool) ? "Delegasi ke tim" : tool;
      return { mood: "working", detail, receivedAt };
    }
    case "Notification":
      return { mood: "waiting", detail: payload.message ?? null, receivedAt };
    case "Stop":
      return { mood: "done", detail: null, receivedAt };
    case "SessionEnd":
      return { mood: "idle", detail: null, receivedAt };
    case "SubagentStart":
    case "SubagentStop":
      // The main agent keeps working while a subagent runs, so Xenovia's mood holds.
      return null;
  }
}

export type MemberActivity = "start" | "tool" | "stop";

export interface MemberSignal {
  memberId: MemberId;
  activity: MemberActivity;
  /** Distinguishes parallel runs of the same subagent. */
  agentId: string;
  tool: string | null;
  receivedAt: number;
}

/** Activity of a team member, or null for main-session events and subagents outside the roster (Explore, Plan, ...). */
export function memberSignalForHook(payload: CompanionHookPayload, receivedAt: number): MemberSignal | null {
  if (payload.agent_id === undefined || payload.agent_type === undefined) {
    return null;
  }
  const memberId = memberForAgentType(payload.agent_type);
  if (memberId === null) {
    return null;
  }
  const base = { memberId, agentId: payload.agent_id, receivedAt };
  switch (payload.hook_event_name) {
    case "SubagentStart":
      return { ...base, activity: "start", tool: null };
    case "SubagentStop":
      return { ...base, activity: "stop", tool: null };
    case "PreToolUse":
    case "PostToolUse":
      return { ...base, activity: "tool", tool: payload.tool_name ?? null };
    default:
      return null;
  }
}

export type CompanionSignal = { kind: "reaction"; reaction: Reaction } | { kind: "member"; member: MemberSignal };

export function signalsForHook(payload: CompanionHookPayload, receivedAt: number): CompanionSignal[] {
  const signals: CompanionSignal[] = [];
  const reaction = reactionForHook(payload, receivedAt);
  if (reaction !== null) {
    signals.push({ kind: "reaction", reaction });
  }
  const member = memberSignalForHook(payload, receivedAt);
  if (member !== null) {
    signals.push({ kind: "member", member });
  }
  return signals;
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
