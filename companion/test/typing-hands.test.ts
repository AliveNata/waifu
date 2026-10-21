import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  handForKey,
  hoverHeight,
  MouseHabit,
  strikeSeconds,
  strokeLift,
  TypingHands,
} from "../src/renderer/office/typing-hands.js";

function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

describe("handForKey", () => {
  it.each(["q", "A", "5", "b", "g"])("gives %s to the left hand", (character) => {
    expect(handForKey(character)).toBe("left");
  });

  it.each(["y", "J", "0", "n", " ", "\n", ";"])("gives %j to the right hand", (character) => {
    expect(handForKey(character)).toBe("right");
  });
});

describe("strokeLift", () => {
  it("hovers, touches the key mid-stroke, then hovers again", () => {
    // Act
    const start = strokeLift(0);
    const middle = strokeLift(strikeSeconds / 2);
    const end = strokeLift(strikeSeconds * 3);

    // Assert
    expect(start).toBeCloseTo(hoverHeight);
    expect(middle).toBeCloseTo(0);
    expect(end).toBeCloseTo(hoverHeight);
  });
});

describe("TypingHands", () => {
  const homes = { left: new Vector3(-0.05, 0.025, 0), right: new Vector3(0.05, 0.025, 0) };

  it("moves only the hand that owns the struck key", () => {
    // Arrange
    const hands = new TypingHands(homes);

    // Act
    hands.strike("right", new Vector3(0.12, 0.025, -0.04));
    for (let frame = 0; frame < 30; frame++) {
      hands.update(1 / 60);
    }

    // Assert
    const right = hands.fingertip("right");
    const left = hands.fingertip("left");
    expect(right.x).toBeCloseTo(0.12, 2);
    expect(right.z).toBeCloseTo(-0.04, 2);
    expect(left.x).toBeCloseTo(-0.05, 5);
  });

  it("glides toward a new key instead of jumping onto it", () => {
    // Arrange
    const hands = new TypingHands(homes);

    // Act
    hands.strike("left", new Vector3(-0.15, 0.025, 0));
    hands.update(1 / 60);

    // Assert
    const left = hands.fingertip("left");
    expect(left.x).toBeLessThan(-0.05);
    expect(left.x).toBeGreaterThan(-0.15);
  });
});

describe("MouseHabit", () => {
  it("waits for its gap, then holds the mouse for a few seconds", () => {
    // Arrange: a 7 s gap, then a 2 s spell.
    const habit = new MouseHabit(0, sequence(0, 0));

    // Act
    const early = habit.using(5, true);
    const started = habit.using(7.5, true);
    const during = habit.using(9, true);
    const after = habit.using(9.6, true);

    // Assert
    expect(early).toBe(false);
    expect(started).toBe(true);
    expect(during).toBe(true);
    expect(after).toBe(false);
  });

  it("never starts while the member is not typing", () => {
    // Arrange
    const habit = new MouseHabit(0, sequence(0));

    // Act
    const idle = habit.using(30, false);

    // Assert
    expect(idle).toBe(false);
  });
});
