import { Box3, Group, type Scene, Vector3 } from "three";
import { PoseApplier } from "../common/pose.js";
import type { ArmSide, OfficeAvatar } from "./avatar.js";
import { type CourierVisit, courierHolding, courierWalk } from "./courier-visit.js";
import { solveCcd, withinReach } from "./ik.js";
import type { FoodKind } from "./office-food.js";
import type { Point } from "./office-plan.js";
import { officePose } from "./office-pose.js";
import { shutPackage } from "./scene/bar-food.js";

/** The parcel is held in front at this share of the hips height: about the belly, both hands under it. */
const holdHeight = 1.12;
/** From the body's middle to the near side of the parcel. */
const holdForward = 0.12;

/**
 * The courier on screen: their model walking the hall, the order's own packaging held in front
 * with both hands on the way in and while waiting, empty-handed on the way out.
 */
export class Courier {
  private readonly applier = new PoseApplier(10);
  private readonly parcel = new Group();
  private parcelKind: FoodKind | null = null;
  /** The parcel's size as built, before it is placed in the courier's hands. */
  private readonly parcelSize = new Vector3();
  private readonly parcelCenter = new Vector3();

  constructor(
    private readonly avatar: OfficeAvatar,
    scene: Scene,
  ) {
    this.avatar.root.visible = false;
    this.parcel.visible = false;
    scene.add(this.avatar.root, this.parcel);
  }

  /** Where the parcel is, for Alyx to reach for while the courier holds it out. */
  parcelPoint(): Point & { y: number } {
    return { x: this.parcelCenter.x, y: this.parcelCenter.y, z: this.parcelCenter.z };
  }

  /** The courier's feet, while in sight; null while out of the office. */
  position(): Point | null {
    const root = this.avatar.root;
    return root.visible ? { x: root.position.x, z: root.position.z } : null;
  }

  update(visit: CourierVisit | null, now: number, time: number, delta: number): void {
    const root = this.avatar.root;
    const walk = visit === null ? null : courierWalk(visit, now);
    root.visible = walk !== null && !walk.gone;
    const holding = root.visible && courierHolding(visit);
    this.parcel.visible = holding;
    if (walk === null || !root.visible || visit === null) {
      return;
    }
    root.position.set(walk.position.x, 0, walk.position.z);
    root.rotation.y = walk.yaw;
    const pose = officePose({
      // Standing at the door with the parcel held to the body, like waiting with a report.
      action: walk.walking ? null : holding ? "wait-report" : null,
      walkPhase: walk.walkPhase,
      time,
      actionElapsed: 0,
      seat: null,
      keystrokes: 0,
      carrying: false,
    });
    this.applier.apply(this.avatar.poseTarget, pose, delta);
    if (holding) {
      this.showParcel(visit.kind);
      this.placeParcel(walk.yaw);
      this.handsOnParcel(walk.yaw);
    }
    this.avatar.update(delta);
  }

  private showParcel(kind: FoodKind): void {
    if (this.parcelKind === kind) {
      return;
    }
    this.parcelKind = kind;
    this.parcel.clear();
    this.parcel.position.set(0, 0, 0);
    this.parcel.rotation.set(0, 0, 0);
    this.parcel.add(shutPackage(kind));
    this.parcel.updateMatrixWorld(true);
    new Box3().setFromObject(this.parcel).getSize(this.parcelSize);
  }

  private placeParcel(yaw: number): void {
    const root = this.avatar.root;
    const forward = holdForward + this.parcelSize.z / 2;
    const bottom = this.avatar.legs.hipsHeight * holdHeight - this.parcelSize.y / 2;
    this.parcel.position.set(
      root.position.x + Math.sin(yaw) * forward,
      bottom,
      root.position.z + Math.cos(yaw) * forward,
    );
    this.parcel.rotation.y = yaw;
    this.parcelCenter.set(this.parcel.position.x, bottom + this.parcelSize.y / 2, this.parcel.position.z);
  }

  /** Each wrist at a side of the parcel, a little under its middle. */
  private handsOnParcel(yaw: number): void {
    // Facing +Z at yaw 0, the courier's left is +X.
    const left = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const half = this.parcelSize.x / 2 + 0.02;
    this.avatar.syncPose();
    for (const side of ["left", "right"] as const satisfies readonly ArmSide[]) {
      const arm = this.avatar.arm(side, "wrist");
      if (arm === null) {
        continue;
      }
      const target = this.parcelCenter
        .clone()
        .addScaledVector(left, side === "left" ? half : -half)
        .setY(this.parcelCenter.y - this.parcelSize.y * 0.15);
      solveCcd(arm, withinReach(arm, target));
    }
  }

  dispose(): void {
    this.parcel.removeFromParent();
    this.avatar.dispose();
  }
}
