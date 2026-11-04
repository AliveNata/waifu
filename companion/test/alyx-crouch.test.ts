import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { crouchAmount, crouchDepth, crouchSeconds, petStandSpot } from "../src/renderer/office/alyx-crouch.js";
import { strokeOnto } from "../src/renderer/office/alyx-hands.js";

describe("Alyx crouching to stroke Mochi", () => {
  it("gets down, stays down for the stroke, and stands back up", () => {
    // Act
    const amounts = [0, crouchSeconds / 2, crouchSeconds, 1.5, 3 - crouchSeconds, 3].map((t) => crouchAmount(t, 3));

    // Assert
    expect(amounts[0]).toBe(0);
    expect(amounts[1]).toBeCloseTo(0.5);
    expect(amounts[2]).toBe(1);
    expect(amounts[3]).toBe(1);
    expect(amounts[4]).toBe(1);
    expect(amounts[5]).toBe(0);
  });

  it("goes down low for her on the floor, less on the beanbag, not at all on a desk", () => {
    // Act
    const floor = crouchDepth(1.16, 0.17);
    const beanbag = crouchDepth(1.16, 0.34);
    const desk = crouchDepth(1.16, 0.92);

    // Assert
    expect(floor).toBeCloseTo(0.54);
    expect(beanbag).toBeCloseTo(0.37);
    expect(desk).toBe(0);
  });

  it("steps in to her along the way he came, and stays put when already close", () => {
    // Act
    const far = petStandSpot({ x: 0, z: 0 }, { x: 2, z: 0 }, 0.4);
    const near = petStandSpot({ x: 0, z: 0 }, { x: 0.3, z: 0 }, 0.4);

    // Assert
    expect(far.x).toBeCloseTo(0.4);
    expect(far.z).toBeCloseTo(0);
    expect(near).toEqual({ x: 0.3, z: 0 });
  });

  it("reaches from his right shoulder down onto her back, within an arm's length", () => {
    // Arrange: looking straight ahead, her back half a meter down and out, a little to the right.
    const down = new Vector3(0, -1, 0);
    const shoulder = new Vector3(0.2, -0.3, 0.05);
    const close = new Vector3(0.05, -0.55, -0.3);
    const far = new Vector3(0, -0.6, -1.5);

    // Act
    const onHer = strokeOnto(close, down, 0);
    const reaching = strokeOnto(far, down, 0);

    // Assert
    expect(onHer.palm.distanceTo(close)).toBeLessThan(0.04);
    expect(onHer.facing.y).toBe(-1);
    // The arm comes in from the right, not straight out of the middle of the view.
    expect(onHer.fingers.x).toBeLessThan(0);
    expect(onHer.fingers.z).toBeLessThan(0);
    expect(reaching.palm.distanceTo(shoulder)).toBeCloseTo(0.6);
  });
});
