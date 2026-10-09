import type { MemberId } from "../../shared/team.js";

export interface Point {
  x: number;
  z: number;
}

/**
 * Room: floor spans x -5..5 and z -4..3.5. The back wall is at z = -4 and the
 * left wall at x = -5. The isometric camera looks from +x/+z, so both walls face it.
 */
export const room = { minX: -5, maxX: 5, minZ: -4, maxZ: 3.5, wallHeight: 2.3 } as const;

/** Yaw that faces the isometric camera, which sits on the +x/+z diagonal. */
export const facingCamera = Math.PI / 4;

/**
 * Walkways. H runs left to right in front of the desk row, V runs front to
 * back along the left wall boards. They meet at `laneCorner`.
 */
const laneH = { z: -0.9, minX: -3.5, maxX: 4.5 };
const laneV = { x: -3.5, minZ: -2.9, maxZ: 3.0 };
export const laneCorner: Point = { x: laneV.x, z: laneH.z };

type Lane = "H" | "V";

export type StationId =
  | "desk-asuna"
  | "desk-kobayashi"
  | "desk-fubuki"
  | "desk-erza"
  | "board-robin"
  | "board-xenovia"
  | "idea-board"
  | "desk-xenovia"
  | "sofa"
  | "front";

export interface Station {
  id: StationId;
  /** Where the character stands or sits, in world meters. */
  spot: Point;
  /** Yaw in radians: 0 faces +Z, PI faces the back wall, -PI/2 faces the left wall. */
  facing: number;
  /** Point on a walkway where the character leaves or joins the lanes. */
  approach: Point;
  lane: Lane;
  seated: boolean;
}

/** Close enough to the desk and boards that chibi arms (about 0.3 m) reach the keyboard and the board. */
const deskSeatZ = -2.95;
const boardSpotX = -4.62;

function deskStation(id: StationId, x: number): Station {
  return { id, spot: { x, z: deskSeatZ }, facing: Math.PI, approach: { x, z: laneH.z }, lane: "H", seated: true };
}

function wallStation(id: StationId, z: number, seated = false): Station {
  return {
    id,
    spot: { x: id === "sofa" ? -4.55 : boardSpotX, z },
    facing: id === "sofa" ? Math.PI / 2 : -Math.PI / 2,
    approach: { x: laneV.x, z },
    lane: "V",
    seated,
  };
}

export const deskXs = { asuna: -3, kobayashi: -1, fubuki: 1, erza: 3 } as const;

export const stations: Record<StationId, Station> = {
  "desk-asuna": deskStation("desk-asuna", deskXs.asuna),
  "desk-kobayashi": deskStation("desk-kobayashi", deskXs.kobayashi),
  "desk-fubuki": deskStation("desk-fubuki", deskXs.fubuki),
  "desk-erza": deskStation("desk-erza", deskXs.erza),
  "board-robin": wallStation("board-robin", -2.2),
  "board-xenovia": wallStation("board-xenovia", -1.0),
  "idea-board": wallStation("idea-board", 1.0),
  sofa: wallStation("sofa", 2.7, true),
  "desk-xenovia": {
    id: "desk-xenovia",
    spot: { x: 2.2, z: 1.15 },
    facing: 0,
    approach: { x: 2.2, z: laneH.z },
    lane: "H",
    seated: true,
  },
  front: {
    id: "front",
    spot: { x: 0.9, z: 2.4 },
    facing: facingCamera,
    approach: { x: 0.9, z: laneH.z },
    lane: "H",
    seated: false,
  },
};

/** Home station of every member who does not walk around. Xenovia moves with her mood instead. */
export const homeStations: Record<Exclude<MemberId, "xenovia">, StationId> = {
  chizuru: "idea-board",
  robin: "board-robin",
  asuna: "desk-asuna",
  kobayashi: "desk-kobayashi",
  fubuki: "desk-fubuki",
  erza: "desk-erza",
};

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function nearestLanePoint(point: Point): { point: Point; lane: Lane } {
  const onH = { x: clamp(point.x, laneH.minX, laneH.maxX), z: laneH.z };
  const onV = { x: laneV.x, z: clamp(point.z, laneV.minZ, laneV.maxZ) };
  return distance(point, onH) <= distance(point, onV) ? { point: onH, lane: "H" } : { point: onV, lane: "V" };
}

/**
 * Waypoints from `from` to the station spot: step onto the nearest walkway,
 * follow the walkways (turning at the corner if needed), then step off at the
 * station. Keeps every route clear of desks and boards.
 */
export function planPath(from: Point, to: StationId): Point[] {
  const target = stations[to];
  if (distance(from, target.spot) < 0.05) {
    return [];
  }
  const entry = nearestLanePoint(from);
  const route: Point[] = [entry.point];
  if (entry.lane !== target.lane) {
    route.push(laneCorner);
  }
  route.push(target.approach, target.spot);

  // Drop waypoints that sit on top of each other so the walker never stalls.
  const path: Point[] = [];
  let previous = from;
  for (const point of route) {
    if (distance(previous, point) > 0.05) {
      path.push(point);
      previous = point;
    }
  }
  return path;
}
