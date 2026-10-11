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
  /** How long the actor has stood waiting for someone in the way. */
  blockedSeconds: number;
  /** Time left squeezing past someone after a wait that went nowhere. */
  squeezeSeconds: number;
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
/** Closest two bodies may get, center to center: two shoulders just not touching. */
const minimumGap = 0.36;
/** After waiting this long for someone, plan a detour around them. */
const detourAfterSeconds = 0.8;
/**
 * After this long nobody has moved out of the way (two walkers facing each other in a dead
 * end): squeeze past instead of standing there forever.
 */
const squeezeAfterSeconds = 3;
/** One continuous squeeze, long enough to get past instead of inching by a step at a time. */
const squeezeForSeconds = 1.5;

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
  return {
    position: { ...spot },
    yaw: facing,
    target: station,
    path: [],
    walkPhase: 0,
    blockedSeconds: 0,
    squeezeSeconds: 0,
  };
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

/** True when the step from `from` to `to` brings the walker closer to someone already too close. */
function crowds(from: Point, to: Point, others: readonly Point[]): boolean {
  return others.some((other) => distance(to, other) < minimumGap && distance(to, other) < distance(from, other));
}

/** How far to the side someone steps to let a person pass in a narrow spot. */
const makeWayDistance = 0.5;

/**
 * A free spot beside the walker, to the right of the way to `blocker` (or the left when the right
 * is a wall), so two people stuck face to face each step aside and can pass.
 */
function makeWaySpot(position: Point, blocker: Point, others: readonly Point[]): Point | null {
  const gap = Math.max(distance(position, blocker), 1e-6);
  const toward = { x: (blocker.x - position.x) / gap, z: (blocker.z - position.z) / gap };
  for (const side of [1, -1]) {
    const spot = {
      x: position.x - toward.z * side * makeWayDistance,
      z: position.z + toward.x * side * makeWayDistance,
    };
    const clear = others.every((other) => distance(spot, other) >= minimumGap);
    if (clear && navGrid.hasLineOfSight(position, spot)) {
      return spot;
    }
  }
  return null;
}

/**
 * Advances the actor toward `desired` by one frame. `others` are the other people in the room,
 * walking or not: the walker steers around them, waits when there is no room to pass, plans a
 * detour if the wait drags on, and steps aside if even that fails. `standing` are the people who
 * stay put where they are (at a station); new routes go around them like furniture.
 */
export function stepActor(
  state: ActorState,
  desired: StationId,
  deltaSeconds: number,
  others: readonly Point[] = [],
  standing: readonly Point[] = [],
): ActorState {
  let { position, yaw, target, path, walkPhase, blockedSeconds, squeezeSeconds } = state;
  squeezeSeconds = Math.max(0, squeezeSeconds - deltaSeconds);

  if (desired !== target) {
    target = desired;
    path = planPath(position, desired, navGrid, standing);
    blockedSeconds = 0;
  }

  const goal = stations[target].spot;
  let remaining = walkSpeed * deltaSeconds;
  let replanned = false;
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
    // A sidestep can leave the planned line, and heading straight back to the next waypoint
    // from there may clip a corner. Re-plan from here instead. The last step onto a seat is
    // meant to cross its footprint, so it is left alone.
    if (!replanned && waypoint !== path.at(-1) && navGrid.isFree(position) && !navGrid.isFree(next)) {
      replanned = true;
      path = planPath(position, target, navGrid, standing);
      continue;
    }
    if (others.length > 0) {
      // Steering would make someone stepping into a seat miss it, so only the open walk bends.
      if (distance(position, goal) > noAvoidanceNearGoal) {
        const bent = steer(position, heading, others);
        const sidestep = { x: position.x + bent.x * step, z: position.z + bent.z * step };
        // Only sidestep onto open floor; otherwise keep to the route.
        if (bent !== heading && navGrid.isFree(sidestep)) {
          next = sidestep;
        }
      }
      // Waiting applies all the way to the spot: nobody steps onto a person passing by it.
      if (squeezeSeconds === 0 && crowds(position, next, others)) {
        const before = blockedSeconds;
        blockedSeconds += deltaSeconds;
        // Every interval: first a detour around whoever is close, then a step aside to let them by.
        const attempt = Math.floor(blockedSeconds / detourAfterSeconds);
        if (attempt > Math.floor(before / detourAfterSeconds)) {
          const nearby = others.filter((other) => distance(position, other) < 1.2);
          const blocker = nearby.reduce<Point | null>(
            (closest, other) =>
              closest === null || distance(position, other) < distance(position, closest) ? other : closest,
            null,
          );
          const aside = attempt >= 2 && blocker !== null ? makeWaySpot(position, blocker, others) : null;
          path =
            aside === null
              ? planPath(position, target, navGrid, nearby)
              : [aside, ...planPath(aside, target, navGrid, nearby)];
        }
        if (blockedSeconds >= squeezeAfterSeconds) {
          squeezeSeconds = squeezeForSeconds;
          blockedSeconds = 0;
        }
        break;
      }
    }
    yaw = turnToward(yaw, Math.atan2(next.x - position.x, next.z - position.z), deltaSeconds);
    walkPhase += step * strideRadiansPerMeter;
    remaining -= step;
    position = next;
    blockedSeconds = 0;
    if (distance(position, waypoint) <= arrivalTolerance) {
      position = { ...waypoint };
      path = rest;
    }
  }

  if (path.length === 0) {
    yaw = turnToward(yaw, stations[target].facing, deltaSeconds);
  }

  return { position, yaw, target, path, walkPhase, blockedSeconds, squeezeSeconds };
}

export function isWalking(state: ActorState): boolean {
  return state.path.length > 0;
}
