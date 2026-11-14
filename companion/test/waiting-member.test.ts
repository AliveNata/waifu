import { describe, expect, it } from "vitest";
import { memberPlan } from "../src/renderer/office/office-director.js";
import { stations } from "../src/renderer/office/office-plan.js";
import { statusRows, TwobStatus } from "../src/renderer/office/status-board.js";
import { applyMemberSignal, emptyTeamRuntime, type TeamRuntime } from "../src/renderer/office/team-state.js";
import { permissionTool, WaitingCalls, waitingTeammate } from "../src/renderer/office/waiting-member.js";
import type { MemberSignal, Reaction } from "../src/shared/reaction.js";

function toolSignal(memberId: MemberSignal["memberId"], tool: string, receivedAt: number): MemberSignal {
  return { memberId, activity: "tool", agentId: `${memberId}-run`, tool, summary: null, receivedAt };
}

function withTool(team: TeamRuntime, memberId: keyof TeamRuntime, tool: string, at: number): TeamRuntime {
  return { ...team, [memberId]: applyMemberSignal(team[memberId], toolSignal(memberId, tool, at)) };
}

function waiting(message: string | null, receivedAt: number): Reaction {
  return { mood: "waiting", detail: message, receivedAt };
}

describe("who a permission prompt is for", () => {
  it("reads the tool out of Claude Code's permission notification", () => {
    // Act and Assert
    expect(permissionTool("Claude needs your permission to use Bash")).toBe("Bash");
    expect(permissionTool("Claude needs your permission to use mcp__github__create_issue.")).toBe(
      "mcp__github__create_issue",
    );
    expect(permissionTool("Claude is waiting for your input")).toBeNull();
    expect(permissionTool(null)).toBeNull();
  });

  it("picks the one teammate at work whose last tool is the one asked about", () => {
    // Arrange
    let team = withTool(emptyTeamRuntime(), "yor", "Bash", 1_000);
    team = withTool(team, "erza", "Read", 1_000);

    // Act
    const memberId = waitingTeammate(team, "Bash", 2_000);

    // Assert
    expect(memberId).toBe("yor");
  });

  it("guesses nobody when two teammates are on the same tool, or none is", () => {
    // Arrange
    let team = withTool(emptyTeamRuntime(), "yor", "Bash", 1_000);
    team = withTool(team, "asuna", "Bash", 1_000);

    // Act and Assert
    expect(waitingTeammate(team, "Bash", 2_000)).toBeNull();
    expect(waitingTeammate(team, "Write", 2_000)).toBeNull();
  });
});

describe("waiting calls", () => {
  it("rings once per notification and keeps the teammate waiting until they move on", () => {
    // Arrange
    let team = withTool(emptyTeamRuntime(), "miruku", "Bash", 1_000);
    const calls = new WaitingCalls();
    const notification = waiting("Claude needs your permission to use Bash", 2_000);

    // Act
    const first = calls.observe(notification, team, 2_000);
    const again = calls.observe(notification, team, 2_100);
    const stillWaiting = calls.waiting(team, 3_000);
    team = withTool(team, "miruku", "Read", 4_000);
    const afterNextTool = calls.waiting(team, 4_100);

    // Assert
    expect(first).toBe(true);
    expect(again).toBe(false);
    expect(stillWaiting).toBe("miruku");
    expect(afterNextTool).toBeNull();
  });

  it("lets go of the teammate once the main session is no longer waiting", () => {
    // Arrange
    const team = withTool(emptyTeamRuntime(), "kobayashi", "Edit", 1_000);
    const calls = new WaitingCalls();
    calls.observe(waiting("Claude needs your permission to use Edit", 2_000), team, 2_000);

    // Act
    calls.observe({ mood: "working", detail: "Agent", receivedAt: 3_000 }, team, 3_000);

    // Assert
    expect(calls.waiting(team, 3_100)).toBeNull();
  });

  it("puts the waiting teammate on the board without the prompt's text", () => {
    // Arrange
    const team = withTool(emptyTeamRuntime(), "huagua", "Bash", 1_000);

    // Act
    const rows = statusRows(team, new TwobStatus(), 2_000, undefined, { memberId: "huagua", since: 1_500 });
    const row = rows.find((candidate) => candidate.memberId === "huagua");

    // Assert
    expect(row?.status).toBe("waiting");
    expect(row?.tool).toBeNull();
    expect(row?.since).toBe(1_500);
  });

  it("sends the waiting teammate to stand by their desk facing the camera and wave", () => {
    // Act
    const plan = memberPlan("rias", "waiting", null);

    // Assert
    expect(plan.action).toBe("wave");
    expect(plan.station).toBe("call-rias");
    expect(stations["call-rias"].seatHeight).toBeNull();
    expect(stations["call-rias"].spot).toEqual(stations["desk-rias"].approach);
  });
});
