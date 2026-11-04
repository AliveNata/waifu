import { type Object3D, Quaternion, Vector3 } from "three";

export interface IkJoint {
  /** Node whose rotation the solver changes. For a VRM this is the normalized bone. */
  rotate: Object3D;
  /** Node whose world position is the pivot. For a VRM this is the raw bone, which carries the body proportions. */
  measure: Object3D;
}

/** A hand to point: turning `rotate` swings `tip` around `pivot`. */
export interface HandAim {
  rotate: Object3D;
  /** The wrist, which IK has already placed. */
  pivot: Object3D;
  tip: Object3D;
  sync(): void;
}

export interface IkChain {
  /** Root to tip, excluding the effector. */
  joints: readonly IkJoint[];
  effector: Object3D;
  /** Brings world matrices (and for a VRM, raw bones) up to date after a rotation. */
  sync(): void;
}

/** Caps each correction so the arm moves smoothly instead of flipping on the first iteration. */
const maxStepRadians = 0.6;

const effectorPosition = new Vector3();
const jointPosition = new Vector3();
const toEffector = new Vector3();
const toTarget = new Vector3();
const delta = new Quaternion();
const clamped = new Quaternion();
const identity = new Quaternion();
const worldRotation = new Quaternion();
const parentRotation = new Quaternion();

/**
 * `target`, or the nearest point on the way to it that the chain can reach without locking
 * straight. A target past an arm's length otherwise pulls the arm rigid and lets the wrist
 * twist round to make up the last bit; held short, the hand simply stops a little away.
 */
export function withinReach(chain: IkChain, target: Vector3, fraction = 0.92): Vector3 {
  const first = chain.joints[0];
  if (first === undefined) {
    return target;
  }
  chain.sync();
  const root = first.measure.getWorldPosition(new Vector3());
  let length = 0;
  let previous = root.clone();
  for (const joint of chain.joints.slice(1)) {
    const at = joint.measure.getWorldPosition(new Vector3());
    length += at.distanceTo(previous);
    previous = at;
  }
  length += chain.effector.getWorldPosition(new Vector3()).distanceTo(previous);
  const reach = length * fraction;
  const offset = target.clone().sub(root);
  if (offset.length() <= reach) {
    return target;
  }
  return root.add(offset.setLength(reach));
}

/**
 * Cyclic coordinate descent: rotate each joint, tip first, so the effector
 * swings toward the target. Returns the remaining distance in meters.
 */
export function solveCcd(chain: IkChain, target: Vector3, iterations = 10, tolerance = 0.004): number {
  for (let iteration = 0; iteration < iterations; iteration++) {
    for (let index = chain.joints.length - 1; index >= 0; index--) {
      const joint = chain.joints[index];
      if (joint === undefined) {
        continue;
      }
      chain.sync();
      chain.effector.getWorldPosition(effectorPosition);
      joint.measure.getWorldPosition(jointPosition);
      toEffector.subVectors(effectorPosition, jointPosition);
      toTarget.subVectors(target, jointPosition);
      if (toEffector.lengthSq() < 1e-8 || toTarget.lengthSq() < 1e-8) {
        continue;
      }
      delta.setFromUnitVectors(toEffector.normalize(), toTarget.normalize());
      const angle = 2 * Math.acos(Math.min(1, Math.abs(delta.w)));
      // A separate quaternion: slerping `delta` toward itself after resetting it would be a no-op.
      clamped.copy(identity).slerp(delta, Math.min(1, maxStepRadians / angle));

      joint.rotate.getWorldQuaternion(worldRotation);
      worldRotation.premultiply(clamped);
      if (joint.rotate.parent !== null) {
        joint.rotate.parent.getWorldQuaternion(parentRotation);
        worldRotation.premultiply(parentRotation.invert());
      }
      joint.rotate.quaternion.copy(worldRotation);
    }
    chain.sync();
    if (chain.effector.getWorldPosition(effectorPosition).distanceTo(target) <= tolerance) {
      break;
    }
  }
  return chain.effector.getWorldPosition(effectorPosition).distanceTo(target);
}

/** Turns the hand at the wrist so its fingertip points at `target`, like one CCD step on the hand. */
export function aimHand(hand: HandAim, target: Vector3): void {
  hand.sync();
  hand.tip.getWorldPosition(effectorPosition);
  hand.pivot.getWorldPosition(jointPosition);
  toEffector.subVectors(effectorPosition, jointPosition);
  toTarget.subVectors(target, jointPosition);
  if (toEffector.lengthSq() < 1e-8 || toTarget.lengthSq() < 1e-8) {
    return;
  }
  delta.setFromUnitVectors(toEffector.normalize(), toTarget.normalize());
  hand.rotate.getWorldQuaternion(worldRotation);
  worldRotation.premultiply(delta);
  if (hand.rotate.parent !== null) {
    hand.rotate.parent.getWorldQuaternion(parentRotation);
    worldRotation.premultiply(parentRotation.invert());
  }
  hand.rotate.quaternion.copy(worldRotation);
  hand.sync();
}
