import { describe, expect, it } from "vitest";
import { stepBlush } from "../src/renderer/overlay/blush.js";
import {
  chestSwatSeconds,
  gestureForZone,
  gestureSpecs,
  type HandGesture,
  handFrame,
} from "../src/renderer/overlay/hand-gestures.js";
import type { TouchZone } from "../src/renderer/overlay/touch-zones.js";

describe("gestureForZone", () => {
  it.each([
    ["head", ["pat", "ruffle"]],
    ["forehead", ["flick", "double-flick"]],
    ["nose", ["boop", "boop-twice"]],
    ["cheek", ["poke", "poke-twice", "poke-wiggle"]],
    ["shoulder", ["two-finger-tap", "poke"]],
    ["hand", ["high-five"]],
    ["body", ["poke", "poke-twice"]],
    ["chest", ["chest-tap"]],
  ] as const)("touches the %s with one of its own moves", (zone: TouchZone, moves: readonly HandGesture[]) => {
    // Act
    const picked = new Set([0, 0.34, 0.67, 0.99].map((roll) => gestureForZone(zone, "tap", roll)));

    // Assert: every roll gives one of the zone's moves, and every move can come up.
    expect([...picked].sort()).toEqual([...moves].sort());
  });

  it("always strokes when the head or hair is petted, whatever the roll", () => {
    expect(gestureForZone("head", "stroke", 0.9)).toBe("pat");
    expect(gestureForZone("hair", "hold", 0.9)).toBe("pat");
  });
});

describe("handFrame", () => {
  it("points with the index alone for a poke", () => {
    // Act
    const { curl } = handFrame("poke", 0.2);

    // Assert
    expect(curl.index).toBe(0);
    expect(Math.min(curl.middle, curl.ring, curl.pinky)).toBeGreaterThan(0.8);
  });

  it("holds the middle finger back for a flick, then lets it go", () => {
    // Act
    const loaded = handFrame("flick", 0.15);
    const released = handFrame("flick", 0.4);

    // Assert
    expect(loaded.curl.middle).toBeGreaterThan(0.9);
    expect(released.curl.middle).toBe(0);
  });

  it("pushes in toward her during a poke and comes back after", () => {
    // Act
    const pressing = handFrame("poke", 0.12 + 0.35 / 2);
    const done = handFrame("poke", gestureSpecs.poke.seconds);

    // Assert
    expect(pressing.offset.z).toBeLessThan(-0.01);
    expect(done.offset.z).toBeCloseTo(0, 5);
  });

  it("is knocked aside on a chest touch when her swat lands, then drifts back", () => {
    // Act
    const before = handFrame("chest-tap", chestSwatSeconds - 0.05);
    const knocked = handFrame("chest-tap", chestSwatSeconds + 0.15);
    const back = handFrame("chest-tap", gestureSpecs["chest-tap"].seconds);

    // Assert
    expect(before.offset.x).toBe(0);
    expect(knocked.offset.x).toBeLessThan(-0.1);
    expect(back.offset.x).toBeCloseTo(0, 5);
  });

  it("strokes side to side while patting", () => {
    // Act
    const xs = [0.1, 0.25, 0.4, 0.55].map((t) => handFrame("pat", t).offset.x);

    // Assert
    expect(Math.max(...xs)).toBeGreaterThan(0.01);
    expect(Math.min(...xs)).toBeLessThan(-0.01);
  });
});

describe("stepBlush", () => {
  it("flushes quickly and fades slowly", () => {
    // Act
    const up = stepBlush(0, 1, 0.1);
    const down = stepBlush(1, 0, 0.1);

    // Assert
    expect(up).toBeCloseTo(0.4);
    expect(down).toBeCloseTo(0.94);
  });
});
