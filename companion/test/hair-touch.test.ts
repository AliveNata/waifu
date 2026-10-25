import type { VRM, VRMSpringBoneJoint } from "@pixiv/three-vrm";
import { Object3D, Scene, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { HairTouch } from "../src/renderer/overlay/hair-touch.js";

/** Just enough of a model: a head with one hair strand under it, and one spring elsewhere. */
function fakeModel() {
  const head = new Object3D();
  const strand = new Object3D();
  head.add(strand);
  const chest = new Object3D();
  const joint = (bone: Object3D) =>
    ({
      bone,
      colliderGroups: [],
      settings: { gravityDir: new Vector3(0, -1, 0), gravityPower: 0.2 },
    }) as unknown as VRMSpringBoneJoint;
  const hair = joint(strand);
  const other = joint(chest);
  const vrm = {
    humanoid: { getRawBoneNode: (name: string) => (name === "head" ? head : null) },
    springBoneManager: { joints: new Set([hair, other]) },
  } as unknown as VRM;
  return { vrm, hair, other };
}

describe("HairTouch", () => {
  it("lets the palm push only the strands that hang from the head", () => {
    // Arrange
    const { vrm, hair, other } = fakeModel();

    // Act
    new HairTouch(vrm, new Scene());

    // Assert
    expect(hair.colliderGroups.map((group) => group.name)).toEqual(["pointer-hand"]);
    expect(other.colliderGroups).toEqual([]);
  });

  it("sweeps the hair the way the hand strokes, and leaves the rest alone", () => {
    // Arrange
    const { vrm, hair, other } = fakeModel();
    const touch = new HairTouch(vrm, new Scene());

    // Act: the palm moves toward +x over a few frames.
    for (let frame = 0; frame < 10; frame++) {
      touch.update({ point: new Vector3(frame * 0.005, 1.5, 0.1), radius: 0.04 }, 1 / 30);
    }

    // Assert
    expect(hair.settings.gravityDir.x).toBeGreaterThan(0.3);
    expect(hair.settings.gravityPower).toBeGreaterThan(0.2);
    expect(other.settings.gravityDir.toArray()).toEqual([0, -1, 0]);
  });

  it("settles back and gives the strands their own pull again", () => {
    // Arrange
    const { vrm, hair } = fakeModel();
    const touch = new HairTouch(vrm, new Scene());
    for (let frame = 0; frame < 10; frame++) {
      touch.update({ point: new Vector3(frame * 0.005, 1.5, 0.1), radius: 0.04 }, 1 / 30);
    }

    // Act
    for (let frame = 0; frame < 60; frame++) {
      touch.update(null, 1 / 30);
    }
    touch.dispose();

    // Assert
    expect(hair.settings.gravityDir.toArray()).toEqual([0, -1, 0]);
    expect(hair.settings.gravityPower).toBeCloseTo(0.2);
    expect(hair.colliderGroups).toEqual([]);
  });
});
