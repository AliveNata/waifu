import type { MemberSignal } from "../../shared/reaction.js";
import type { MemberId } from "../../shared/team.js";

export type MemberBehavior = "idle" | "working" | "done";

export interface MemberRuntime {
  /** agent_ids currently running for this member. */
  activeAgents: ReadonlySet<string>;
  lastTool: string | null;
  lastSignalAt: number;
  finishedAt: number | null;
}

/** How long the "done" celebration lasts after the last run of a member stops. */
export const doneDurationMs = 4000;
/**
 * A run with no events for this long is treated as finished. Covers a missed
 * SubagentStop, for example when the companion was restarted mid-run.
 */
export const staleRunMs = 10 * 60 * 1000;

export function emptyRuntime(): MemberRuntime {
  return { activeAgents: new Set(), lastTool: null, lastSignalAt: 0, finishedAt: null };
}

export function applyMemberSignal(runtime: MemberRuntime, signal: MemberSignal): MemberRuntime {
  const activeAgents = new Set(runtime.activeAgents);
  let finishedAt = runtime.finishedAt;
  let lastTool = runtime.lastTool;

  switch (signal.activity) {
    case "start":
      activeAgents.add(signal.agentId);
      finishedAt = null;
      lastTool = null;
      break;
    case "tool":
      // A tool event also proves the run is alive, even if we missed its start.
      activeAgents.add(signal.agentId);
      finishedAt = null;
      lastTool = signal.tool;
      break;
    case "stop":
      activeAgents.delete(signal.agentId);
      if (activeAgents.size === 0) {
        finishedAt = signal.receivedAt;
      }
      break;
  }
  return { activeAgents, lastTool, lastSignalAt: signal.receivedAt, finishedAt };
}

export function memberBehavior(runtime: MemberRuntime, now: number): MemberBehavior {
  if (runtime.activeAgents.size > 0 && now - runtime.lastSignalAt < staleRunMs) {
    return "working";
  }
  if (runtime.finishedAt !== null && now - runtime.finishedAt < doneDurationMs) {
    return "done";
  }
  return "idle";
}

export type TeamRuntime = Record<Exclude<MemberId, "twob">, MemberRuntime>;

export function emptyTeamRuntime(): TeamRuntime {
  return {
    chizuru: emptyRuntime(),
    rias: emptyRuntime(),
    asuna: emptyRuntime(),
    kobayashi: emptyRuntime(),
    yor: emptyRuntime(),
    erza: emptyRuntime(),
    ruby: emptyRuntime(),
  };
}
