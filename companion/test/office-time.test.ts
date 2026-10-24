import { describe, expect, it } from "vitest";
import {
  atJakartaTime,
  clockFace,
  dayPart,
  jakartaHours,
  jakartaTime,
  skyAt,
} from "../src/renderer/office/office-time.js";

describe("Jakarta time", () => {
  it("is seven hours ahead of UTC and wraps past midnight", () => {
    // Act
    const evening = jakartaTime(new Date(Date.UTC(2026, 9, 24, 14, 30, 5)));
    const pastMidnight = jakartaTime(new Date(Date.UTC(2026, 9, 24, 20, 15, 0)));

    // Assert
    expect(evening).toEqual({ hours: 21, minutes: 30, seconds: 5 });
    expect(pastMidnight.hours).toBe(3);
  });

  it("previews a Jakarta time of day whatever the PC's own zone", () => {
    // Act
    const preview = atJakartaTime(6, 45);

    // Assert
    expect(jakartaHours(preview)).toBeCloseTo(6.75, 5);
  });

  it("blinks the colon on odd seconds and pads the digits", () => {
    // Act
    const even = clockFace({ hours: 8, minutes: 5, seconds: 10 }, true);
    const odd = clockFace({ hours: 8, minutes: 5, seconds: 11 }, true);

    // Assert
    expect(even).toBe("08:05");
    expect(odd).toBe("08 05");
  });
});

describe("dayPart", () => {
  it.each([
    [4, "pagi"],
    [10.9, "pagi"],
    [11, "siang"],
    [15, "sore"],
    [18, "malam"],
    [23, "malam"],
    [2, "malam"],
  ] as const)("calls %d o'clock %s", (hours, expected) => {
    expect(dayPart(hours)).toBe(expected);
  });
});

describe("skyAt", () => {
  it.each([
    [10, 0],
    [16, 0],
    [21, 1],
    [2, 1],
    [8, 0],
  ])("is fully day or night at %d", (hours, night) => {
    expect(skyAt(hours).night).toBe(night);
  });

  it("glows orange halfway through dusk and dawn, never at noon or midnight", () => {
    // Act
    const dusk = skyAt(18.25);
    const dawn = skyAt(5.75);

    // Assert
    expect(dusk.twilight).toBeGreaterThan(0.95);
    expect(dawn.twilight).toBeGreaterThan(0.95);
    expect(skyAt(12).twilight).toBe(0);
    expect(skyAt(0).twilight).toBeCloseTo(0, 10);
  });
});
