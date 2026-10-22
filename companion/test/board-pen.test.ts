import { describe, expect, it } from "vitest";
import { BoardPen, type PenState } from "../src/renderer/office/surfaces/board-pen.js";
import { diagramInk, line } from "../src/renderer/office/surfaces/drawing.js";

/** Two short strokes far apart, so the hand has to travel between them. */
const twoStrokes = [line([0.1, 0.1], [0.2, 0.1]), line([0.8, 0.8], [0.9, 0.8])];

function run(pen: BoardPen, seconds: number, step = 1 / 30): PenState[] {
  const states: PenState[] = [];
  for (let elapsed = 0; elapsed < seconds; elapsed += step) {
    states.push(pen.advance(step));
  }
  return states;
}

describe("BoardPen", () => {
  it("lifts the pen and carries it to the next stroke instead of jumping there", () => {
    // Arrange: 0.5 never pauses or reviews, so the stroke ends straight into travel.
    const pen = new BoardPen(twoStrokes, () => 0.5);

    // Act
    const states = run(pen, 3);

    // Assert
    const lifted = states.filter((state) => !state.touching);
    expect(lifted.length).toBeGreaterThan(5);
    const xs = lifted.map((state) => state.at[0]);
    expect(Math.min(...xs)).toBeLessThan(0.4);
    expect(Math.max(...xs)).toBeGreaterThan(0.6);
    expect(lifted.some((state) => state.at[0] > 0.4 && state.at[0] < 0.6)).toBe(true);
  });

  it("steps back to look the drawing over when the roll says so", () => {
    // Arrange: the first roll (0) picks a review, the hold time roll (0) keeps it short.
    const pen = new BoardPen(twoStrokes, () => 0);

    // Act
    const states = run(pen, 2);

    // Assert
    expect(states.some((state) => state.reviewing && !state.touching)).toBe(true);
  });

  it("finishes with all the diagram's ink laid down", () => {
    // Arrange
    const pen = new BoardPen(twoStrokes, () => 0.5);

    // Act
    run(pen, 4);

    // Assert
    expect(pen.finished).toBe(true);
    expect(pen.ink).toBeCloseTo(diagramInk(twoStrokes));
  });
});
