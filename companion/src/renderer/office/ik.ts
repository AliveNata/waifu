import { type Object3D, Quaternion, Vector3 } from "three";

export interface IkJoint {
  /** Node whose rotation the solver changes. For a VRM this is the normalized bone. */
  rotate: Object3D;
  /** Node whose world position is the pivot. For a VRM this is the raw bone, which carries the chibi scaling. */
  measure: Object3D;
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
