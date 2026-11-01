import { describe, expect, it } from "vitest";
import { FrameRate, frameLabel } from "../src/renderer/office/frame-rate.js";

describe("FrameRate", () => {
  it("reads 0 until there are two frames to compare", () => {
    // Arrange
    const rate = new FrameRate();

    // Act
    rate.tick(1000);

    // Assert
    expect(rate.fps()).toBe(0);
    expect(rate.frameMs()).toBe(0);
  });

  it("averages frames over the window", () => {
    // Arrange: a steady 20 frames per second.
    const rate = new FrameRate(500);

    // Act
    for (let frame = 0; frame <= 20; frame++) {
      rate.tick(frame * 50);
    }

    // Assert
    expect(rate.fps()).toBeCloseTo(20);
    expect(rate.frameMs()).toBeCloseTo(50);
  });

  it("forgets frames older than the window, so a slowdown shows quickly", () => {
    // Arrange: fast at first, then slow.
    const rate = new FrameRate(500);
    for (let frame = 0; frame < 30; frame++) {
      rate.tick(frame * 16);
    }

    // Act
    for (let frame = 1; frame <= 6; frame++) {
      rate.tick(29 * 16 + frame * 200);
    }

    // Assert
    expect(rate.fps()).toBeCloseTo(5);
  });
});

describe("frameLabel", () => {
  it("rounds to whole numbers", () => {
    // Act + Assert
    expect(frameLabel(23.6, 41.2, 1480)).toBe("24 fps · 41 ms · 1480 draw");
  });
});
