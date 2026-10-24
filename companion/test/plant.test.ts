import { Box3, Color } from "three";
import { describe, expect, it } from "vitest";
import { leafGeometry, leafHalfWidth, leafyCrown } from "../src/renderer/office/scene/plant.js";

describe("leafHalfWidth", () => {
  it("is a narrow stalk at the base, broad in the middle and pointed at the tip", () => {
    // Act
    const base = leafHalfWidth(0.1, 0);
    const middle = leafHalfWidth(0.1, 0.45);
    const tip = leafHalfWidth(0.1, 1);

    // Assert
    expect(base).toBeCloseTo(0);
    expect(middle).toBeGreaterThan(0.035);
    expect(tip).toBeCloseTo(0);
  });
});

describe("leafGeometry", () => {
  it("arches the blade over so the tip ends lower than a straight blade would reach", () => {
    // Arrange
    const shape = {
      length: 0.4,
      width: 0.1,
      azimuth: 0,
      lift: 0.3,
      baseColor: new Color("#3f6e35"),
      tipColor: new Color("#5b8c4a"),
    };

    // Act
    const straight = leafGeometry({ ...shape, droop: 0 });
    const arched = leafGeometry({ ...shape, droop: 1.2 });
    straight.computeBoundingBox();
    arched.computeBoundingBox();

    // Assert
    expect(arched.boundingBox?.max.y ?? 0).toBeLessThan((straight.boundingBox?.max.y ?? 0) - 0.03);
    expect(arched.getAttribute("color").count).toBe(arched.getAttribute("position").count);
  });
});

describe("leafyCrown", () => {
  it("grows taller than the pot is wide and spreads past its rim", () => {
    // Arrange
    const potRadius = 0.25;

    // Act
    const crown = leafyCrown(potRadius, "#5b8c4a", "#3f6e35");
    const bounds = new Box3().setFromObject(crown);

    // Assert
    expect(bounds.max.y).toBeGreaterThan(potRadius * 2);
    expect(bounds.max.x).toBeGreaterThan(potRadius);
    expect(bounds.min.x).toBeLessThan(-potRadius);
  });
});
