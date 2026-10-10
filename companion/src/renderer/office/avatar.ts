import type { VRM } from "@pixiv/three-vrm";
import { Group } from "three";
import type { ExpressionWeights } from "../common/expressions.js";
import { type PoseTarget, vrmPoseTarget } from "../common/pose.js";
import { disposeVrm } from "../common/vrm-loader.js";
import { updateVrmStable } from "../common/vrm-update.js";
import { applyChibi } from "./chibi.js";
import type { IkChain } from "./ik.js";

/** A character in the office: either a chibi VRM or a low-poly placeholder. */
export interface OfficeAvatar {
  readonly kind: "vrm" | "placeholder";
  /** Positioned and turned by the stage. Faces +Z at yaw 0. */
  readonly root: Group;
  /** Hips drop for sitting, in pose units. */
  readonly sitDrop: number;
  readonly poseTarget: PoseTarget;
  /** Brings world matrices up to date after the pose, before IK reads positions. */
  syncPose(): void;
  rightArm(): IkChain | null;
  setExpressions(weights: ExpressionWeights, blink: number): void;
  update(deltaSeconds: number): void;
  dispose(): void;
}

export class VrmOfficeAvatar implements OfficeAvatar {
  readonly kind = "vrm";
  readonly root = new Group();
  readonly sitDrop: number;
  readonly poseTarget: PoseTarget;

  constructor(private readonly vrm: VRM) {
    const metrics = applyChibi(vrm);
    this.sitDrop = metrics.sitDrop;
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

  rightArm(): IkChain | null {
    const humanoid = this.vrm.humanoid;
    const upperRotate = humanoid.getNormalizedBoneNode("rightUpperArm");
    const lowerRotate = humanoid.getNormalizedBoneNode("rightLowerArm");
    const upperMeasure = humanoid.getRawBoneNode("rightUpperArm");
    const lowerMeasure = humanoid.getRawBoneNode("rightLowerArm");
    const hand = humanoid.getRawBoneNode("rightHand");
    if (
      upperRotate === null ||
      lowerRotate === null ||
      upperMeasure === null ||
      lowerMeasure === null ||
      hand === null
    ) {
      return null;
    }
    return {
      joints: [
        { rotate: upperRotate, measure: upperMeasure },
        { rotate: lowerRotate, measure: lowerMeasure },
      ],
      effector: hand,
      sync: () => this.syncPose(),
    };
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
