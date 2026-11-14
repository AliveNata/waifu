import type { Reaction } from "../../shared/reaction.js";
import type { MemberId } from "../../shared/team.js";
import { memberBehavior, staleRunMs, type TeamRuntime } from "./team-state.js";

export type Teammate = Exclude<MemberId, "twob">;

/**
 * The tool a permission notification asks about, from Claude Code's wording ("Claude needs your
 * permission to use Bash"), or null for any other notification (waiting for input and the like).
 */
export function permissionTool(message: string | null): string | null {
  if (message === null) {
    return null;
  }
  const match = /permission to use (\S+)/i.exec(message);
  return match?.[1]?.replace(/[.,;:!?]+$/, "") ?? null;
}

/**
 * Who a permission prompt is most likely for. A teammate's prompt reaches the office through the
 * main session, without saying whose it is, so the guess is the one teammate at work whose last
 * tool is the tool asked about. Two or more such teammates, or none, and it is nobody's: better
 * that 2B alone calls than the wrong teammate does.
 */
export function waitingTeammate(team: TeamRuntime, tool: string | null, now: number): Teammate | null {
  if (tool === null) {
    return null;
  }
  const candidates = (Object.keys(team) as Teammate[]).filter(
    (memberId) => memberBehavior(team[memberId], now) === "working" && team[memberId].lastTool === tool,
  );
  return candidates.length === 1 ? (candidates[0] ?? null) : null;
}

/**
 * Tracks the main session's "waiting for you" notifications: whether each is new, for a single
 * chime, and which teammate (if any) is waiting on it, until that teammate moves on.
 */
export class WaitingCalls {
  private seen: number | null = null;
  private call: { memberId: Teammate; since: number } | null = null;

  /** Takes 2B's latest reaction; true when it is a notification not seen before. */
  observe(reaction: Reaction, team: TeamRuntime, now: number): boolean {
    if (reaction.mood !== "waiting") {
      this.call = null;
      return false;
    }
    if (this.seen === reaction.receivedAt) {
      return false;
    }
    this.seen = reaction.receivedAt;
    const memberId = waitingTeammate(team, permissionTool(reaction.detail), now);
    this.call = memberId === null ? null : { memberId, since: reaction.receivedAt };
    return true;
  }

  /**
   * The teammate still waiting, or null. Any new event from them (the next tool, the run's end)
   * means the prompt was answered; a run gone quiet for good is let go too.
   */
  waiting(team: TeamRuntime, now: number): Teammate | null {
    const call = this.call;
    if (call === null) {
      return null;
    }
    const runtime = team[call.memberId];
    if (
      runtime.lastSignalAt > call.since ||
      memberBehavior(runtime, now) !== "working" ||
      now - call.since > staleRunMs
    ) {
      this.call = null;
      return null;
    }
    return call.memberId;
  }

  /** When the current call began, for the board's elapsed time. */
  since(): number | null {
    return this.call?.since ?? null;
  }
}
