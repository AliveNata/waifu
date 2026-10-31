import { describe, expect, it } from "vitest";
import {
  boardDoneMs,
  elapsedLabel,
  memberRow,
  rowDetail,
  statusRows,
  TwobStatus,
} from "../src/renderer/office/status-board.js";
import { applyMemberSignal, emptyRuntime, emptyTeamRuntime, staleRunMs } from "../src/renderer/office/team-state.js";
import type { MemberSignal, Reaction } from "../src/shared/reaction.js";
import { memberIds } from "../src/shared/team.js";

function signal(activity: MemberSignal["activity"], receivedAt: number, tool: string | null = null): MemberSignal {
  return { memberId: "erza", activity, agentId: "a", tool, summary: null, receivedAt };
}

function reaction(mood: Reaction["mood"], receivedAt: number, detail: string | null = null): Reaction {
  return { mood, detail, receivedAt };
}

describe("member rows", () => {
  it("shows the last tool and how long the run has gone, from its start", () => {
    // Arrange
    let runtime = applyMemberSignal(emptyRuntime(), signal("start", 1_000));
    runtime = applyMemberSignal(runtime, signal("tool", 61_000, "Grep"));

    // Act
    const row = memberRow("erza", runtime, 181_000);

    // Assert
    expect(row.status).toBe("working");
    expect(rowDetail(row, 181_000)).toBe("Grep · 3 mnt");
  });

  it("keeps a finished run on the board as done, then goes idle", () => {
    // Arrange
    let runtime = applyMemberSignal(emptyRuntime(), signal("start", 0));
    runtime = applyMemberSignal(runtime, signal("stop", 10_000));

    // Act
    const soon = memberRow("erza", runtime, 10_000 + 120_000);
    const later = memberRow("erza", runtime, 10_000 + boardDoneMs);

    // Assert
    expect(soon.status).toBe("done");
    expect(rowDetail(soon, 10_000 + 120_000)).toBe("2 mnt lalu");
    expect(later.status).toBe("idle");
    expect(rowDetail(later, 10_000 + boardDoneMs)).toBe("");
  });

  it("restarts the run clock when a stale run is picked up again", () => {
    // Arrange: a run whose stop was missed, then a new event long after.
    let runtime = applyMemberSignal(emptyRuntime(), signal("start", 0));
    const resumedAt = staleRunMs + 5_000;
    runtime = applyMemberSignal(runtime, signal("tool", resumedAt, "Read"));

    // Act
    const row = memberRow("erza", runtime, resumedAt + 30_000);

    // Assert
    expect(row.since).toBe(resumedAt);
  });

  it("shortens a long tool name but keeps the elapsed time", () => {
    // Arrange
    const runtime = applyMemberSignal(emptyRuntime(), signal("tool", 0, "mcp__github__pull_request_read"));

    // Act
    const detail = rowDetail(memberRow("erza", runtime, 20_000), 20_000);

    // Assert
    expect(detail).toBe("mcp__github__pull_reque… · 20 dtk");
  });
});

describe("2B's row", () => {
  it("counts from the first busy reaction, not the latest tool", () => {
    // Arrange
    const twob = new TwobStatus();
    twob.observe(reaction("thinking", 0));
    twob.observe(reaction("working", 90_000, "Bash"));

    // Act
    const row = twob.row(120_000);

    // Assert
    expect(row.status).toBe("working");
    expect(rowDetail(row, 120_000)).toBe("Bash · 2 mnt");
  });

  it("never shows a notification's text while waiting", () => {
    // Arrange
    const twob = new TwobStatus();
    twob.observe(reaction("waiting", 0, "Claude needs your permission to use Bash: cat ~/.env"));

    // Act
    const row = twob.row(5_000);

    // Assert
    expect(row.status).toBe("waiting");
    expect(row.tool).toBeNull();
  });

  it("stays done after her done reaction fades back to idle", () => {
    // Arrange
    const twob = new TwobStatus();
    twob.observe(reaction("working", 0, "Edit"));
    twob.observe(reaction("done", 60_000));
    twob.observe(reaction("idle", 65_000));

    // Act
    const row = twob.row(120_000);

    // Assert
    expect(row.status).toBe("done");
    expect(rowDetail(row, 120_000)).toBe("1 mnt lalu");
  });
});

describe("statusRows", () => {
  it("lists the whole team in roster order, idle when nothing has happened", () => {
    // Act
    const rows = statusRows(emptyTeamRuntime(), new TwobStatus(), 0);

    // Assert
    expect(rows.map((row) => row.memberId)).toEqual([...memberIds]);
    expect(rows.every((row) => row.status === "idle")).toBe(true);
  });
});

describe("elapsedLabel", () => {
  it.each([
    [3_000, "baru"],
    [45_000, "45 dtk"],
    [12 * 60_000, "12 mnt"],
    [2 * 3_600_000 + 5 * 60_000, "2 jam"],
  ])("labels %d ms as %s", (milliseconds, expected) => {
    // Act + Assert
    expect(elapsedLabel(milliseconds)).toBe(expected);
  });
});
