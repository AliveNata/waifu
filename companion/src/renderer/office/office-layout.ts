import type { Mood } from "../../shared/reaction.js";

export interface Point {
  x: number;
  z: number;
}

export type StationId = "desk" | "whiteboard" | "sofa" | "front";
export type StationActivity = "sit-type" | "stand-board" | "sit-relax" | "stand-front";

export interface Station {
  id: StationId;
  /** Where the character stands or sits, in world meters. */
  spot: Point;
  /** Yaw in radians: 0 faces +Z (toward the camera side), PI faces the back wall. */
  facing: number;
  activity: StationActivity;
}

/**
 * Room: floor spans x -3..3 and z -2.5..2.5. The back wall is at z = -2.5, the
 * left wall at x = -3. The isometric camera looks from +x/+z, so both walls face it.
 */
export const room = { minX: -3, maxX: 3, minZ: -2.5, maxZ: 2.5, wallHeight: 2.2 } as const;

/** Yaw that faces the isometric camera, which sits on the +x/+z diagonal. */
export const facingCamera = Math.PI / 4;

export const stations: Record<StationId, Station> = {
  desk: { id: "desk", spot: { x: -1.5, z: -1.25 }, facing: Math.PI, activity: "sit-type" },
  whiteboard: { id: "whiteboard", spot: { x: -2.2, z: 0.6 }, facing: -Math.PI / 2, activity: "stand-board" },
  sofa: { id: "sofa", spot: { x: 1.6, z: -1.8 }, facing: 0, activity: "sit-relax" },
  front: { id: "front", spot: { x: 0.6, z: 1.0 }, facing: facingCamera, activity: "stand-front" },
};

/** Furniture-free crossing point. Every trip passes through it so paths never cut through the desk or sofa. */
export const hub: Point = { x: 0, z: 0.1 };

const moodStations: Record<Mood, StationId> = {
  idle: "sofa",
  greeting: "front",
  thinking: "whiteboard",
  working: "desk",
  waiting: "front",
  done: "front",
};

export function stationForMood(mood: Mood): StationId {
  return moodStations[mood];
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * Waypoints from `from` to the station spot. Goes through the hub unless the
 * character is already close to it, which keeps routes readable and clear of furniture.
 */
export function planPath(from: Point, to: StationId): Point[] {
  const target = stations[to].spot;
  if (distance(from, hub) < 0.3) {
    return [target];
  }
  return [hub, target];
}
