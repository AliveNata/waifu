import type { VRM, VRMSpringBoneCollider } from "@pixiv/three-vrm";
import { Group } from "three";
import type { ExpressionWeights } from "../common/expressions.js";
import { type PoseTarget, vrmPoseTarget } from "../common/pose.js";
import { disposeVrm } from "../common/vrm-loader.js";
import { updateVrmStable } from "../common/vrm-update.js";
import { applyChibi } from "./chibi.js";
import type { HandAim, IkChain } from "./ik.js";
import type { LegMetrics } from "./seating.js";

export type ArmSide = "left" | "right";
export type ArmTip = "wrist" | "fingertip";

/** A character in the office: either a chibi VRM or a low-poly placeholder. */
export interface OfficeAvatar {
  readonly kind: "vrm" | "placeholder";
  /** Positioned and turned by the stage. Faces +Z at yaw 0. */
  readonly root: Group;
  /** Leg measurements in world meters, used to fit seated poses to each seat. */
  readonly legs: LegMetrics;
  readonly poseTarget: PoseTarget;
  /** Brings world matrices up to date after the pose, before IK reads positions. */
  syncPose(): void;
  /**
   * Upper and lower arm as an IK chain. The tip is the wrist, or the index fingertip for work that
   * touches something small, like a key; a model without finger bones falls back to the wrist.
   */
  arm(side: ArmSide, tip: ArmTip): IkChain | null;
  /** The hand below the wrist, to point the fingers once the arm has placed the wrist. */
  hand(side: ArmSide): HandAim | null;
  /** Lets hair and skirts collide with the room (floor, backrests). Placeholders have no springs. */
  addHairColliders(colliders: readonly VRMSpringBoneCollider[]): void;
  setExpressions(weights: ExpressionWeights, blink: number): void;
  update(deltaSeconds: number): void;
  dispose(): void;
}

export class VrmOfficeAvatar implements OfficeAvatar {
  readonly kind = "vrm";
  readonly root = new Group();
  readonly legs: LegMetrics;
  readonly poseTarget: PoseTarget;

  constructor(private readonly vrm: VRM) {
    const metrics = applyChibi(vrm);
    this.legs = metrics.legs;
    this.poseTarget = vrmPoseTarget(vrm);
    // The inner scene keeps the VRM's own base yaw (VRM 0.x is rotated) and the floor offset.
    vrm.scene.position.y = metrics.floorOffset;
    vrm.scene.traverse((object) => {
      object.castShadow = true;
    });
    this.root.add(vrm.scene);
  }

  syncPose(): void {
    this.vrm.humanoid.update();
    this.root.updateMatrixWorld(true);
  }

  arm(side: ArmSide, tip: ArmTip): IkChain | null {
    const humanoid = this.vrm.humanoid;
    const upperRotate = humanoid.getNormalizedBoneNode(`${side}UpperArm`);
    const lowerRotate = humanoid.getNormalizedBoneNode(`${side}LowerArm`);
    const upperMeasure = humanoid.getRawBoneNode(`${side}UpperArm`);
    const lowerMeasure = humanoid.getRawBoneNode(`${side}LowerArm`);
    const hand = humanoid.getRawBoneNode(`${side}Hand`);
    if (
      upperRotate === null ||
      lowerRotate === null ||
      upperMeasure === null ||
      lowerMeasure === null ||
      hand === null
    ) {
      return null;
    }
    const finger = tip === "fingertip" ? humanoid.getRawBoneNode(`${side}IndexDistal`) : null;
    return {
      joints: [
        { rotate: upperRotate, measure: upperMeasure },
        { rotate: lowerRotate, measure: lowerMeasure },
      ],
      effector: finger ?? hand,
      sync: () => this.syncPose(),
    };
  }

  hand(side: ArmSide): HandAim | null {
    const humanoid = this.vrm.humanoid;
    const rotate = humanoid.getNormalizedBoneNode(`${side}Hand`);
    const pivot = humanoid.getRawBoneNode(`${side}Hand`);
    const tip = humanoid.getRawBoneNode(`${side}IndexDistal`);
    if (rotate === null || pivot === null || tip === null) {
      return null;
    }
    return { rotate, pivot, tip, sync: () => this.syncPose() };
  }

  addHairColliders(colliders: readonly VRMSpringBoneCollider[]): void {
    const group = { name: "office-environment", colliders: [...colliders] };
    for (const joint of this.vrm.springBoneManager?.joints ?? []) {
      joint.colliderGroups = [...joint.colliderGroups, group];
    }
  }

  setExpressions(weights: ExpressionWeights, blink: number): void {
    const expressions = this.vrm.expressionManager;
    if (expressions == null) {
      return;
    }
    for (const [name, weight] of Object.entries(weights)) {
      expressions.setValue(name, weight);
    }
    expressions.setValue("blink", blink);
  }

  update(deltaSeconds: number): void {
    updateVrmStable(this.vrm, deltaSeconds);
  }

  dispose(): void {
    this.root.removeFromParent();
    disposeVrm(this.vrm);
  }
}
