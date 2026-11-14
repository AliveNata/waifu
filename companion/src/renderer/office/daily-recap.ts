import type { MemberSignal } from "../../shared/reaction.js";
import { type MemberId, roster } from "../../shared/team.js";
import { officeDay } from "./office-rituals.js";
import { type MemberRuntime, staleRunMs } from "./team-state.js";

type Teammate = Exclude<MemberId, "twob">;

/**
 * The day's work for the recap at the end of the afternoon: per teammate, how many runs finished,
 * how long they ran and which tools they used. Counts and tool names only, the same as the status
 * board: never what was asked or what came back.
 */
export interface MemberTally {
  done: number;
  workMs: number;
  tools: Record<string, number>;
}

export interface DayTally {
  /** The office's own date (Jakarta), as officeDay gives it. */
  day: string;
  members: Partial<Record<Teammate, MemberTally>>;
}

/** When the board shows the recap and Arisu reads it out, in Jakarta hours: 17:00 to 17:10. */
export const recapWindow = { from: 17, to: 17 + 10 / 60 } as const;

export function inRecapWindow(hours: number): boolean {
  return hours >= recapWindow.from && hours < recapWindow.to;
}

export function emptyTally(day: string): DayTally {
  return { day, members: {} };
}

/**
 * The tally after one teammate's hook signal. `before` is their runtime as it was, `after` as the
 * signal left it. Each run that stops is one task done, parallel ones included. Working time is
 * counted once all their runs are over, from when they started working; a run that went quiet
 * for longer than the stale limit counts only up to then, so a missed stop adds no idle hours.
 */
export function tallySignal(
  tally: DayTally,
  signal: MemberSignal,
  before: MemberRuntime,
  after: MemberRuntime,
): DayTally {
  if (signal.memberId === "twob") {
    return tally;
  }
  const current = tally.members[signal.memberId] ?? { done: 0, workMs: 0, tools: {} };
  let next = current;
  if (signal.activity === "tool" && signal.tool !== null) {
    next = { ...current, tools: { ...current.tools, [signal.tool]: (current.tools[signal.tool] ?? 0) + 1 } };
  } else if (signal.activity === "stop" && before.activeAgents.has(signal.agentId)) {
    let workMs = current.workMs;
    if (after.activeAgents.size === 0 && before.startedAt !== null) {
      const end = Math.min(signal.receivedAt, before.lastSignalAt + staleRunMs);
      workMs += Math.max(0, end - before.startedAt);
    }
    next = { ...current, done: current.done + 1, workMs };
  }
  return next === current ? tally : { ...tally, members: { ...tally.members, [signal.memberId]: next } };
}

export interface RecapSummary {
  done: number;
  workMs: number;
  /** The most used tools across the team, most first. */
  topTools: [string, number][];
  /** The teammates who finished the most runs, most first, only those who finished any. */
  topMembers: [Teammate, number][];
}

export function summarize(tally: DayTally): RecapSummary {
  const entries = Object.entries(tally.members) as [Teammate, MemberTally][];
  const tools = new Map<string, number>();
  for (const [, member] of entries) {
    for (const [tool, count] of Object.entries(member.tools)) {
      tools.set(tool, (tools.get(tool) ?? 0) + count);
    }
  }
  return {
    done: entries.reduce((sum, [, member]) => sum + member.done, 0),
    workMs: entries.reduce((sum, [, member]) => sum + member.workMs, 0),
    topTools: [...tools.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3),
    topMembers: entries
      .filter(([, member]) => member.done > 0)
      .map(([memberId, member]): [Teammate, number] => [memberId, member.done])
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  };
}

/** "3 jam 20 mnt", "45 mnt", or "kurang dari 1 mnt". */
export function workLabel(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60000);
  if (minutes < 1) {
    return "kurang dari 1 mnt";
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} mnt`;
  }
  return rest === 0 ? `${hours} jam` : `${hours} jam ${rest} mnt`;
}

/** What Arisu, the PM, says when the recap goes up. */
export function recapLine(summary: RecapSummary): string {
  if (summary.done === 0) {
    return "Rekap hari ini: belum ada tugas yang selesai. Besok kita gas lagi.";
  }
  const lead = summary.topMembers[0];
  const most = lead === undefined ? "" : ` Paling banyak ${roster[lead[0]].displayName}, ${lead[1]} tugas.`;
  return `Rekap hari ini: ${summary.done} tugas selesai, total kerja ${workLabel(summary.workMs)}.${most}`;
}

/** Where the tally is kept between runs of the app. A wrapper so tests need no browser storage. */
export interface TallyStore {
  load(): string | null;
  save(text: string): void;
}

const storageKey = "office.dailyRecap";

export const browserTallyStore: TallyStore = {
  load: () => {
    try {
      return window.localStorage.getItem(storageKey);
    } catch (error) {
      console.error("[office] could not read the day's recap", error);
      return null;
    }
  },
  save: (text) => {
    try {
      window.localStorage.setItem(storageKey, text);
    } catch (error) {
      console.error("[office] could not save the day's recap", error);
    }
  },
};

/** The running tally for today, started afresh when the office's day turns over. */
export class DailyRecap {
  private tally: DayTally;

  constructor(
    private readonly store: TallyStore,
    now: Date,
  ) {
    this.tally = this.restore(officeDay(now));
  }

  record(signal: MemberSignal, before: MemberRuntime, after: MemberRuntime): void {
    this.turnOver(new Date(signal.receivedAt));
    const next = tallySignal(this.tally, signal, before, after);
    if (next !== this.tally) {
      this.tally = next;
      this.store.save(JSON.stringify(next));
    }
  }

  today(now: Date): DayTally {
    this.turnOver(now);
    return this.tally;
  }

  private turnOver(now: Date): void {
    const day = officeDay(now);
    if (this.tally.day !== day) {
      this.tally = emptyTally(day);
    }
  }

  private restore(day: string): DayTally {
    const text = this.store.load();
    if (text === null) {
      return emptyTally(day);
    }
    try {
      const saved = JSON.parse(text) as DayTally;
      return saved.day === day && typeof saved.members === "object" ? saved : emptyTally(day);
    } catch (error) {
      console.error("[office] the saved recap could not be read, starting the day afresh", error);
      return emptyTally(day);
    }
  }
}
