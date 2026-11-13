import { describe, expect, it } from "vitest";
import { curvedScreenGeometry, radiusOfCurve } from "../src/renderer/office/scene/curved-screen.js";

describe("curvedScreenGeometry", () => {
  it("keeps the middle at the face and brings the sides forward by the curve's sag", () => {
    // Arrange
    const width = 0.42;
    const radius = 0.924;
    const sag = radius * (1 - Math.cos(width / 2 / radius));

    // Act
    const position = curvedScreenGeometry(width, 0.2625, radius).getAttribute("position");
    const depths = Array.from({ length: position.count }, (_, index) => position.getZ(index));

    // Assert
    expect(Math.min(...depths)).toBeCloseTo(0, 6);
    expect(Math.max(...depths)).toBeCloseTo(sag, 6);
    expect(Math.max(...depths)).toBeGreaterThan(0.02);
  });

  it("keeps the picture's width along the curve", () => {
    // Arrange
    const width = 0.72;
    const radius = 1.58;

    // Act: the length of the bottom edge, column to column.
    const position = curvedScreenGeometry(width, 0.288, radius).getAttribute("position");
    const bottom = Array.from({ length: position.count }, (_, index) => index)
      .filter((index) => position.getY(index) < 0)
      .sort((a, b) => position.getX(a) - position.getX(b));
    let length = 0;
    for (let step = 1; step < bottom.length; step++) {
      const from = bottom[step - 1] as number;
      const to = bottom[step] as number;
      length += Math.hypot(position.getX(to) - position.getX(from), position.getZ(to) - position.getZ(from));
    }

    // Assert
    expect(length).toBeCloseTo(width, 3);
  });
});

describe("radiusOfCurve", () => {
  it("gives back the radius a chord and its sag were cut from", () => {
    // Arrange
    const radius = 0.9;
    const chord = 0.4;
    const sag = radius - Math.sqrt(radius * radius - (chord / 2) ** 2);

    // Act & Assert
    expect(radiusOfCurve(chord, sag)).toBeCloseTo(radius, 9);
  });
});
