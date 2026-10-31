import type { Reaction } from "../../shared/reaction.js";
import { type MemberId, memberIds, roster } from "../../shared/team.js";
import { type MemberRuntime, memberBehavior, type TeamRuntime } from "./team-state.js";

/** What the team status board says about one member, from the real hook events only. */
export type BoardStatus = "working" | "waiting" | "done" | "idle";

export interface StatusRow {
  memberId: MemberId;
  name: string;
  role: string;
  status: BoardStatus;
  /** Tool name only. Never message text or file contents: the board is on a wall anyone can see. */
  tool: string | null;
  /** When the current status began: the run's start while working, the finish while done. */
  since: number | null;
}

/**
 * How long "selesai" stays on the board after a run. The office's own "done" cheer lasts seconds,
 * but the board is for glancing at later, so it keeps the result long enough to be seen.
 */
export const boardDoneMs = 15 * 60 * 1000;

export const statusLabels: Record<BoardStatus, string> = {
  working: "kerja",
  waiting: "nunggu kamu",
  done: "selesai",
  idle: "idle",
};

export function memberRow(memberId: Exclude<MemberId, "twob">, runtime: MemberRuntime, now: number): StatusRow {
  const { displayName: name, role } = roster[memberId];
  if (memberBehavior(runtime, now) === "working") {
    return { memberId, name, role, status: "working", tool: runtime.lastTool, since: runtime.startedAt };
  }
  if (runtime.finishedAt !== null && now - runtime.finishedAt < boardDoneMs) {
    return { memberId, name, role, status: "done", tool: null, since: runtime.finishedAt };
  }
  return { memberId, name, role, status: "idle", tool: null, since: null };
}

/**
 * 2B's status from the main session's reactions. Her reaction carries no run start and fades from
 * "done" to idle after a few seconds, so this keeps both across reactions.
 */
export class TwobStatus {
  private busySince: number | null = null;
  private doneAt: number | null = null;
  private latest: Reaction | null = null;

  observe(reaction: Reaction): void {
    if (reaction === this.latest) {
      return;
    }
    this.latest = reaction;
    if (reaction.mood === "working" || reaction.mood === "thinking") {
      this.busySince ??= reaction.receivedAt;
      this.doneAt = null;
      return;
    }
    this.busySince = null;
    if (reaction.mood === "done") {
      this.doneAt = reaction.receivedAt;
    }
  }

  row(now: number): StatusRow {
    const { displayName: name, role } = roster.twob;
    const base = { memberId: "twob" as const, name, role };
    const reaction = this.latest;
    if (reaction !== null && this.busySince !== null) {
      // While busy the detail is a tool name or one of the fixed labels in reactionForHook.
      return { ...base, status: "working", tool: reaction.detail, since: this.busySince };
    }
    if (reaction?.mood === "waiting") {
      // A notification's text can quote a command or a path, so only the status goes up.
      return { ...base, status: "waiting", tool: null, since: reaction.receivedAt };
    }
    if (this.doneAt !== null && now - this.doneAt < boardDoneMs) {
      return { ...base, status: "done", tool: null, since: this.doneAt };
    }
    return { ...base, status: "idle", tool: null, since: null };
  }
}

/** Every member in roster order, 2B first. */
export function statusRows(team: TeamRuntime, twob: TwobStatus, now: number): StatusRow[] {
  return memberIds.map((memberId) => (memberId === "twob" ? twob.row(now) : memberRow(memberId, team[memberId], now)));
}

/** Short elapsed time for a small wall display: "baru", "40 dtk", "12 mnt", "2 jam". */
export function elapsedLabel(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 10) {
    return "baru";
  }
  if (seconds < 60) {
    return `${seconds} dtk`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} mnt`;
  }
  return `${Math.floor(minutes / 60)} jam`;
}

/** The right-hand detail of a row: the tool and how long, or how long ago it finished. */
export function rowDetail(row: StatusRow, now: number): string {
  if (row.since === null) {
    return "";
  }
  const elapsed = elapsedLabel(now - row.since);
  if (row.status === "done") {
    return elapsed === "baru" ? "baru saja" : `${elapsed} lalu`;
  }
  return row.tool === null ? elapsed : `${shortTool(row.tool)} · ${elapsed}`;
}

/** MCP tool names run long (server and tool joined), and the elapsed time must stay visible. */
const toolNameLimit = 24;

function shortTool(tool: string): string {
  return tool.length <= toolNameLimit ? tool : `${tool.slice(0, toolNameLimit - 1)}…`;
}
