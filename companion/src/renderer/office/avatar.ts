import type { VRM, VRMSpringBoneCollider } from "@pixiv/three-vrm";
import { Group, Vector3 } from "three";
import type { ExpressionWeights } from "../common/expressions.js";
import { type PoseTarget, vrmPoseTarget } from "../common/pose.js";
import { disposeVrm } from "../common/vrm-loader.js";
import { updateVrmStable } from "../common/vrm-update.js";
import { applyBodyProportions } from "./body-proportions.js";
import type { HandAim, IkChain } from "./ik.js";
import type { LegMetrics } from "./seating.js";

export type ArmSide = "left" | "right";
export type ArmTip = "wrist" | "fingertip";

/** A character in the office: either a VRM or a low-poly placeholder. */
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

/**
 * Colliders farther than this from a member's feet cannot touch their hair: the longest hair
 * on the team reaches below the knees, and a member walks well under this between refreshes.
 */
const hairReach = 1.6;
/** Seconds between picking the nearby colliders again. */
const nearbyRefreshSeconds = 0.25;

export class VrmOfficeAvatar implements OfficeAvatar {
  readonly kind = "vrm";
  readonly root = new Group();
  readonly legs: LegMetrics;
  readonly poseTarget: PoseTarget;

  /** The office's colliders with their fixed world positions, from addHairColliders. */
  private environment: { collider: VRMSpringBoneCollider; at: Vector3; always: boolean }[] = [];
  /** The collider group the hair joints test: the environment's colliders near this member. */
  private readonly nearby: { name: string; colliders: VRMSpringBoneCollider[] } = {
    name: "office-environment",
    colliders: [],
  };
  private sinceRefresh = 0;
  private readonly scratch = new Vector3();

  constructor(private readonly vrm: VRM) {
    const metrics = applyBodyProportions(vrm);
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
    // Every hair joint tests every collider in its groups each step, and the office has a few
    // for every seat in the room. Only the ones near enough for hair to reach are kept in the
    // group, refreshed as the member moves; the floor is always in.
    this.environment = colliders.map((collider) => ({
      collider,
      at: collider.getWorldPosition(new Vector3()),
      always: collider.shape.type === "plane",
    }));
    for (const joint of this.vrm.springBoneManager?.joints ?? []) {
      joint.colliderGroups = [...joint.colliderGroups, this.nearby];
    }
    this.refreshNearby();
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
    this.sinceRefresh += deltaSeconds;
    if (this.sinceRefresh >= nearbyRefreshSeconds) {
      this.refreshNearby();
    }
    updateVrmStable(this.vrm, deltaSeconds);
  }

  private refreshNearby(): void {
    this.sinceRefresh = 0;
    const here = this.root.getWorldPosition(this.scratch);
    this.nearby.colliders.length = 0;
    for (const { collider, at, always } of this.environment) {
      if (always || at.distanceToSquared(here) < hairReach * hairReach) {
        this.nearby.colliders.push(collider);
      }
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    disposeVrm(this.vrm);
  }
}
