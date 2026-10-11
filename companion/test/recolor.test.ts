import { describe, expect, it } from "vitest";
import { hexToRgb, remapToColor } from "../src/renderer/common/recolor.js";

function pixels(values: readonly number[]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(values.length * 4);
  values.forEach((value, index) => {
    data.set([value, value, value, 255], index * 4);
  });
  return data;
}

function red(data: Uint8ClampedArray, index: number): number {
  return data[index * 4] ?? -1;
}

describe("hexToRgb", () => {
  it("parses six-digit hex colors", () => {
    expect(hexToRgb("#2f6fd6")).toEqual([47, 111, 214]);
  });
});

describe("remapToColor", () => {
  it("maps the darkest detail to the low end and the brightest to the high end", () => {
    // Arrange
    const data = pixels([20, 60, 100, 140, 180, 220]);

    // Act
    remapToColor(data, [200, 100, 0], { low: 0.5, high: 1 });

    // Assert
    expect(red(data, 0)).toBe(100);
    expect(red(data, 5)).toBe(200);
    expect(data[5 * 4 + 2]).toBe(0);
  });

  it("ignores black atlas padding so a small lit iris still gets the full range", () => {
    // Arrange: mostly black padding, a few iris pixels with a dark pupil and a bright rim.
    const data = pixels([...Array<number>(90).fill(0), 20, 40, 60, 80, 100, 120, 140, 160, 175, 175]);

    // Act
    remapToColor(data, [100, 200, 100], { low: 0.25, high: 1.3 });

    // Assert
    expect(red(data, 90)).toBe(25);
    expect(red(data, 99)).toBe(130);
  });

  it("still tints a garment that is pure black", () => {
    // Arrange
    const data = pixels(Array<number>(10).fill(0));

    // Act
    remapToColor(data, [180, 40, 60], { low: 0.7, high: 1.15 });

    // Assert
    expect(red(data, 3)).toBe(126);
  });

  it("leaves transparent pixels alone", () => {
    // Arrange
    const data = new Uint8ClampedArray([10, 10, 10, 0, 200, 200, 200, 255]);

    // Act
    remapToColor(data, [0, 0, 255], { low: 1, high: 1 });

    // Assert
    expect(Array.from(data.slice(0, 4))).toEqual([10, 10, 10, 0]);
  });
});
