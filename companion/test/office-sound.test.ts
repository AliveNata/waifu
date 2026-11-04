import { describe, expect, it } from "vitest";
import { cueReach, distanceGain, inaudible, panFor, placeCue, rallyHits } from "../src/renderer/office/office-sound.js";
import { defaultSoundSettings, normalizeSoundSettings } from "../src/shared/sound-settings.js";

const facingNorth = { position: { x: 0, y: 1.2, z: 0 }, right: { x: 1, z: 0 } };

describe("office sound placement", () => {
  it("plays at full volume within reach and quieter further off", () => {
    // Act
    const near = distanceGain(1, 2);
    const twice = distanceGain(4, 2);
    const far = distanceGain(20, 2);

    // Assert
    expect(near).toBe(1);
    expect(twice).toBeCloseTo(0.25, 5);
    expect(far).toBeLessThan(twice);
  });

  it("drops a key click across the room below hearing but keeps the gong", () => {
    // Arrange
    const acrossTheRoom = { x: 9, y: 0.8, z: 4 };

    // Act
    const key = placeCue("key", facingNorth, acrossTheRoom);
    const gong = placeCue("gong", facingNorth, acrossTheRoom);

    // Assert
    expect(cueReach.gong).toBeGreaterThan(cueReach.key);
    expect(key.gain).toBeLessThan(inaudible);
    expect(gong.gain).toBeGreaterThan(inaudible);
  });

  it("pans to the side the sound is on, never fully into one ear", () => {
    // Act
    const right = panFor(facingNorth, { x: 3, y: 1, z: 0 });
    const left = panFor(facingNorth, { x: -3, y: 1, z: 0 });
    const ahead = panFor(facingNorth, { x: 0, y: 1, z: -3 });
    const onTop = panFor(facingNorth, { x: 0, y: 0, z: 0 });

    // Assert
    expect(right).toBeCloseTo(0.8, 5);
    expect(left).toBeCloseTo(-0.8, 5);
    expect(ahead).toBeCloseTo(0, 5);
    expect(onTop).toBe(0);
  });
});

describe("ping-pong hits", () => {
  it("hears a bounce at each half and a paddle at each whole leg", () => {
    // Act
    const bounce = rallyHits(0.4, 0.6);
    const paddle = rallyHits(0.9, 1.05);
    const nothing = rallyHits(0.1, 0.3);

    // Assert
    expect(bounce).toEqual(["bounce"]);
    expect(paddle).toEqual(["paddle"]);
    expect(nothing).toEqual([]);
  });

  it("counts the west paddle when the rally wraps from 2 back to 0", () => {
    // Act
    const hits = rallyHits(1.95, 0.05);

    // Assert
    expect(hits).toEqual(["paddle"]);
  });

  it("does not hear the same hit twice when a frame lands on it", () => {
    // Act
    const onTheMark = rallyHits(0.4, 0.5);
    const after = rallyHits(0.5, 0.6);

    // Assert
    expect(onTheMark).toEqual(["bounce"]);
    expect(after).toEqual([]);
  });
});

describe("office sound settings", () => {
  it("starts off at half volume", () => {
    // Act
    const settings = normalizeSoundSettings(undefined);

    // Assert
    expect(settings).toEqual(defaultSoundSettings);
    expect(settings).toEqual({ enabled: false, volume: 50 });
  });

  it("clamps the volume and drops wrongly typed fields", () => {
    // Act
    const loud = normalizeSoundSettings({ enabled: true, volume: 180.4 });
    const broken = normalizeSoundSettings({ enabled: "yes", volume: "loud" });

    // Assert
    expect(loud).toEqual({ enabled: true, volume: 100 });
    expect(broken).toEqual(defaultSoundSettings);
  });
});
