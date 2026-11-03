import type { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";
import { Box3, Vector3 } from "three";
import type { LegMetrics } from "./seating.js";

export interface BodyProportions {
  headScale: number;
  legScale: number;
  armScale: number;
  /** Standing height in world meters, sized to match the office furniture. */
  worldHeight: number;
}

/**
 * The office's people at ordinary human proportions, the model's own head, legs and arms, sized
 * so the furniture fits them: desks come to just under half their height, as in a real office.
 */
export const officeProportions: BodyProportions = {
  headScale: 1,
  legScale: 1,
  armScale: 1,
  worldHeight: 1.2,
};

export interface BodyMetrics {
  /** Uniform scale applied to vrm.scene. */
  sceneScale: number;
  /** Y offset for vrm.scene so the soles rest on the floor. */
  floorOffset: number;
  legs: LegMetrics;
}

function worldPosition(vrm: VRM, bone: VRMHumanBoneName): Vector3 {
  const node = vrm.humanoid.getRawBoneNode(bone);
  if (node === null) {
    throw new Error(`Model ini tidak punya bone ${bone}, padahal wajib untuk humanoid VRM.`);
  }
  return node.getWorldPosition(new Vector3());
}

function worldY(vrm: VRM, bone: VRMHumanBoneName): number {
  return worldPosition(vrm, bone).y;
}

function scaleBone(vrm: VRM, bone: VRMHumanBoneName, scale: number): void {
  // Raw bones: the humanoid rig only copies rotations from normalized bones,
  // so a scale set here survives every vrm.update().
  vrm.humanoid.getRawBoneNode(bone)?.scale.setScalar(scale);
}

/**
 * three-vrm applies collider radii and joint hit radii in world units without
 * the bone's scale, so after shrinking the model they stay full size and push
 * the hair outward. Scale them by the world scale each node now has.
 */
function scaleSpringRadii(vrm: VRM): void {
  const manager = vrm.springBoneManager;
  if (manager == null) {
    return;
  }
  const scale = new Vector3();
  for (const collider of manager.colliders) {
    collider.getWorldScale(scale);
    const shape = collider.shape as { radius?: number };
    if (typeof shape.radius === "number") {
      shape.radius *= scale.x;
    }
  }
  for (const joint of manager.joints) {
    joint.bone.getWorldScale(scale);
    joint.settings.hitRadius *= scale.x;
  }
}

/**
 * Reshapes a VRM by scaling raw bones (a scale of 1 keeps the model as made), then sizes and
 * grounds it for the office. Must run on a model in its rest pose.
 */
export function applyBodyProportions(vrm: VRM, proportions: BodyProportions = officeProportions): BodyMetrics {
  vrm.scene.updateMatrixWorld(true);
  const restBounds = new Box3().setFromObject(vrm.scene);
  const hipsY = worldY(vrm, "hips");
  const headY = worldY(vrm, "head");
  const headTopAboveBone = restBounds.max.y - headY;

  scaleBone(vrm, "head", proportions.headScale);
  scaleBone(vrm, "leftUpperLeg", proportions.legScale);
  scaleBone(vrm, "rightUpperLeg", proportions.legScale);
  scaleBone(vrm, "leftUpperArm", proportions.armScale);
  scaleBone(vrm, "rightUpperArm", proportions.armScale);

  // Shorter legs lift the soles off the floor by the amount the leg chain shrank.
  const soleY = hipsY * (1 - proportions.legScale);
  const headTopY = headY + headTopAboveBone * proportions.headScale;
  const shapedHeight = headTopY - soleY;

  const sceneScale = proportions.worldHeight / shapedHeight;
  vrm.scene.scale.setScalar(sceneScale);
  vrm.scene.updateMatrixWorld(true);
  // Simulate hair and skirt relative to the hips. In world space the scaled-down
  // strands trail behind like a windsock whenever she walks.
  const hips = vrm.humanoid.getRawBoneNode("hips");
  for (const joint of vrm.springBoneManager?.joints ?? []) {
    joint.center = hips;
  }
  scaleSpringRadii(vrm);
  // Springs cache their rest lengths, so re-seed them at the new scale.
  vrm.springBoneManager?.setInitState();

  // Measured after scaling, so the numbers are the model's own legs in world meters.
  const soleWorld = soleY * sceneScale;
  const hipsWorld = worldPosition(vrm, "hips");
  const thighWorld = worldPosition(vrm, "leftUpperLeg");
  const kneeWorld = worldPosition(vrm, "leftLowerLeg");
  return {
    sceneScale,
    floorOffset: -soleWorld,
    legs: {
      hipsHeight: hipsWorld.y - soleWorld,
      thighJointDrop: Math.max(0, hipsWorld.y - thighWorld.y),
      thigh: thighWorld.distanceTo(kneeWorld),
      shin: Math.max(0.01, kneeWorld.y - soleWorld),
      poseUnitsPerMeter: 1 / sceneScale,
    },
  };
}
