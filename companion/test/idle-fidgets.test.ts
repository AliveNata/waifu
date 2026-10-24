import { describe, expect, it } from "vitest";
import type { PoseBones } from "../src/renderer/common/pose.js";
import { applyFidget, applyMoodVariant, FidgetScheduler, fidgetFace } from "../src/renderer/overlay/idle-fidgets.js";

function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

describe("FidgetScheduler", () => {
  it("waits a quiet gap, then plays a fidget and never the same one twice in a row", () => {
    // Arrange: gap 5 s, then always the first choice.
    const fidgets = new FidgetScheduler(0, sequence(0));

    // Act
    const early = fidgets.update(3, "idle", false);
    const first = fidgets.update(6, "idle", false);
    const finished = fidgets.update(6 + 10, "idle", false);
    const second = fidgets.update(6 + 10 + 6, "idle", false);

    // Assert
    expect(early).toBeNull();
    expect(first?.kind).toBe("look-around");
    expect(finished).toBeNull();
    expect(second?.kind).not.toBe("look-around");
  });

  it("holds off while a touch or a requested pose is playing", () => {
    // Arrange
    const fidgets = new FidgetScheduler(0, sequence(0));

    // Act
    const busy = fidgets.update(30, "idle", true);

    // Assert
    expect(busy).toBeNull();
  });

  it("leaves greetings and finishes alone", () => {
    // Arrange
    const fidgets = new FidgetScheduler(0, sequence(0));

    // Act
    const greeting = fidgets.update(30, "greeting", false);

    // Assert
    expect(greeting).toBeNull();
  });
});

describe("fidget motion", () => {
  it("opens the mouth and half closes the eyes for a yawn", () => {
    // Act
    const face = fidgetFace({ kind: "yawn", elapsed: 1.4, duration: 2.8 });

    // Assert
    expect(face?.aa ?? 0).toBeGreaterThan(0.5);
    expect(face?.blink ?? 0).toBeGreaterThan(0.3);
  });

  it("turns the head while looking around", () => {
    // Arrange
    const bones: PoseBones = {};

    // Act
    applyFidget(bones, { kind: "look-around", elapsed: 0.8, duration: 3.2 });

    // Assert
    expect(Math.abs(bones.head?.y ?? 0)).toBeGreaterThan(0.1);
  });
});

describe("applyMoodVariant", () => {
  it("holds the same mood differently from one variant to the next", () => {
    // Arrange
    const first: PoseBones = {};
    const second: PoseBones = {};

    // Act
    applyMoodVariant(first, "thinking", 1, 2);
    applyMoodVariant(second, "thinking", 2, 2);

    // Assert
    expect(first.head).not.toEqual(second.head);
  });
});
