import { describe, expect, it } from "vitest";
import {
  type BoardFocus,
  type OfficePoseInput,
  officePose,
  pingpongSwing,
} from "../src/renderer/office/office-pose.js";
import { pingpongBeat } from "../src/renderer/office/office-stage.js";

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
    const level = officePose(drawing({ x: 0, y: 0.7, z: 0.25, review: 0, stepping: 0 }));

    // Assert
    expect(low.hipsOffsetY).toBeLessThan(-0.05);
    expect(low.bones.leftLowerLeg?.x ?? 0).toBeGreaterThan(0.5);
    expect(level.hipsOffsetY).toBeCloseTo(0);
  });

  it("goes up on tiptoe for the top line", () => {
    // Act
    const top = officePose(drawing({ x: 0, y: 0.97, z: 0.25, review: 0, stepping: 0 }));

    // Assert
    expect(top.hipsOffsetY).toBeGreaterThan(0.02);
    expect(top.bones.leftFoot?.x ?? 0).toBeGreaterThan(0.3);
  });

  it("stands up straight again while stepping back to look", () => {
    // Act
    const reviewing = officePose(drawing({ x: 0, y: 0.3, z: 0.25, review: 1, stepping: 0 }));

    // Assert
    expect(reviewing.hipsOffsetY).toBeCloseTo(0);
  });
});

describe("ping-pong timing", () => {
  it("swings forward as the ball reaches the paddle and stays still while it is away", () => {
    // Act
    const atContact = pingpongSwing(0);
    const windingUp = pingpongSwing(0.8);
    const ballAway = pingpongSwing(0.5);

    // Assert
    expect(atContact).toBeGreaterThan(0.5);
    expect(windingUp).toBeLessThan(0);
    expect(ballAway).toBeCloseTo(0);
  });

  it("puts each player's contact at their own end of the ball's trip", () => {
    // Arrange: the ball takes 1/1.1 s per crossing and starts at the west paddle.
    const crossing = 1 / 1.1;

    // Act
    const westAtStart = pingpongBeat(0, "west");
    const eastAfterOneCrossing = pingpongBeat(crossing, "east");
    const westHalfway = pingpongBeat(crossing, "west");

    // Assert
    expect(westAtStart).toBeCloseTo(0);
    expect(eastAfterOneCrossing).toBeCloseTo(0);
    expect(westHalfway).toBeCloseTo(0.5);
  });
});
