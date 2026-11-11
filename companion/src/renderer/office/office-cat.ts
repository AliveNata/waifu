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

export type CatPose = "walk" | "sit" | "loaf" | "sleep" | "groom" | "stare" | "beg" | "eat";

export type CatSpotId =
  | "beanbag"
  | "aquarium"
  | "sunny-floor"
  | "fridge"
  | "lounge-rug"
  | "collab-rug"
  | "game-bench"
  | "door-mat"
  | "visit"
  | "bowl"
  | "pingpong"
  | "keyboard";

export interface CatSpot {
  /** Where she settles, on the floor or up on something soft. */
  spot: Point;
  /** How high off the floor she sits there: the beanbag's cushion, or 0 on the floor. */
  height: number;
  /** Where she walks to before stepping (or hopping) onto the spot. */
  approach: Point;
  /** Which way she faces once there: toward the fish, the fridge door, the room. */
  facing: number;
  /**
   * Up on furniture: points after the approach with how high each is, walked in order before the
   * spot. A desk is reached by hopping onto its low L-desk leg first, then along the top.
   */
  perch?: readonly { x: number; z: number; height: number }[];
}

const floor = (x: number, z: number): Point => navGrid.nearestFree({ x, z });

function onFloor(x: number, z: number, facing: number): CatSpot {
  const spot = floor(x, z);
  return { spot, height: 0, approach: spot, facing };
}

const beanbag = stations["beanbag-lounge"];
const fridge = stations.fridge;
const aquarium = stations.aquarium;

const pingpong = stations["pingpong-west"];

/**
 * Her food bowl on the floor in the pocket between the bar's far end and Kobayashi's desk,
 * against the back wall: a few steps from the fridge, and nobody walks through it.
 */
export const bowlSpot = floor(-3.38, -4.82);

/**
 * The fixed places she likes. "visit" and "keyboard" are worked out at the time, next to (or on
 * the keyboard of) whoever she drops in on.
 */
/** On the floor at the beanbag's edge, on her way in from the approach. */
function beanbagEdge(): { x: number; z: number; height: number } {
  const dx = beanbag.approach.x - beanbag.spot.x;
  const dz = beanbag.approach.z - beanbag.spot.z;
  const length = Math.hypot(dx, dz) || 1;
  return { x: beanbag.spot.x + (dx / length) * 0.45, z: beanbag.spot.z + (dz / length) * 0.45, height: 0 };
}

export const catSpots: Record<Exclude<CatSpotId, "visit" | "keyboard">, CatSpot> = {
  // Curled up on the front of the cushion, clear of the backrest a sitter leans on.
  beanbag: {
    spot: {
      x: beanbag.spot.x + Math.sin(beanbag.facing) * 0.12,
      z: beanbag.spot.z + Math.cos(beanbag.facing) * 0.12,
    },
    height: 0.17,
    approach: beanbag.approach,
    facing: beanbag.facing,
    // Up close on the floor first, so the hop onto the cushion is a short one.
    perch: [beanbagEdge()],
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
  // Just behind the bowl, facing it, so her head goes down into it.
  bowl: {
    spot: floor(bowlSpot.x, bowlSpot.z + 0.2),
    height: 0,
    approach: floor(bowlSpot.x, bowlSpot.z + 0.2),
    facing: Math.PI,
  },
  // Beside the ping-pong table on the side away from the bench, watching the ball go back and forth.
  pingpong: onFloor(pingpong.spot.x + 1.1, pingpong.spot.z - 0.85, 0),
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
  { spot: "pingpong", pose: "stare", seconds: [25, 50], weight: () => 6 },
  // Asleep on someone's keyboard until they lift her off; the stage ends this one, not the clock.
  { spot: "keyboard", pose: "sleep", seconds: [10, 16], weight: (h) => (night(h) ? 0 : 0.8) },
];

/** Someone snacking at the fridge makes her much more likely to come and beg. */
const snackPull = 8;

/** What is going on around her that changes what she feels like doing. */
export interface CatContext {
  snacking: boolean;
  unavailable: ReadonlySet<CatSpotId>;
  /** Hungry enough to go to the bowl. */
  hungry: boolean;
  /** How full the bowl is, 0 empty to 1 full. */
  bowlFood: number;
  /** A ping-pong rally is on. */
  rally: boolean;
}

/** One trip to the bowl empties about a third of it. */
export const mealSize = 0.34;
/** From fed to hungry again, in seconds of the office clock. */
export const hungerSeconds = 45 * 60;

/** The bowl after she has eaten: one meal less, never below empty. */
export function afterMeal(food: number): number {
  return Math.max(0, food - mealSize);
}

/**
 * What Mochi does next: never the same spot twice in a row, weighted by the hour (`hours`, in
 * Jakarta hours) and by what is going on. `unavailable` lists spots she cannot use now: the
 * beanbag with someone on it, a visit with nobody at their desk.
 */
export function nextCatPlan(
  previous: CatSpotId | null,
  hours: number,
  random: () => number,
  context: CatContext,
): CatPlan {
  // Hunger comes first: to the bowl to eat, or to sit by an empty one and ask.
  if (context.hungry && previous !== "bowl" && !context.unavailable.has("bowl")) {
    const eating = context.bowlFood > 0;
    const pull = eating ? 0.9 : 0.6;
    if (random() < pull) {
      const [shortest, longest] = eating ? [15, 25] : [20, 35];
      return {
        spot: "bowl",
        pose: eating ? "eat" : "beg",
        durationMs: (shortest + random() * (longest - shortest)) * 1000,
      };
    }
  }
  const weighted = habits.map((habit) => {
    // At night she just sleeps on; by day she never stays in one place twice in a row.
    const sleepsOn = habit.spot === "beanbag" && night(hours);
    if ((habit.spot === previous && !sleepsOn) || context.unavailable.has(habit.spot)) {
      return 0;
    }
    if (habit.spot === "pingpong") {
      // Only worth watching while the ball is in play.
      return context.rally ? habit.weight(hours) : 0;
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
  lifted: ["Mrrp!", "Meong..."],
} as const;

/** What someone says lifting her off their keyboard. */
export const keyboardLines = [
  "Mochi, aku lagi kerja...",
  "Eh, ini keyboard, bukan kasur.",
  "Turun dulu ya, Mochi.",
] as const;
/** What a teammate says filling her bowl. */
export const refillLines = ["Nih, Mochi, makan dulu.", "Mangkoknya udah kosong, ya."] as const;

export function catLine(kind: keyof typeof catLines, random: () => number): string {
  const lines = catLines[kind];
  return lines[Math.floor(random() * lines.length) % lines.length] ?? "Meong.";
}

/** What teammates say to her as they walk past. */
export const greetingsForCat = ["Halo, Mochi.", "Mochi!", "Eh, Mochi.", "Pus, pus."] as const;

/** Her pace: an unhurried trot, a little slower than the team walks. */
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
  private path: { x: number; z: number; height: number }[] = [];
  /** Where the current stretch of the path began, so the height can follow it. */
  private legStart = { x: 0, z: 0, height: 0 };
  private arrived: number | null = null;
  /** Lifted and carried by someone: the stage moves her and nothing else does. */
  private carried = false;

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

  /** How long the current plan lasts once she is there, in milliseconds. */
  get planDurationMs(): number | null {
    return this.plan?.durationMs ?? null;
  }

  get spotId(): CatSpotId | null {
    return this.plan?.spot ?? this.last;
  }

  /** When she got where she was going, in the caller's clock, or null while still on the way. */
  get arrivedAt(): number | null {
    return this.arrived;
  }

  /** Someone has her: she goes where she is put until she is set down. */
  carry(position: Point, height: number, yaw: number): void {
    this.carried = true;
    this.path = [];
    this.position = { ...position };
    this.height = height;
    this.yaw = yaw;
  }

  /** Set down on the floor: whatever she was doing is over, and she picks something new. */
  land(position: Point): void {
    this.carried = false;
    this.position = { ...position };
    this.height = 0;
    this.last = this.spotId;
    this.plan = null;
    this.arrived = null;
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
    if (this.carried) {
      return this.plan?.pose ?? "sleep";
    }
    // A keyboard nap ends when someone lifts her off, not on the clock.
    const timeUp =
      this.arrived !== null &&
      this.plan !== null &&
      this.plan.spot !== "keyboard" &&
      now - this.arrived >= this.plan.durationMs;
    if (this.plan === null || timeUp) {
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
        this.legStart = { ...this.position, height: this.height };
      }
    }
    const next = this.path[0];
    // Mid-hop she lands first: held there she would hang in the air or sit half inside a cushion.
    const hopping = next !== undefined && next.height !== this.legStart.height;
    if (hold && !hopping) {
      this.yaw = face === null ? this.yaw : turnToward(this.yaw, face, catTurnRate * delta);
      return this.path.length > 0 ? "sit" : this.pose;
    }
    if (next === undefined) {
      if (this.arrived === null) {
        this.arrived = now;
      }
      this.yaw = turnToward(this.yaw, face ?? this.target.facing, catTurnRate * delta * 0.5);
      return this.pose;
    }
    const step = catSpeed * delta;
    const away = distanceTo(this.position, next);
    if (away <= step) {
      this.position = { x: next.x, z: next.z };
      this.height = next.height;
      this.path.shift();
      this.legStart = { ...next };
    } else {
      this.position = {
        x: this.position.x + ((next.x - this.position.x) / away) * step,
        z: this.position.z + ((next.z - this.position.z) / away) * step,
      };
      // Up or down along the stretch: a hop onto a cushion or a desk, or down off one.
      const leg = distanceTo(this.legStart, next);
      const done = leg > 0 ? 1 - distanceTo(this.position, next) / leg : 1;
      this.height = hopHeight(this.legStart.height, next.height, done);
    }
    this.walkPhase += step * catStride;
    this.yaw = turnToward(this.yaw, angleTo(this.position, next), catTurnRate * delta);
    return "walk";
  }

  private route(target: CatSpot): { x: number; z: number; height: number }[] {
    const from = navGrid.isFree(this.position) ? this.position : navGrid.nearestFree(this.position);
    const goal = navGrid.isFree(target.approach) ? target.approach : navGrid.nearestFree(target.approach);
    const walk = navGrid.findPath(from, goal) ?? [goal];
    // Down to the floor first if she is up on something, then along the floor at height 0.
    const path = [...(from === this.position ? [] : [from]), ...walk].map((point) => ({ ...point, height: 0 }));
    path.push(...(target.perch ?? []));
    const last = path[path.length - 1] ?? { ...goal, height: 0 };
    if (distanceTo(last, target.spot) > 0.02 || last.height !== target.height) {
      path.push({ ...target.spot, height: target.height });
    }
    return path;
  }
}

/**
 * Height along a stretch from `from` to `to`, `done` of the way across. A change of height is a
 * hop that clears the edge of what she jumps onto, not a ramp through the cushion.
 */
export function hopHeight(from: number, to: number, done: number): number {
  const t = Math.min(1, Math.max(0, done));
  const arc = Math.abs(to - from) > 0.05 ? 0.12 * 4 * t * (1 - t) : 0;
  return from + (to - from) * t + arc;
}

/** How high she is lifted over the keys while being carried aside, in meters. */
const liftClearance = 0.1;

/**
 * Where Mochi is, `done` of the way through being lifted off a keyboard by its owner and set down
 * on the floor at `to`, beside their chair. `facing` is the way she faces on the keys, toward the
 * chair. A straight line from the keys to the chair's side passes through the lap of whoever sits
 * there, so she is carried in two moves, as someone would: first up a little and sideways over the
 * desk, then toward the chair's side and down, clearing the desk's edge before she drops.
 */
export function keyboardLiftPath(
  from: Point & { height: number },
  to: Point,
  facing: number,
  done: number,
): Point & { height: number } {
  const k = Math.min(1, Math.max(0, done));
  const ahead = { x: Math.sin(facing), z: Math.cos(facing) };
  const along = (to.x - from.x) * ahead.x + (to.z - from.z) * ahead.z;
  const across = { x: to.x - from.x - along * ahead.x, z: to.z - from.z - along * ahead.z };
  const top = from.height + liftClearance;
  if (k < 0.5) {
    const a = smooth(k / 0.5);
    return {
      x: from.x + across.x * a,
      z: from.z + across.z * a,
      height: from.height + liftClearance * Math.sin((Math.PI / 2) * a),
    };
  }
  // Down slowly at first, so she is still above the desk as she passes over its front edge.
  const b = (k - 0.5) / 0.5;
  const toward = smooth(b);
  return {
    x: from.x + across.x + ahead.x * along * toward,
    z: from.z + across.z + ahead.z * along * toward,
    height: top * (1 - b * b),
  };
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function distanceTo(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
