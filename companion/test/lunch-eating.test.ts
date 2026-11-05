import { describe, expect, it } from "vitest";
import { eatStyleFor, eatStyles, lunchMoment } from "../src/renderer/office/lunch-eating.js";
import { memberIds } from "../src/shared/team.js";

/** The moment's arm height in one number: 0 at the box, 1 at the mouth. */
function armHeight(seconds: number, memberId: (typeof memberIds)[number]): number {
  const moment = lunchMoment(seconds, eatStyles[memberId]);
  return moment.kind === "bite" ? moment.amount : 0;
}

describe("lunch eating", () => {
  it("gives the members different paces and habits", () => {
    // Act
    const styles = memberIds.map((memberId) => eatStyleFor(memberId));

    // Assert
    expect(new Set(styles.map((style) => style.biteSeconds.toFixed(2))).size).toBeGreaterThan(8);
    expect(new Set(styles.map((style) => style.freeHand)).size).toBeGreaterThan(1);
    for (const style of styles) {
      expect(style.biteSeconds).toBeGreaterThanOrEqual(2.4);
      expect(style.biteSeconds).toBeLessThanOrEqual(4);
    }
  });

  it("never has the whole table raising the chopsticks together", () => {
    // Arrange: everyone sat down at the same moment.
    const samples = Array.from({ length: 600 }, (_, index) => index * 0.5);

    // Act
    const mostRaised = Math.max(
      ...samples.map((seconds) => memberIds.filter((memberId) => armHeight(seconds, memberId) > 0.7).length),
    );

    // Assert: at most half the table has the chopsticks at the mouth at any one time.
    expect(mostRaised).toBeLessThanOrEqual(memberIds.length / 2);
  });

  it("stops between rounds of bites to chew, sit back or pick at the box", () => {
    // Arrange
    const style = eatStyles.asuna;
    const samples = Array.from({ length: 400 }, (_, index) => index * 0.25);

    // Act
    const kinds = new Set(samples.map((seconds) => lunchMoment(seconds, style).kind));
    const paused = samples.filter((seconds) => lunchMoment(seconds, style).kind !== "bite").length;

    // Assert
    expect(kinds.has("bite")).toBe(true);
    expect(kinds.size).toBeGreaterThanOrEqual(3);
    expect(paused).toBeGreaterThan(samples.length * 0.15);
  });

  it("is the same meal every time for the same member and moment", () => {
    // Act
    const first = lunchMoment(37.5, eatStyles.rias);
    const second = lunchMoment(37.5, eatStyles.rias);

    // Assert
    expect(second).toEqual(first);
  });
});
