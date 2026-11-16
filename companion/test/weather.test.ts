import { describe, expect, it } from "vitest";
import { weatherFor, weatherOverride } from "../src/renderer/office/weather.js";

function daysOf(year: number): string[] {
  const days: string[] = [];
  for (let at = Date.UTC(year, 0, 1); at < Date.UTC(year + 1, 0, 1); at += 86_400_000) {
    days.push(new Date(at).toISOString().slice(0, 10));
  }
  return days;
}

describe("office weather", () => {
  it("gives the same weather for the same day every time", () => {
    // Act and Assert
    for (const day of daysOf(2026).slice(0, 30)) {
      expect(weatherFor(day)).toBe(weatherFor(day));
    }
  });

  it("rains on roughly one day in four, never in long unbroken runs", () => {
    // Arrange
    const year = daysOf(2026).map(weatherFor);

    // Act
    const wet = year.filter((weather) => weather === "rain").length;
    let longest = 0;
    let run = 0;
    for (const weather of year) {
      run = weather === "rain" ? run + 1 : 0;
      longest = Math.max(longest, run);
    }

    // Assert: a quarter of 365 is about 91; the band allows for the hash's spread.
    expect(wet).toBeGreaterThan(60);
    expect(wet).toBeLessThan(125);
    expect(longest).toBeLessThan(8);
  });

  it("lets the page force rain or a clear day, and ignores anything else", () => {
    // Act and Assert
    expect(weatherOverride("?weather=rain")).toBe("rain");
    expect(weatherOverride("?clock=17:05&weather=clear")).toBe("clear");
    expect(weatherOverride("?weather=snow")).toBeNull();
    expect(weatherOverride("")).toBeNull();
  });
});
