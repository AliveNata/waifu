import type { MemberId } from "../../shared/team.js";
import type { ExpressionWeights } from "../common/expressions.js";
import type { HandPropKind } from "./office-director.js";

/** Something a member does with the things on their own desk while taking it easy there. */
export type DeskBit =
  | "kanban-check"
  | "planner"
  | "monitor-check"
  | "duck"
  | "console"
  | "plush-hug"
  | "cake"
  | "rose"
  | "mic"
  | "desk-selfie"
  | "tea"
  | "chess"
  | "sticky"
  | "idea-pop";

/** Things on a desk that a bit picks up or moves. The stage hides them while they are in a hand. */
export type DeskItem = "planner" | "duck" | "console" | "plush" | "fork" | "rose" | "teacup" | "chess-piece" | "marker";

export type DeskHand = "left" | "right";

interface BitSpec {
  duration: number;
  /** What gets picked up from the desk, or null for a bit done with what is already in view. */
  item: DeskItem | null;
  /** What shows in the hand while the item is held. A phone comes out of a pocket, so it needs no item. */
  prop: HandPropKind | null;
  /** The hand nearer the item: things on the left of the desk are picked up with the left hand. */
  hand: DeskHand;
}

const bitSpecs: Record<DeskBit, BitSpec> = {
  "kanban-check": { duration: 4, item: null, prop: null, hand: "right" },
  planner: { duration: 6, item: "planner", prop: "book", hand: "left" },
  "monitor-check": { duration: 4, item: null, prop: null, hand: "right" },
  duck: { duration: 5, item: "duck", prop: "duck", hand: "left" },
  console: { duration: 7, item: "console", prop: "console", hand: "right" },
  "plush-hug": { duration: 5, item: "plush", prop: "plush", hand: "left" },
  cake: { duration: 6, item: "fork", prop: "fork", hand: "left" },
  rose: { duration: 5, item: "rose", prop: "rose", hand: "left" },
  mic: { duration: 6, item: null, prop: null, hand: "left" },
  "desk-selfie": { duration: 5, item: null, prop: "phone", hand: "right" },
  tea: { duration: 6, item: "teacup", prop: "teacup", hand: "right" },
  chess: { duration: 4, item: "chess-piece", prop: null, hand: "left" },
  sticky: { duration: 6, item: "marker", prop: "marker", hand: "right" },
  "idea-pop": { duration: 3, item: null, prop: null, hand: "right" },
};

/** Each member's bits, from what is on their desk and who they are. */
export const deskBits: Record<MemberId, readonly DeskBit[]> = {
  twob: ["kanban-check", "planner"],
  chizuru: ["sticky", "idea-pop"],
  rias: ["tea", "chess"],
  asuna: ["monitor-check", "duck"],
  kobayashi: ["console", "plush-hug"],
  yor: ["rose"],
  erza: ["cake"],
  ruby: ["mic", "desk-selfie"],
};

/** Seconds to reach out and take an item, and the same again at the end to put it back. */
export const reachSeconds = 0.8;
/** For a chess move: after the reach, the piece is carried over to its new square in this long. */
export const chessCarrySeconds = 1;

export interface ActiveDeskBit {
  kind: DeskBit;
  elapsed: number;
  duration: number;
  /** When it began, so the stage can tell one run of a bit from the next. */
  startedAt: number;
}

export function deskBitSpec(kind: DeskBit): Readonly<BitSpec> {
  return bitSpecs[kind];
}

/** True while the hand goes out to the item at the start, or back to put it down at the end. */
export function reachingForItem(bit: ActiveDeskBit): boolean {
  const { item } = bitSpecs[bit.kind];
  if (item === null) {
    return false;
  }
  if (bit.kind === "chess") {
    return bit.elapsed < reachSeconds + chessCarrySeconds;
  }
  return bit.elapsed < reachSeconds || bit.elapsed > bit.duration - reachSeconds;
}

/**
 * The item is off the desk and in the hand: from the end of the reach until the hand has carried
 * it back over its spot, halfway through the reach back.
 */
export function itemInHand(bit: ActiveDeskBit): boolean {
  if (bitSpecs[bit.kind].item === null || bit.kind === "chess") {
    return false;
  }
  return bit.elapsed >= reachSeconds && bit.elapsed <= bit.duration - reachSeconds / 2;
}

/** The prop to show in the bit's hand right now, if any. */
export function deskBitProp(bit: ActiveDeskBit): HandPropKind | null {
  const spec = bitSpecs[bit.kind];
  if (spec.prop === null) {
    return null;
  }
  if (spec.item === null) {
    // Out of the pocket and away again, at the same pace as picking something up.
    return bit.elapsed >= reachSeconds * 0.5 && bit.elapsed <= bit.duration - reachSeconds * 0.5 ? spec.prop : null;
  }
  return itemInHand(bit) ? spec.prop : null;
}

/** 0..1 eased in at the start and out at the end, for poses that settle into a bit and back. */
export function deskBitEnvelope(bit: ActiveDeskBit, fade = reachSeconds): number {
  const rise = Math.min(1, bit.elapsed / fade);
  const fall = Math.min(1, Math.max(0, (bit.duration - bit.elapsed) / fade));
  const k = Math.min(rise, fall);
  return k * k * (3 - 2 * k);
}

/** The chess piece's trip between its two squares, 0..1, with how high it is lifted. */
export function chessCarry(bit: ActiveDeskBit): { along: number; lift: number } {
  const t = Math.min(1, Math.max(0, (bit.elapsed - reachSeconds) / chessCarrySeconds));
  const along = t * t * (3 - 2 * t);
  return { along, lift: Math.sin(Math.PI * along) };
}

/** The face that goes with a bit, or null to keep the mood's own. `time` drives talking and bites. */
export function deskBitFace(bit: ActiveDeskBit, time: number): ExpressionWeights | null {
  const k = deskBitEnvelope(bit);
  switch (bit.kind) {
    case "plush-hug":
      return { happy: 0.85 * k };
    case "rose":
    case "tea":
      return { relaxed: 0.6 * k };
    case "cake":
      return { happy: 0.5 * k, aa: 0.35 * k * Math.max(0, Math.sin(time * 5)) };
    case "mic":
      return { aa: 0.5 * k * Math.abs(Math.sin(time * 10)) };
    case "desk-selfie":
      return { happy: 0.7 * k };
    case "console":
      return { happy: 0.3 * k };
    case "idea-pop":
      // Surprise at the idea first, then delight.
      return bit.elapsed < 0.9 ? { surprised: 0.8 * k } : { happy: 0.8 * k };
    default:
      return null;
  }
}

/**
 * Picks what a member does next at their desk, with quiet gaps between, never the same bit twice
 * in a row when they have more than one. Sitting down, they settle in for a moment first.
 * `random` is injectable for tests.
 */
export class DeskHabits {
  private current: ActiveDeskBit | null = null;
  private last: DeskBit | null = null;
  private nextAt: number | null = null;

  constructor(
    private readonly bits: readonly DeskBit[],
    private readonly random: () => number = Math.random,
  ) {}

  /** `atDesk`: idling at their own desk. Anything else ends the current bit at once. */
  update(now: number, atDesk: boolean): ActiveDeskBit | null {
    if (!atDesk) {
      this.current = null;
      this.nextAt = null;
      return null;
    }
    if (this.nextAt === null) {
      this.nextAt = now + 2 + this.random() * 4;
    }
    if (this.current !== null) {
      const elapsed = now - this.current.startedAt;
      if (elapsed < this.current.duration) {
        this.current = { ...this.current, elapsed };
        return this.current;
      }
      this.current = null;
      this.nextAt = now + this.gap();
    }
    if (now < this.nextAt) {
      return null;
    }
    const choices = this.bits.length > 1 ? this.bits.filter((bit) => bit !== this.last) : this.bits;
    const kind = choices[Math.floor(this.random() * choices.length) % Math.max(1, choices.length)];
    if (kind === undefined) {
      this.nextAt = now + this.gap();
      return null;
    }
    this.last = kind;
    this.current = { kind, elapsed: 0, duration: bitSpecs[kind].duration, startedAt: now };
    return this.current;
  }

  private gap(): number {
    return 6 + this.random() * 8;
  }
}
