import { describe, expect, it } from "vitest";
import { dragBounds } from "../src/main/window-drag.js";

describe("dragBounds", () => {
  it("moves by the drag offset and keeps the size the drag started with", () => {
    // Arrange
    const origin = { x: 900, y: 560, width: 340, height: 440 };

    // Act: many small steps, like a real drag, each from the same origin.
    let bounds = origin;
    for (let step = 1; step <= 40; step++) {
      bounds = dragBounds(origin, step * 1.25, step * 0.75);
    }

    // Assert
    expect(bounds).toEqual({ x: 950, y: 590, width: 340, height: 440 });
  });

  it("rounds to whole pixels, since window positions are integers", () => {
    // Act + Assert
    expect(dragBounds({ x: 10, y: 10, width: 340, height: 440 }, 2.6, -3.4)).toEqual({
      x: 13,
      y: 7,
      width: 340,
      height: 440,
    });
  });
});
