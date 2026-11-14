import { describe, expect, it } from "vitest";
import { crouchSeconds } from "../src/renderer/office/alyx-crouch.js";
import { memberPetSeconds, petPhase, strokeOffset, strokeSeconds } from "../src/renderer/office/cat-petting.js";

describe("a teammate stroking Mochi", () => {
  it("gets down first, strokes her, then stands back up", () => {
    // Act
    const start = petPhase(0);
    const halfDown = petPhase(crouchSeconds / 2);
    const stroking = petPhase(crouchSeconds + strokeSeconds / 2);
    const rising = petPhase(memberPetSeconds - crouchSeconds / 2);
    const over = petPhase(memberPetSeconds);

    // Assert
    expect(start).toEqual({ down: 0, stroking: false, done: false });
    expect(halfDown.down).toBeGreaterThan(0);
    expect(halfDown.down).toBeLessThan(1);
    expect(halfDown.stroking).toBe(false);
    expect(stroking).toEqual({ down: 1, stroking: true, done: false });
    expect(rising.stroking).toBe(false);
    expect(rising.down).toBeLessThan(1);
    expect(over.done).toBe(true);
    expect(over.down).toBe(0);
  });

  it("moves the hand along her back and no further", () => {
    // Act
    const reach = Array.from({ length: 40 }, (_, step) => strokeOffset(step * 0.1));

    // Assert
    expect(Math.max(...reach)).toBeLessThanOrEqual(0.05);
    expect(Math.min(...reach)).toBeGreaterThanOrEqual(-0.05);
    expect(Math.max(...reach) - Math.min(...reach)).toBeGreaterThan(0.08);
  });
});
