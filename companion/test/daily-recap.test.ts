import { describe, expect, it, vi } from "vitest";
import {
  DailyRecap,
  emptyTally,
  inRecapWindow,
  recapLine,
  summarize,
  type TallyStore,
  tallySignal,
  workLabel,
} from "../src/renderer/office/daily-recap.js";
import { officeDay } from "../src/renderer/office/office-rituals.js";
import { applyMemberSignal, emptyRuntime, type MemberRuntime, staleRunMs } from "../src/renderer/office/team-state.js";
import type { MemberSignal } from "../src/shared/reaction.js";

function signal(
  activity: MemberSignal["activity"],
  receivedAt: number,
  tool: string | null = null,
  agentId = "a",
): MemberSignal {
  return { memberId: "asuna", activity, agentId, tool, summary: null, receivedAt };
}

/** Feeds the signals through the runtime and the tally together, as the stage does. */
function run(signals: MemberSignal[]): { tally: ReturnType<typeof emptyTally>; runtime: MemberRuntime } {
  let tally = emptyTally("2026-11-14");
  let runtime = emptyRuntime();
  for (const next of signals) {
    const after = applyMemberSignal(runtime, next);
    tally = tallySignal(tally, next, runtime, after);
    runtime = after;
  }
  return { tally, runtime };
}

function memoryStore(text: string | null = null): TallyStore & { saved: string | null } {
  const store = {
    saved: text,
    load: () => store.saved,
    save: (next: string) => {
      store.saved = next;
    },
  };
  return store;
}

describe("the day's tally", () => {
  it("counts tools as they are used and a task with its time when the run stops", () => {
    // Act
    const { tally } = run([
      signal("start", 0),
      signal("tool", 60_000, "Read"),
      signal("tool", 120_000, "Edit"),
      signal("tool", 180_000, "Edit"),
      signal("stop", 8 * 60_000),
    ]);

    // Assert
    expect(tally.members.asuna).toEqual({ done: 1, workMs: 8 * 60_000, tools: { Read: 1, Edit: 2 } });
  });

  it("counts parallel runs as separate tasks but their time once", () => {
    // Act
    const { tally } = run([
      signal("start", 0, null, "one"),
      signal("start", 60_000, null, "two"),
      signal("stop", 120_000, null, "one"),
      signal("stop", 600_000, null, "two"),
    ]);

    // Assert
    expect(tally.members.asuna?.done).toBe(2);
    expect(tally.members.asuna?.workMs).toBe(600_000);
  });

  it("adds no idle hours for a run that went quiet before its stop came", () => {
    // Act: the last sign of life at 1 minute, the stop five hours later.
    const { tally } = run([signal("start", 0), signal("tool", 60_000, "Bash"), signal("stop", 5 * 3_600_000)]);

    // Assert
    expect(tally.members.asuna?.workMs).toBe(60_000 + staleRunMs);
  });

  it("sums the team and says who finished the most", () => {
    // Arrange
    const tally = {
      day: "2026-11-14",
      members: {
        asuna: { done: 2, workMs: 90 * 60_000, tools: { Edit: 4, Read: 2 } },
        yor: { done: 3, workMs: 50 * 60_000, tools: { Bash: 6 } },
      },
    };

    // Act
    const summary = summarize(tally);

    // Assert
    expect(summary.done).toBe(5);
    expect(summary.topTools[0]).toEqual(["Bash", 6]);
    expect(summary.topMembers[0]).toEqual(["yor", 3]);
    expect(recapLine(summary)).toBe(
      "Rekap hari ini: 5 tugas selesai, total kerja 2 jam 20 mnt. Paling banyak Yor, 3 tugas.",
    );
    expect(recapLine(summarize(emptyTally("2026-11-14")))).toContain("belum ada tugas");
  });

  it("writes working time short enough for the board", () => {
    // Act and Assert
    expect(workLabel(20_000)).toBe("kurang dari 1 mnt");
    expect(workLabel(45 * 60_000)).toBe("45 mnt");
    expect(workLabel(120 * 60_000)).toBe("2 jam");
  });

  it("shows the recap for ten minutes from five in the afternoon", () => {
    // Act and Assert
    expect(inRecapWindow(16.99)).toBe(false);
    expect(inRecapWindow(17)).toBe(true);
    expect(inRecapWindow(17.16)).toBe(true);
    expect(inRecapWindow(17.17)).toBe(false);
  });
});

describe("keeping the tally", () => {
  it("picks today's tally back up after a restart, and starts afresh on a new day", () => {
    // Arrange
    const now = new Date("2026-11-14T08:00:00Z");
    const store = memoryStore();
    const first = new DailyRecap(store, now);
    first.record(signal("tool", now.getTime(), "Grep"), emptyRuntime(), emptyRuntime());

    // Act
    const restarted = new DailyRecap(store, now).today(now);
    const tomorrow = new DailyRecap(store, new Date("2026-11-15T08:00:00Z")).today(new Date("2026-11-15T08:00:00Z"));

    // Assert
    expect(restarted.day).toBe(officeDay(now));
    expect(restarted.members.asuna?.tools).toEqual({ Grep: 1 });
    expect(tomorrow.members).toEqual({});
  });

  it("starts the day afresh when what was saved cannot be read", () => {
    // Arrange
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const now = new Date("2026-11-14T08:00:00Z");

    // Act
    const tally = new DailyRecap(memoryStore("{not json"), now).today(now);
    const calls = logged.mock.calls.length;
    logged.mockRestore();

    // Assert
    expect(tally.members).toEqual({});
    expect(calls).toBeGreaterThan(0);
  });
});
