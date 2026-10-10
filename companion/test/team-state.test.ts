import { describe, expect, it } from "vitest";
import {
  applyMemberSignal,
  doneDurationMs,
  emptyRuntime,
  memberBehavior,
  staleRunMs,
} from "../src/renderer/office/team-state.js";
import type { MemberSignal } from "../src/shared/reaction.js";

function signal(activity: MemberSignal["activity"], agentId: string, receivedAt: number): MemberSignal {
  return { memberId: "asuna", activity, agentId, tool: activity === "tool" ? "Edit" : null, summary: null, receivedAt };
}

describe("member runtime", () => {
  it("works while a run is active and celebrates briefly after it stops", () => {
    // Arrange
    let runtime = applyMemberSignal(emptyRuntime(), signal("start", "a", 0));

    // Act + Assert
    expect(memberBehavior(runtime, 10)).toBe("working");
    runtime = applyMemberSignal(runtime, signal("stop", "a", 100));
    expect(memberBehavior(runtime, 100 + doneDurationMs - 1)).toBe("done");
    expect(memberBehavior(runtime, 100 + doneDurationMs)).toBe("idle");
  });

  it("keeps working until every parallel run of the same agent stops", () => {
    // Arrange
    let runtime = applyMemberSignal(emptyRuntime(), signal("start", "a", 0));
    runtime = applyMemberSignal(runtime, signal("start", "b", 1));

    // Act
    runtime = applyMemberSignal(runtime, signal("stop", "a", 2));

    // Assert
    expect(memberBehavior(runtime, 3)).toBe("working");
  });

  it("treats a tool event as proof of life when the start was missed", () => {
    // Act
    const runtime = applyMemberSignal(emptyRuntime(), signal("tool", "a", 5));

    // Assert
    expect(memberBehavior(runtime, 6)).toBe("working");
    expect(runtime.lastTool).toBe("Edit");
  });

  it("gives up on a run that went silent, in case its stop event was missed", () => {
    // Arrange
    const runtime = applyMemberSignal(emptyRuntime(), signal("start", "a", 0));

    // Act + Assert
    expect(memberBehavior(runtime, staleRunMs + 1)).toBe("idle");
  });
});
