import { navGrid } from "./office-nav.js";
import { type Point, stations } from "./office-plan.js";

/**
 * Mochi, the office cat: an orange tabby who lives in the office and goes about her own day.
 * She naps on the beanbag, watches the fish, sits in the sun by the windows, begs at the fridge
 * when someone is snacking, drops by someone's chair, and sleeps through the night when everyone
 * has gone home. This module only decides where she goes and what she does there; the stage
 * walks her and the cat model shows it.
 */
export const catName = "Mochi";

export type CatPose = "walk" | "sit" | "loaf" | "sleep" | "groom" | "stare" | "beg";

export type CatSpotId =
  | "beanbag"
  | "aquarium"
  | "sunny-floor"
  | "fridge"
  | "lounge-rug"
  | "collab-rug"
  | "game-bench"
  | "door-mat"
  | "visit";

export interface CatSpot {
  /** Where she settles, on the floor or up on something soft. */
  spot: Point;
  /** How high off the floor she sits there: the beanbag's cushion, or 0 on the floor. */
  height: number;
  /** Where she walks to before stepping (or hopping) onto the spot. */
  approach: Point;
  /** Which way she faces once there: toward the fish, the fridge door, the room. */
  facing: number;
}

const floor = (x: number, z: number): Point => navGrid.nearestFree({ x, z });

function onFloor(x: number, z: number, facing: number): CatSpot {
  const spot = floor(x, z);
  return { spot, height: 0, approach: spot, facing };
}

const beanbag = stations["beanbag-lounge"];
const fridge = stations.fridge;
const aquarium = stations.aquarium;

/** The fixed places she likes. "visit" is worked out at the time, next to whoever she visits. */
export const catSpots: Record<Exclude<CatSpotId, "visit">, CatSpot> = {
  // Curled up on the front of the cushion, clear of the backrest a sitter leans on.
  beanbag: {
    spot: {
      x: beanbag.spot.x + Math.sin(beanbag.facing) * 0.12,
      z: beanbag.spot.z + Math.cos(beanbag.facing) * 0.12,
    },
    height: 0.17,
    approach: beanbag.approach,
    facing: beanbag.facing,
  },
  // A little to the side of whoever stands there watching too, nose to the glass.
  aquarium: onFloor(aquarium.spot.x + 0.45, aquarium.spot.z, aquarium.facing),
  // The patch of floor under the windows that the sun reaches.
  "sunny-floor": onFloor(-3.3, -3.55, Math.PI),
  fridge: onFloor(fridge.spot.x + 0.4, fridge.spot.z + 0.15, fridge.facing),
  "lounge-rug": onFloor(-5.2, 1.4, Math.PI / 2),
  "collab-rug": onFloor(5.05, -0.55, -Math.PI / 2),
  "game-bench": onFloor(6.2, -1.05, Math.PI),
  "door-mat": onFloor(9.55, 0.35, -Math.PI / 2),
};

export interface CatPlan {
  spot: CatSpotId;
  pose: Exclude<CatPose, "walk">;
  durationMs: number;
}

interface Habit {
  spot: CatSpotId;
  pose: Exclude<CatPose, "walk">;
  seconds: readonly [number, number];
  /** How much she likes it, by part of the day. */
  weight: (hours: number) => number;
}

const night = (hours: number): boolean => hours < 7 || hours >= 19;
const sunny = (hours: number): boolean => hours >= 9 && hours < 15;

const habits: readonly Habit[] = [
  // A cat sleeps most of the day, and all night once the office is quiet.
  { spot: "beanbag", pose: "sleep", seconds: [180, 480], weight: (h) => (night(h) ? 12 : 3) },
  { spot: "aquarium", pose: "stare", seconds: [40, 90], weight: (h) => (night(h) ? 0.3 : 2) },
  { spot: "sunny-floor", pose: "loaf", seconds: [90, 240], weight: (h) => (sunny(h) ? 3 : 0.2) },
  { spot: "fridge", pose: "beg", seconds: [20, 40], weight: (h) => (night(h) ? 0 : 0.6) },
  { spot: "lounge-rug", pose: "groom", seconds: [30, 60], weight: (h) => (night(h) ? 0.5 : 1.2) },
  { spot: "collab-rug", pose: "loaf", seconds: [60, 150], weight: (h) => (night(h) ? 0.3 : 1) },
  { spot: "game-bench", pose: "sit", seconds: [30, 70], weight: (h) => (night(h) ? 0.2 : 0.8) },
  { spot: "door-mat", pose: "sit", seconds: [25, 50], weight: (h) => (night(h) ? 0.2 : 0.5) },
  { spot: "visit", pose: "sit", seconds: [25, 50], weight: (h) => (night(h) ? 0 : 1.5) },
];

/** Someone snacking at the fridge makes her much more likely to come and beg. */
const snackPull = 8;

/**
 * What Mochi does next: never the same spot twice in a row, weighted by the hour (`hours`, in
 * Jakarta hours) and by what is going on. `unavailable` lists spots she cannot use now: the
 * beanbag with someone on it, a visit with nobody at their desk.
 */
export function nextCatPlan(
  previous: CatSpotId | null,
  hours: number,
  random: () => number,
  context: { snacking: boolean; unavailable: ReadonlySet<CatSpotId> },
): CatPlan {
  const weighted = habits.map((habit) => {
    // At night she just sleeps on; by day she never stays in one place twice in a row.
    const sleepsOn = habit.spot === "beanbag" && night(hours);
    if ((habit.spot === previous && !sleepsOn) || context.unavailable.has(habit.spot)) {
      return 0;
    }
    const base = habit.weight(hours);
    return habit.spot === "fridge" && context.snacking ? base + snackPull : base;
  });
  const total = weighted.reduce((sum, weight) => sum + weight, 0);
  let roll = random() * total;
  let picked = habits[0] as Habit;
  for (const [index, habit] of habits.entries()) {
    const weight = weighted[index] ?? 0;
    roll -= weight;
    if (weight > 0 && roll < 0) {
      picked = habit;
      break;
    }
  }
  const [shortest, longest] = picked.seconds;
  return { spot: picked.spot, pose: picked.pose, durationMs: (shortest + random() * (longest - shortest)) * 1000 };
}

/** Things she says. Only ever "meong" in some form: she is a cat. */
export const catLines = {
  greeted: ["Meong.", "Mrrp?", "Meong!"],
  begging: ["Meooong...", "Meong meong."],
  petted: ["Prrr...", "Prrrrr."],
} as const;

export function catLine(kind: keyof typeof catLines, random: () => number): string {
  const lines = catLines[kind];
  return lines[Math.floor(random() * lines.length) % lines.length] ?? "Meong.";
}

/** What teammates say to her as they walk past. */
export const greetingsForCat = ["Halo, Mochi.", "Mochi!", "Eh, Mochi.", "Pus, pus."] as const;

/** Her pace: an unhurried trot, a little slower than the chibis walk. */
export const catSpeed = 0.45;
/** Stride radians per meter, for the legs. */
const catStride = 26;
const catTurnRate = 7;

/** Where she goes next and what she will do there; the stage works out a visit's spot. */
export interface CatChoice {
  plan: CatPlan;
  target: CatSpot;
}

function angleTo(from: Point, to: Point): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

function turnToward(yaw: number, goal: number, step: number): number {
  const delta = Math.atan2(Math.sin(goal - yaw), Math.cos(goal - yaw));
  return yaw + delta * Math.min(1, step);
}

/**
 * Mochi moving about: picks the next plan when the last one is done, walks the floor grid to it
 * (hopping up onto the beanbag at the end, and down again when she leaves), and settles facing the
 * spot's way. `hold` keeps her still, as while she is being stroked.
 */
export class Cat {
  position: Point;
  height: number;
  yaw: number;
  walkPhase = 0;
  private plan: CatPlan | null = null;
  private target: CatSpot;
  private last: CatSpotId | null;
  private path: Point[] = [];
  private arrived: number | null = null;

  constructor(start: CatSpotId & keyof typeof catSpots = "beanbag") {
    this.target = catSpots[start];
    this.position = { ...this.target.spot };
    this.height = this.target.height;
    this.yaw = this.target.facing;
    this.last = start;
    // She starts the day where she slept, still asleep for a bit.
    this.plan = { spot: start, pose: "sleep", durationMs: 45_000 };
  }

  /** What she is doing now (walking, or the plan's pose once there). */
  get pose(): CatPose {
    return this.path.length > 0 ? "walk" : (this.plan?.pose ?? "sleep");
  }

  get spotId(): CatSpotId | null {
    return this.plan?.spot ?? this.last;
  }

  /** When she got where she was going, in the caller's clock, or null while still on the way. */
  get arrivedAt(): number | null {
    return this.arrived;
  }

  /** Up on (or headed for) the beanbag, so nobody sits on her. */
  get onBeanbag(): boolean {
    return this.spotId === "beanbag" && (this.arrived !== null || distanceTo(this.position, catSpots.beanbag.spot) < 1);
  }

  update(
    delta: number,
    now: number,
    choose: (previous: CatSpotId | null) => CatChoice,
    hold: boolean,
    face: number | null,
  ): CatPose {
    if (this.plan === null || (this.arrived !== null && now - this.arrived >= this.plan.durationMs)) {
      const next = choose(this.spotId);
      const stays = this.arrived !== null && next.plan.spot === this.spotId;
      this.last = this.spotId;
      this.plan = next.plan;
      // Sleeping on where she already is: no getting up and lying down again.
      if (stays) {
        this.arrived = now;
      } else {
        this.target = next.target;
        this.arrived = null;
        this.path = this.route(next.target);
      }
    }
    if (hold) {
      this.yaw = face === null ? this.yaw : turnToward(this.yaw, face, catTurnRate * delta);
      return this.path.length > 0 ? "sit" : this.pose;
    }
    const next = this.path[0];
    if (next === undefined) {
      if (this.arrived === null) {
        this.arrived = now;
      }
      this.yaw = turnToward(this.yaw, face ?? this.target.facing, catTurnRate * delta * 0.5);
      return this.pose;
    }
    const step = catSpeed * delta;
    const away = distanceTo(this.position, next);
    const finalHop = this.path.length === 1 && this.target.height > 0;
    if (away <= step) {
      this.position = { ...next };
      this.path.shift();
    } else {
      this.position = {
        x: this.position.x + ((next.x - this.position.x) / away) * step,
        z: this.position.z + ((next.z - this.position.z) / away) * step,
      };
    }
    // Hop up onto a cushion over the last stretch; off one, she drops to the floor at once.
    if (finalHop) {
      const leg = distanceTo(this.target.approach, this.target.spot);
      const left = distanceTo(this.position, this.target.spot);
      this.height = this.target.height * (leg > 0 ? 1 - Math.min(1, left / leg) : 1);
    } else {
      this.height = Math.max(0, this.height - delta * 1.5);
    }
    this.walkPhase += step * catStride;
    this.yaw = turnToward(this.yaw, angleTo(this.position, next), catTurnRate * delta);
    return "walk";
  }

  private route(target: CatSpot): Point[] {
    const from = navGrid.isFree(this.position) ? this.position : navGrid.nearestFree(this.position);
    const goal = navGrid.isFree(target.approach) ? target.approach : navGrid.nearestFree(target.approach);
    const walk = navGrid.findPath(from, goal) ?? [goal];
    const path = [...(from === this.position ? [] : [from]), ...walk];
    if (distanceTo(goal, target.spot) > 0.02) {
      path.push(target.spot);
    }
    return path;
  }
}

function distanceTo(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
