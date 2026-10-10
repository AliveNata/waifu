import { distance, type Point, planPath, type StationId, stations } from "./office-layout.js";
import { navGrid } from "./office-nav.js";

export interface ActorState {
  position: Point;
  yaw: number;
  /** Station the actor is heading to or sitting at. */
  target: StationId;
  /** Remaining waypoints. Empty means the actor has arrived. */
  path: Point[];
  walkPhase: number;
}

/** A chibi's stroll: an adult walks about 1.4 m/s at 1.7 m tall, so 1.05 m tall gets about 0.9. */
export const walkSpeed = 0.9;
const turnSpeed = 7;
const arrivalTolerance = 0.02;
/** Radians of leg cycle per meter walked: short, quick steps, the way small legs actually move. */
const strideRadiansPerMeter = 14;
/** Two chibis closer than this, center to center, are about to bump shoulders. */
const personalSpace = 0.55;
/**
 * Near the end of a walk the actor is stepping into a seat or onto a spot, which the floor
 * plan already keeps clear; steering there would only make them miss it.
 */
const noAvoidanceNearGoal = 0.5;

/**
 * Heading bent away from people ahead. Each one closer than `personalSpace` pushes the walker
 * aside and toward its own right, so two people meeting head-on both keep right and pass
 * instead of walking through each other. Anyone already behind is ignored.
 */
function steer(position: Point, heading: Point, others: readonly Point[]): Point {
  let x = heading.x;
  let z = heading.z;
  for (const other of others) {
    const gap = distance(position, other);
    if (gap < 1e-3 || gap >= personalSpace) {
      continue;
    }
    const awayX = (position.x - other.x) / gap;
    const awayZ = (position.z - other.z) / gap;
    const ahead = -(awayX * heading.x + awayZ * heading.z);
    if (ahead <= 0) {
      continue;
    }
    const strength = ((personalSpace - gap) / personalSpace) * ahead;
    // Right-hand side of the heading in this x-right, z-toward-camera floor.
    x += awayX * strength * 1.5 - heading.z * strength;
    z += awayZ * strength * 1.5 + heading.x * strength;
  }
  const length = Math.hypot(x, z);
  return length < 1e-6 ? heading : { x: x / length, z: z / length };
}

export function initialActor(station: StationId): ActorState {
  const { spot, facing } = stations[station];
  return { position: { ...spot }, yaw: facing, target: station, path: [], walkPhase: 0 };
}

/** Shortest signed angle from `from` to `to`, in -PI..PI. */
export function angleDelta(from: number, to: number): number {
  const delta = (to - from) % (2 * Math.PI);
  if (delta > Math.PI) {
    return delta - 2 * Math.PI;
  }
  if (delta < -Math.PI) {
    return delta + 2 * Math.PI;
  }
  return delta;
}

function turnToward(yaw: number, targetYaw: number, deltaSeconds: number): number {
  const delta = angleDelta(yaw, targetYaw);
  const maxStep = turnSpeed * deltaSeconds;
  return Math.abs(delta) <= maxStep ? targetYaw : yaw + Math.sign(delta) * maxStep;
}

/**
 * Advances the actor toward `desired` by one frame. `others` are the other people in the room,
 * walking or not, so this walker can sidestep them.
 */
export function stepActor(
  state: ActorState,
  desired: StationId,
  deltaSeconds: number,
  others: readonly Point[] = [],
): ActorState {
  let { position, yaw, target, path, walkPhase } = state;

  if (desired !== target) {
    target = desired;
    path = planPath(position, desired);
  }

  const goal = stations[target].spot;
  let remaining = walkSpeed * deltaSeconds;
  while (path.length > 0 && remaining > 0) {
    const [waypoint, ...rest] = path as [Point, ...Point[]];
    const gap = distance(position, waypoint);
    if (gap <= arrivalTolerance) {
      position = { ...waypoint };
      path = rest;
      continue;
    }
    const heading = { x: (waypoint.x - position.x) / gap, z: (waypoint.z - position.z) / gap };
    const step = Math.min(remaining, gap);
    let next = { x: position.x + heading.x * step, z: position.z + heading.z * step };
    if (others.length > 0 && distance(position, goal) > noAvoidanceNearGoal) {
      const bent = steer(position, heading, others);
      const sidestep = { x: position.x + bent.x * step, z: position.z + bent.z * step };
      // Only sidestep onto open floor; otherwise keep to the route and let the other person pass.
      if (bent !== heading && navGrid.isFree(sidestep)) {
        next = sidestep;
      }
    }
    yaw = turnToward(yaw, Math.atan2(next.x - position.x, next.z - position.z), deltaSeconds);
    walkPhase += step * strideRadiansPerMeter;
    remaining -= step;
    position = next;
    if (distance(position, waypoint) <= arrivalTolerance) {
      position = { ...waypoint };
      path = rest;
    }
  }

  if (path.length === 0) {
    yaw = turnToward(yaw, stations[target].facing, deltaSeconds);
  }

  return { position, yaw, target, path, walkPhase };
}

export function isWalking(state: ActorState): boolean {
  return state.path.length > 0;
}
