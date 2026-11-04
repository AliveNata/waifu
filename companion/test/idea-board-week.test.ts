import { describe, expect, it } from "vitest";
import { ideaPool, officeWeek, weeklyIdeas } from "../src/renderer/office/surfaces/idea-board.js";

/** Monday 2 November 2026, 00:30 in Jakarta, as UTC milliseconds. */
const mondayJakarta = Date.UTC(2026, 10, 1, 17, 30);

describe("officeWeek", () => {
  it("turns over at midnight on Monday in Jakarta", () => {
    // Act
    const sunday = officeWeek(mondayJakarta - 60 * 60_000);
    const monday = officeWeek(mondayJakarta);

    // Assert
    expect(monday).toBe(sunday + 1);
  });

  it("stays the same through the week", () => {
    // Act
    const monday = officeWeek(mondayJakarta);
    const saturday = officeWeek(mondayJakarta + 5 * 86_400_000);

    // Assert
    expect(saturday).toBe(monday);
  });
});

describe("weeklyIdeas", () => {
  it("puts four to six distinct ideas on the board and holds up to three back", () => {
    // Act
    const { board, extra } = weeklyIdeas(2915);

    // Assert
    expect(board.length).toBeGreaterThanOrEqual(4);
    expect(board.length).toBeLessThanOrEqual(6);
    expect(extra.length).toBeLessThanOrEqual(3);
    expect(new Set([...board, ...extra]).size).toBe(board.length + extra.length);
    expect([...board, ...extra].every((idea) => ideaPool.includes(idea))).toBe(true);
  });

  it("draws the same ideas all week", () => {
    // Act
    const first = weeklyIdeas(2915);
    const again = weeklyIdeas(2915);

    // Assert
    expect(again).toEqual(first);
  });

  it("changes the list from one week to the next", () => {
    // Act
    const lists = [2915, 2916, 2917, 2918].map((week) => weeklyIdeas(week).board.join("|"));

    // Assert
    expect(new Set(lists).size).toBeGreaterThan(1);
  });
});
