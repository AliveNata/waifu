import type { VRMHumanBoneName } from "@pixiv/three-vrm";
import { Object3D } from "three";
import { describe, expect, it } from "vitest";
import { armsRelaxed, PoseApplier, type PoseTarget } from "../src/renderer/common/pose.js";

function targetWithBones(mirrorXZ: boolean): { target: PoseTarget; bones: Map<VRMHumanBoneName, Object3D> } {
  const bones = new Map<VRMHumanBoneName, Object3D>();
  const target: PoseTarget = {
    node: (bone) => {
      const existing = bones.get(bone);
      if (existing !== undefined) {
        return existing;
      }
      const created = new Object3D();
      bones.set(bone, created);
      return created;
    },
    mirrorXZ,
  };
  return { target, bones };
}

// A long frame makes the smoothing blend reach the goal, so the test reads the goal pose itself.
const settleSeconds = 10;

describe("PoseApplier", () => {
  it("applies the conventions as-is for VRM 1.0 bones", () => {
    // Arrange
    const { target, bones } = targetWithBones(false);
    const applier = new PoseApplier();

    // Act
    applier.apply(target, { bones: armsRelaxed, hipsOffsetY: 0 }, settleSeconds);

    // Assert
    expect(bones.get("leftUpperArm")?.rotation.z).toBeCloseTo(-1.22);
    expect(bones.get("leftLowerArm")?.rotation.y).toBeCloseTo(-0.25);
  });

  it("mirrors x and z for VRM 0.x bones so the arms still drop", () => {
    // Arrange
    const { target, bones } = targetWithBones(true);
    const applier = new PoseApplier();
    const pose = { bones: { ...armsRelaxed, head: { x: 0.2, y: 0.3, z: 0.1 } }, hipsOffsetY: 0 };

    // Act
    applier.apply(target, pose, settleSeconds);

    // Assert
    expect(bones.get("leftUpperArm")?.rotation.z).toBeCloseTo(1.22);
    const head = bones.get("head")?.rotation;
    expect([head?.x, head?.y, head?.z].map((value) => Number(value?.toFixed(3)))).toEqual([-0.2, 0.3, -0.1]);
  });
});
