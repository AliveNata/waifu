import { describe, expect, it } from "vitest";
import { BlinkScheduler, stepExpressionWeights } from "../src/renderer/common/expressions.js";

describe("stepExpressionWeights", () => {
  it("eases toward the target at the given rate", () => {
    // Act
    const next = stepExpressionWeights({}, { happy: 1 }, 0.1, 4);

    // Assert
    expect(next.happy).toBeCloseTo(0.4);
  });

  it("snaps when within one step and drops weights that reached zero", () => {
    // Act
    const next = stepExpressionWeights({ happy: 0.1, surprised: 0.9 }, { surprised: 1 }, 0.1, 4);

    // Assert
    expect(next).toEqual({ surprised: 1 });
  });
});

describe("BlinkScheduler", () => {
  it("stays open before the first blink and closes fully mid-blink", () => {
    // Arrange: random() = 0 schedules the first blink at the minimum gap, 2.2s.
    const blink = new BlinkScheduler(() => 0);

    // Act + Assert
    expect(blink.weightAt(1)).toBe(0);
    expect(blink.weightAt(2.28)).toBeCloseTo(1);
    expect(blink.weightAt(2.5)).toBe(0);
  });

  it("sometimes blinks twice in a row, then goes back to a long gap", () => {
    // Arrange: random() = 0 always rolls the double blink, unless one was just done.
    const blink = new BlinkScheduler(() => 0);
    blink.weightAt(2.28);
    blink.weightAt(2.5);

    // Act: the follow-up blink starts 0.2 s after the first ended.
    const second = blink.weightAt(2.78);
    blink.weightAt(3.0);
    const afterSecond = blink.weightAt(3.4);

    // Assert
    expect(second).toBeCloseTo(1);
    expect(afterSecond).toBe(0);
  });

  it("blinks soon when asked, like at the end of a sentence", () => {
    // Arrange
    const blink = new BlinkScheduler(() => 0.99);

    // Act
    blink.blinkSoon(1);

    // Assert
    expect(blink.weightAt(1.2)).toBeCloseTo(1);
  });
});
