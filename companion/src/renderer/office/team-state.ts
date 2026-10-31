import type { MemberSignal } from "../../shared/reaction.js";
import type { MemberId } from "../../shared/team.js";

export type MemberBehavior = "idle" | "working" | "done";

export interface MemberRuntime {
  /** agent_ids currently running for this member. */
  activeAgents: ReadonlySet<string>;
  lastTool: string | null;
  lastSignalAt: number;
  /** When the member went from no runs to at least one, for how long they have been working. */
  startedAt: number | null;
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
  return { activeAgents: new Set(), lastTool: null, lastSignalAt: 0, startedAt: null, finishedAt: null };
}

export function applyMemberSignal(runtime: MemberRuntime, signal: MemberSignal): MemberRuntime {
  const activeAgents = new Set(runtime.activeAgents);
  let finishedAt = runtime.finishedAt;
  let lastTool = runtime.lastTool;
  // A run that went stale without a stop counts as over, so the next event starts the clock again.
  const wasWorking = runtime.activeAgents.size > 0 && signal.receivedAt - runtime.lastSignalAt < staleRunMs;
  let startedAt = wasWorking ? runtime.startedAt : null;

  switch (signal.activity) {
    case "start":
      startedAt ??= signal.receivedAt;
      activeAgents.add(signal.agentId);
      finishedAt = null;
      lastTool = null;
      break;
    case "tool":
      // A tool event also proves the run is alive, even if we missed its start.
      startedAt ??= signal.receivedAt;
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
  return { activeAgents, lastTool, lastSignalAt: signal.receivedAt, startedAt, finishedAt };
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

/**
 * Every member goes back to idle, without the "done" cheer: the run was stopped, so no
 * SubagentStop will come, and the subagents ended with the process that ran them.
 */
export function endAllRuns(team: TeamRuntime, now: number): TeamRuntime {
  const ended = { ...team };
  for (const memberId of Object.keys(team) as (keyof TeamRuntime)[]) {
    const runtime = team[memberId];
    if (runtime.activeAgents.size > 0) {
      ended[memberId] = {
        activeAgents: new Set(),
        lastTool: null,
        lastSignalAt: now,
        startedAt: null,
        finishedAt: null,
      };
    }
  }
  return ended;
}

export function emptyTeamRuntime(): TeamRuntime {
  return {
    chizuru: emptyRuntime(),
    rias: emptyRuntime(),
    asuna: emptyRuntime(),
    kobayashi: emptyRuntime(),
    yor: emptyRuntime(),
    erza: emptyRuntime(),
    ruby: emptyRuntime(),
    arisu: emptyRuntime(),
    komachi: emptyRuntime(),
    miruku: emptyRuntime(),
    huagua: emptyRuntime(),
  };
}
