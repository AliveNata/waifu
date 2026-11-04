import { strideRadiansPerMeter, walkSpeed } from "./office-actor.js";
import { doorwayPath, type Point } from "./office-plan.js";

/** Long enough for the glass doors to slide most of the way open before anyone walks into them. */
export const doorOpenPause = 0.6;

function segmentLength(from: Point, to: Point): number {
  return Math.hypot(to.x - from.x, to.z - from.z);
}

export const doorwayLength = doorwayPath
  .slice(1)
  .reduce((total, point, index) => total + segmentLength(doorwayPath[index] as Point, point), 0);

/** How long the walk back in takes, from the turn at the end of the hall to the door spot. */
export const doorwayReturnSeconds = doorwayLength / walkSpeed;

export interface DoorwayWalk {
  position: Point;
  yaw: number;
  /** Walking right now, rather than standing at the door spot waiting for it to open. */
  walking: boolean;
  walkPhase: number;
  /** Gone round the turn at the end of the hall, out of the office until the step ends. */
  gone: boolean;
}

/** Where along the path `distance` meters from the door spot is, and which way that stretch runs. */
export function doorwayAlong(distance: number): { position: Point; heading: number } {
  let left = distance;
  for (let index = 1; index < doorwayPath.length; index++) {
    const from = doorwayPath[index - 1] as Point;
    const to = doorwayPath[index] as Point;
    const length = segmentLength(from, to);
    const heading = Math.atan2(to.x - from.x, to.z - from.z);
    if (left <= length || index === doorwayPath.length - 1) {
      const t = length === 0 ? 1 : Math.min(1, left / length);
      return { position: { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t }, heading };
    }
    left -= length;
  }
  const last = doorwayPath[doorwayPath.length - 1] as Point;
  return { position: last, heading: 0 };
}

/**
 * Leaving through the door, on the step's own clock from arriving at the door spot: a moment for
 * the doors to open, then out along the hall and round the turn. The return is the same walk the
 * other way, timed to end at the door spot as the step ends. A step too short for both meets in
 * the middle, so nobody ever jumps.
 */
export function doorwayWalk(stepElapsed: number, remaining: number): DoorwayWalk {
  const out = Math.max(0, (stepElapsed - doorOpenPause) * walkSpeed);
  const back = Math.max(0, remaining * walkSpeed);
  const distance = Math.min(out, back, doorwayLength);
  const returning = back < out;
  const { position, heading } = doorwayAlong(distance);
  return {
    position,
    // Walking back in faces the room: the heading of the stretch, turned round.
    yaw: returning ? heading + Math.PI : heading,
    walking: distance > 0 && distance < doorwayLength,
    walkPhase: distance * strideRadiansPerMeter,
    gone: distance >= doorwayLength,
  };
}
