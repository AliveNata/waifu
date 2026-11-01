import { describe, expect, it } from "vitest";
import {
  type FreeBounds,
  type FreeView,
  fastMultiplier,
  freeSpeed,
  lookFreeView,
  maxPitch,
  stepFreeView,
} from "../src/renderer/office/free-camera.js";

const roomish: FreeBounds = { minX: -10, maxX: 10, minY: 0.3, maxY: 8, minZ: -10, maxZ: 10 };
const atOrigin: FreeView = { x: 0, y: 1.5, z: 0, yaw: 0, pitch: 0 };
const still = { forward: 0, right: 0, up: 0, fast: false };

describe("stepFreeView", () => {
  it("walks forward along the way it faces, level even when looking down", () => {
    // Arrange: facing -z, looking down at the floor.
    const view = { ...atOrigin, pitch: -1 };

    // Act
    const next = stepFreeView(view, { ...still, forward: 1 }, 1, roomish);

    // Assert
    expect(next.z).toBeCloseTo(-freeSpeed);
    expect(next.x).toBeCloseTo(0);
    expect(next.y).toBe(view.y);
  });

  it("steps right relative to where it faces", () => {
    // Arrange: turned a quarter to the left, so its right is -z.
    const view = { ...atOrigin, yaw: Math.PI / 2 };

    // Act
    const next = stepFreeView(view, { ...still, right: 1 }, 1, roomish);

    // Assert
    expect(next.z).toBeCloseTo(-freeSpeed);
    expect(next.x).toBeCloseTo(0);
  });

  it("goes faster with Shift and rises with E", () => {
    // Act
    const next = stepFreeView(atOrigin, { forward: 0, right: 0, up: 1, fast: true }, 0.5, roomish);

    // Assert
    expect(next.y).toBeCloseTo(atOrigin.y + freeSpeed * fastMultiplier * 0.5);
  });

  it("stays inside the bounds", () => {
    // Act
    const next = stepFreeView(atOrigin, { forward: 1, right: 0, up: -1, fast: true }, 60, roomish);

    // Assert
    expect(next.z).toBe(roomish.minZ);
    expect(next.y).toBe(roomish.minY);
  });
});

describe("lookFreeView", () => {
  it("turns right on a drag to the right and looks up on a drag up", () => {
    // Act
    const next = lookFreeView(atOrigin, 100, -100);

    // Assert
    expect(next.yaw).toBeLessThan(0);
    expect(next.pitch).toBeGreaterThan(0);
  });

  it("never tips over past straight up or down", () => {
    // Act
    const up = lookFreeView(atOrigin, 0, -100_000);
    const down = lookFreeView(atOrigin, 0, 100_000);

    // Assert
    expect(up.pitch).toBe(maxPitch);
    expect(down.pitch).toBe(-maxPitch);
  });
});
