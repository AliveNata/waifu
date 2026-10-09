import { distance, type Point, planPath, type StationActivity, type StationId, stations } from "./office-layout.js";

export type ActorActivity = { kind: "walk"; phase: number } | { kind: "station"; activity: StationActivity };

export interface ActorState {
  position: Point;
  yaw: number;
  /** Station the actor is heading to or sitting at. */
  target: StationId;
  /** Remaining waypoints. Empty means the actor has arrived. */
  path: Point[];
  walkPhase: number;
}

export const walkSpeed = 1.1;
const turnSpeed = 7;
const arrivalTolerance = 0.02;
/** Radians of leg cycle per meter walked. Tuned for chibi stride length. */
const strideRadiansPerMeter = 9;

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

export function stepActor(state: ActorState, desired: StationId, deltaSeconds: number): ActorState {
  let { position, yaw, target, path, walkPhase } = state;

  if (desired !== target) {
    target = desired;
    path = planPath(position, desired);
  }

  let remaining = walkSpeed * deltaSeconds;
  while (path.length > 0 && remaining > 0) {
    const [waypoint, ...rest] = path as [Point, ...Point[]];
    const gap = distance(position, waypoint);
    if (gap <= arrivalTolerance) {
      position = { ...waypoint };
      path = rest;
      continue;
    }
    const headingYaw = Math.atan2(waypoint.x - position.x, waypoint.z - position.z);
    yaw = turnToward(yaw, headingYaw, deltaSeconds);
    const step = Math.min(remaining, gap);
    position = {
      x: position.x + ((waypoint.x - position.x) / gap) * step,
      z: position.z + ((waypoint.z - position.z) / gap) * step,
    };
    walkPhase += step * strideRadiansPerMeter;
    remaining -= step;
    if (step === gap) {
      path = rest;
    }
  }

  if (path.length === 0) {
    yaw = turnToward(yaw, stations[target].facing, deltaSeconds);
  }

  return { position, yaw, target, path, walkPhase };
}

export function actorActivity(state: ActorState): ActorActivity {
  if (state.path.length > 0) {
    return { kind: "walk", phase: state.walkPhase };
  }
  return { kind: "station", activity: stations[state.target].activity };
}
