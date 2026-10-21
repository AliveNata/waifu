import { Group, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { type IkChain, solveCcd } from "../src/renderer/office/ik.js";

/** A two-bone arm lying along +x: shoulder at the origin, elbow at 0.15, hand at 0.3. */
function straightArm(): { chain: IkChain; root: Group } {
  const root = new Group();
  const upper = new Group();
  const lower = new Group();
  const hand = new Group();
  root.add(upper);
  upper.add(lower);
  lower.position.x = 0.15;
  lower.add(hand);
  hand.position.x = 0.15;
  root.updateMatrixWorld(true);
  const chain: IkChain = {
    joints: [
      { rotate: upper, measure: upper },
      { rotate: lower, measure: lower },
    ],
    effector: hand,
    sync: () => root.updateMatrixWorld(true),
  };
  return { chain, root };
}

describe("solveCcd", () => {
  it("reaches a target that needs a large turn of the arm", () => {
    // Arrange: straight up from the shoulder, a quarter turn away from where the arm points.
    const { chain } = straightArm();
    const target = new Vector3(0, 0.25, 0);

    // Act
    const miss = solveCcd(chain, target, 20);

    // Assert
    expect(miss).toBeLessThan(0.01);
  });

  it("points the arm at a target out of reach instead of leaving it where it was", () => {
    // Arrange
    const { chain } = straightArm();
    const target = new Vector3(-0.2, 0.6, 0.1);

    // Act
    solveCcd(chain, target, 20);

    // Assert
    const hand = chain.effector.getWorldPosition(new Vector3());
    const towardTarget = target.clone().normalize();
    expect(hand.clone().normalize().dot(towardTarget)).toBeGreaterThan(0.95);
  });
});
