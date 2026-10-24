import { describe, expect, it } from "vitest";
import { type BoardFocus, type OfficePoseInput, officePose } from "../src/renderer/office/office-pose.js";

function drawing(board: BoardFocus): OfficePoseInput {
  return {
    action: "draw",
    walkPhase: 0,
    time: 0,
    actionElapsed: 1,
    seat: null,
    keystrokes: 0,
    carrying: false,
    board,
  };
}

describe("board drawing pose", () => {
  it("bends the knees and drops the hips to reach a low line", () => {
    // Act
    const low = officePose(drawing({ x: 0, y: 0.3, z: 0.25, review: 0, stepping: 0 }));
    const high = officePose(drawing({ x: 0, y: 0.9, z: 0.25, review: 0, stepping: 0 }));

    // Assert
    expect(low.hipsOffsetY).toBeLessThan(-0.05);
    expect(low.bones.leftLowerLeg?.x ?? 0).toBeGreaterThan(0.5);
    expect(high.hipsOffsetY).toBeCloseTo(0);
  });

  it("stands up straight again while stepping back to look", () => {
    // Act
    const reviewing = officePose(drawing({ x: 0, y: 0.3, z: 0.25, review: 1, stepping: 0 }));

    // Assert
    expect(reviewing.hipsOffsetY).toBeCloseTo(0);
  });
});
