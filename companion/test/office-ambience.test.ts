import { describe, expect, it } from "vitest";
import { nightFactor } from "../src/renderer/office/daylight.js";
import { initialMug, type MugInput, stepMug } from "../src/renderer/office/office-mug.js";

function at(hours: number, minutes = 0): Date {
  const date = new Date(2026, 9, 10);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

describe("nightFactor", () => {
  it.each([
    [10, 0, 0],
    [16, 0, 0],
    [21, 0, 1],
    [2, 0, 1],
    [8, 0, 0],
  ])("is fixed by %d:%d at %d", (hours, minutes, expected) => {
    expect(nightFactor(at(hours, minutes))).toBe(expected);
  });

  it("dims gradually through dusk", () => {
    // Act
    const early = nightFactor(at(17, 50));
    const late = nightFactor(at(18, 40));

    // Assert
    expect(early).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(early);
    expect(late).toBeLessThan(1);
  });
});

describe("mug", () => {
  const atDesk: Omit<MugInput, "target" | "arrived" | "departedFrom"> = { desk: "desk-asuna" };

  it("takes the desk mug to the pantry and puts it back by the keyboard", () => {
    // Act
    const leaving = stepMug(initialMug, { ...atDesk, target: "coffee", arrived: false, departedFrom: "desk-asuna" });
    const brewing = stepMug(leaving, { ...atDesk, target: "coffee", arrived: true, departedFrom: null });
    const walkingBack = stepMug(brewing, { ...atDesk, target: "desk-asuna", arrived: false, departedFrom: "coffee" });
    const home = stepMug(walkingBack, { ...atDesk, target: "desk-asuna", arrived: true, departedFrom: null });

    // Assert
    expect(leaving).toMatchObject({ inHand: true, onDesk: false });
    expect(walkingBack).toMatchObject({ inHand: true, onDesk: false });
    expect(home).toMatchObject({ inHand: false, onDesk: true });
  });

  it("lets someone without a desk finish the cup where they go next", () => {
    // Arrange
    const brewing = stepMug(initialMug, { desk: null, target: "coffee", arrived: true, departedFrom: null });

    // Act
    const drinking = stepMug(brewing, { desk: null, target: "board-rias", arrived: true, departedFrom: null });
    const movedOn = stepMug(drinking, { desk: null, target: "sofa-1", arrived: false, departedFrom: "board-rias" });

    // Assert
    expect(drinking.inHand).toBe(true);
    expect(movedOn.inHand).toBe(false);
  });
});
