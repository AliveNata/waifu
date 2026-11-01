import type { DeskItem } from "./desk-habits.js";

/**
 * What Alyx can do with E in first person, and how the one he means is found: whichever target is
 * closest to the aim dot on screen, within arm's reach (or a step, for seats and the ping-pong
 * table), and not behind him.
 */
export interface AlyxTarget {
  /** "member:erza", "item:erza:stamp", "tv", "seat:sofa-1" and so on; the stage acts on it. */
  id: string;
  /** What E does, shown after the key: "Sapa Erza", "Ambil stempel". */
  label: string;
  point: { x: number; y: number; z: number };
  /** Farthest away it can be used from, in meters. */
  reach: number;
}

/** Where a point lands on screen relative to the aim dot, in CSS pixels, and if it is in front. */
export interface Projected {
  dx: number;
  dy: number;
  inFront: boolean;
}

/** How far from the aim dot a target may be on screen and still be the one he means. */
export const aimRadiusPx = 90;

export function pickTarget(
  targets: readonly AlyxTarget[],
  eye: { x: number; y: number; z: number },
  project: (point: AlyxTarget["point"]) => Projected,
): AlyxTarget | null {
  let best: { target: AlyxTarget; score: number } | null = null;
  for (const target of targets) {
    const away = Math.hypot(target.point.x - eye.x, target.point.y - eye.y, target.point.z - eye.z);
    if (away > target.reach) {
      continue;
    }
    const { dx, dy, inFront } = project(target.point);
    const off = Math.hypot(dx, dy);
    if (!inFront || off > aimRadiusPx) {
      continue;
    }
    // Mostly how close to the dot; between two at the same spot on screen, the nearer one.
    const score = off + away * 10;
    if (best === null || score < best.score) {
      best = { target, score };
    }
  }
  return best?.target ?? null;
}

/**
 * The desk things he can pick up, named as people in the office would. Things fixed in place or
 * part of a bit with something else (the security key in its hub, the fork by the cake, the chess
 * piece on its board) are left out.
 */
export const pickableItems: Partial<Record<DeskItem, string>> = {
  planner: "planner",
  duck: "bebek karet",
  console: "konsol",
  plush: "boneka naga",
  rose: "mawar",
  marker: "spidol",
  clipboard: "clipboard",
  hourglass: "jam pasir",
  pen: "pena",
  book: "buku",
  padlock: "gembok",
  swatch: "kipas swatch",
  stamp: "stempel",
  "test-phone": "HP testing",
  printout: "print grafik",
};
