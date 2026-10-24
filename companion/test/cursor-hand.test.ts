import { describe, expect, it } from "vitest";
import { gestureForZone, handPoses, handSvg } from "../src/renderer/overlay/cursor-hand.js";

describe("gestureForZone", () => {
  it.each([
    ["head", "pat"],
    ["hair", "pat"],
    ["forehead", "flick"],
    ["nose", "flick"],
    ["cheek", "flick"],
    ["shoulder", "poke"],
    ["body", "poke"],
    ["hand", "high-five"],
  ] as const)("touches the %s with a %s", (zone, gesture) => {
    expect(gestureForZone(zone)).toBe(gesture);
  });
});

describe("hand drawings", () => {
  it("draws five fingers and a palm for every pose", () => {
    for (const pose of Object.values(handPoses)) {
      // Act
      const svg = handSvg(pose);

      // Assert
      expect(svg.match(/<rect/g)).toHaveLength(6);
    }
  });

  it("keeps all five fingers out when resting open", () => {
    // Act
    const reaches = Object.values(handPoses.open.fingers).map((finger) => finger.reach);

    // Assert
    expect(reaches).toEqual([1, 1, 1, 1, 1]);
  });

  it("points with the index alone for a poke", () => {
    // Act
    const { index, middle, ring, little } = handPoses.poke.fingers;

    // Assert
    expect(index.reach).toBe(1);
    expect(Math.max(middle.reach, ring.reach, little.reach)).toBeLessThan(0.3);
  });

  it("holds the middle finger back with the thumb in front of the palm before a flick", () => {
    // Act
    const svg = handSvg(handPoses["flick-ready"]);

    // Assert: the thumb is the last shape, drawn over the palm.
    const shapes = svg.match(/<rect[^>]*>/g) ?? [];
    expect(shapes.at(-1)).toContain("rotate(28");
    expect(handPoses["flick-ready"].fingers.middle.reach).toBeLessThan(0.2);
    expect(handPoses.flick.fingers.middle.reach).toBe(1);
  });
});
