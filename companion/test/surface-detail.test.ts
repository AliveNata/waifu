import { describe, expect, it } from "vitest";
import { type SurfaceKind, surfaceHeight } from "../src/renderer/office/scene/surface-detail.js";

const kinds: SurfaceKind[] = ["wood", "fabric", "metal", "plaster", "satin", "planks"];
const tile = 256;

describe("surfaceHeight", () => {
  it.each(kinds)("tiles %s without a seam", (kind) => {
    // Arrange
    const rows = [0, 37, 101, 200];

    // Act
    const jumps = rows.map((y) => Math.abs(surfaceHeight(kind, tile, y) - surfaceHeight(kind, 0, y)));

    // Assert
    for (const jump of jumps) {
      expect(jump).toBeLessThan(1e-6);
    }
  });

  it.each(kinds)("stays within 0..1 for %s", (kind) => {
    // Arrange
    const samples: number[] = [];

    // Act
    for (let y = 0; y < tile; y += 7) {
      for (let x = 0; x < tile; x += 7) {
        samples.push(surfaceHeight(kind, x, y));
      }
    }

    // Assert
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
  });

  it("cuts plank grooves where the floor texture paints its seams", () => {
    // Act
    const onSeam = surfaceHeight("planks", 50, 32);
    const midPlank = surfaceHeight("planks", 50, 48);

    // Assert
    expect(onSeam).toBe(0);
    expect(midPlank).toBeGreaterThan(0.7);
  });
});
