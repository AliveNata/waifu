import type { Point } from "./office-plan.js";

/**
 * Alyx crouching to stroke Mochi: a step in close, down onto his heels, the stroke, and back up.
 * The numbers are for a 1.16 m eye height and a cat whose back is a hand's height off her perch.
 */

/** Seconds to get down, and the same again to stand back up at the end. */
export const crouchSeconds = 0.6;

/** How far from her he crouches, center to center: near enough that the hand reaches her back. */
export const petDistance = 0.4;

/** His eyes this far above her back when crouched, a forearm and a bit. */
const eyeAboveBack = 0.45;

/** The deepest he goes: heels down, knees bent all the way. */
const deepestCrouch = 0.55;

/** How far down he is, 0 standing to 1 fully crouched, `seconds` into a stroke lasting `total`. */
export function crouchAmount(seconds: number, total: number): number {
  if (seconds < 0 || seconds > total) {
    return 0;
  }
  const k = Math.min(1, seconds / crouchSeconds, (total - seconds) / crouchSeconds);
  return k * k * (3 - 2 * k);
}

/**
 * How far below standing his eyes go to bring them just above her back, given his standing eye
 * height. Nothing when she is up high already, on a desk or in someone's arms.
 */
export function crouchDepth(standingEye: number, catBack: number): number {
  return Math.min(deepestCrouch, Math.max(0, standingEye - (catBack + eyeAboveBack)));
}

/** Where he steps to, on the line from her to where he stands now, `petDistance` from her. */
export function petStandSpot(cat: Point, alyx: Point, distance = petDistance): Point {
  const dx = alyx.x - cat.x;
  const dz = alyx.z - cat.z;
  const length = Math.hypot(dx, dz);
  if (length <= distance) {
    return { ...alyx };
  }
  return { x: cat.x + (dx / length) * distance, z: cat.z + (dz / length) * distance };
}
