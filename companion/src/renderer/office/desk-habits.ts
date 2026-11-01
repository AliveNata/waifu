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
  | "sip"
  | "chess"
  | "sticky"
  | "idea-pop"
  | "clipboard"
  | "hourglass"
  | "notes"
  | "desk-read"
  | "key-tap"
  | "padlock"
  | "sketch"
  | "swatch"
  | "calendar"
  | "stamp"
  | "safe"
  | "phone-test"
  | "moodboard"
  | "printout"
  | "pi-reseat";

/** Things on a desk that a bit picks up or moves. The stage hides them while they are in a hand. */
export type DeskItem =
  | "planner"
  | "duck"
  | "console"
  | "plush"
  | "fork"
  | "rose"
  | "mug"
  | "chess-piece"
  | "marker"
  | "clipboard"
  | "hourglass"
  | "pen"
  | "book"
  | "padlock"
  | "security-key"
  | "swatch"
  | "stamp"
  | "test-phone"
  | "printout";

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
  // Rias's mug is a teacup; the stage shows the cup each member actually has.
  sip: { duration: 6, item: "mug", prop: "mug", hand: "right" },
  chess: { duration: 4, item: "chess-piece", prop: null, hand: "left" },
  sticky: { duration: 6, item: "marker", prop: "marker", hand: "right" },
  "idea-pop": { duration: 3, item: null, prop: null, hand: "right" },
  clipboard: { duration: 6, item: "clipboard", prop: "clipboard", hand: "left" },
  hourglass: { duration: 5, item: "hourglass", prop: "hourglass", hand: "right" },
  notes: { duration: 7, item: "pen", prop: "pen", hand: "right" },
  "desk-read": { duration: 9, item: "book", prop: "book", hand: "left" },
  // Tapped where it sits in the hub, never picked up, so there is no item to take off the desk.
  "key-tap": { duration: 3, item: null, prop: null, hand: "left" },
  padlock: { duration: 5, item: "padlock", prop: "padlock", hand: "right" },
  sketch: { duration: 8, item: "pen", prop: "pen", hand: "right" },
  swatch: { duration: 5, item: "swatch", prop: "swatch", hand: "left" },
  // The things on the short leg of an L-desk, worked with the hand on that side: the right hand
  // on the back row and Erza's desk, the left on 2B's and Miruku's.
  calendar: { duration: 5.5, item: null, prop: null, hand: "left" },
  stamp: { duration: 7, item: "stamp", prop: "stamp", hand: "right" },
  safe: { duration: 8, item: null, prop: null, hand: "left" },
  "phone-test": { duration: 6, item: "test-phone", prop: "phone", hand: "right" },
  moodboard: { duration: 5.5, item: null, prop: null, hand: "right" },
  printout: { duration: 6, item: "printout", prop: "printout", hand: "right" },
  "pi-reseat": { duration: 6.5, item: null, prop: null, hand: "right" },
};

/** Each member's bits, from what is on their desk and who they are. */
export const deskBits: Record<MemberId, readonly DeskBit[]> = {
  twob: ["planner", "calendar", "sip"],
  chizuru: ["sticky", "idea-pop", "sip"],
  rias: ["sip", "chess"],
  asuna: ["monitor-check", "duck", "printout", "sip"],
  kobayashi: ["console", "plush-hug", "phone-test", "sip"],
  yor: ["rose", "pi-reseat", "sip"],
  erza: ["cake", "stamp", "sip"],
  ruby: ["mic", "desk-selfie", "sip"],
  arisu: ["kanban-check", "clipboard", "hourglass", "sip"],
  komachi: ["notes", "desk-read", "sip"],
  miruku: ["monitor-check", "key-tap", "padlock", "safe", "sip"],
  huagua: ["sketch", "swatch", "idea-pop", "moodboard", "sip"],
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
  /** The hand that does it, nearer whatever it is done with. */
  hand: DeskHand;
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

/** Eased progress of `t` from `from` to `to`, held at 0 before and 1 after. */
function progress(t: number, from: number, to: number): number {
  const k = Math.min(1, Math.max(0, (t - from) / (to - from)));
  return k * k * (3 - 2 * k);
}

/** 0..1 presses, `count` of them evenly over `from` to `to`, resting at 0 outside. */
function presses(t: number, from: number, to: number, count: number): number {
  if (t < from || t >= to) {
    return 0;
  }
  return Math.abs(Math.sin(((t - from) / (to - from)) * Math.PI * count));
}

/**
 * 2B's desk calendar: the fingertip takes the page's lower edge and carries it over the top to
 * the back, then taps a date on the new page twice. `flip` is 0 on the front, 1 hung on the back.
 */
export interface CalendarStep {
  hand: "page" | "face" | null;
  flip: number;
  press: number;
}

export function calendarStep(elapsed: number): CalendarStep {
  if (elapsed < 1.9) {
    return { hand: "page", flip: progress(elapsed, 0.9, 1.9), press: 0 };
  }
  if (elapsed < 3.7) {
    return { hand: "face", flip: 1, press: presses(elapsed, 2.5, 3.7, 2) };
  }
  return { hand: null, flip: 1, press: 0 };
}

/**
 * Erza's stamp, once it is in her hand: dabbed on the ink pad twice, pressed once on the top
 * sheet, then held up while she looks the sheet over. The mark is on the sheet from the press on.
 */
export interface StampStep {
  hand: "pad" | "paper" | null;
  press: number;
  stamped: boolean;
}

export const stampPressAt = 3.3;

export function stampStep(elapsed: number): StampStep {
  const stamped = elapsed >= stampPressAt;
  if (elapsed < reachSeconds) {
    return { hand: null, press: 0, stamped };
  }
  if (elapsed < 2.3) {
    return { hand: "pad", press: presses(elapsed, 1.5, 2.3, 2), stamped };
  }
  if (elapsed < 3.6) {
    return { hand: "paper", press: presses(elapsed, 3.0, 3.6, 1), stamped };
  }
  return { hand: null, press: 0, stamped };
}

/**
 * Miruku's safe: the combination dialled in, the door pulled open by its handle, a look inside,
 * the door shut and the dial spun to lock it. `door` is 0 shut to 1 open; `dial` in radians.
 */
export interface SafeStep {
  hand: "dial" | "handle" | null;
  door: number;
  dial: number;
}

const dialSwing = 1.6;
const dialRate = 3.5;
const dialSet = dialSwing * Math.sin(1.8 * dialRate);

export function safeStep(elapsed: number): SafeStep {
  const door = progress(elapsed, 3.3, 4.1) - progress(elapsed, 5.6, 6.3);
  let dial = 0;
  if (elapsed >= 0.9 && elapsed < 2.7) {
    dial = dialSwing * Math.sin((elapsed - 0.9) * dialRate);
  } else if (elapsed >= 2.7) {
    // Left where the combination ended, then spun on locking.
    dial = dialSet + 7 * Math.max(0, Math.min(elapsed, 7.2) - 6.3);
  }
  let hand: SafeStep["hand"] = null;
  if (elapsed < 2.7) {
    hand = "dial";
  } else if (elapsed < 4.1 || (elapsed >= 5.6 && elapsed < 6.3)) {
    hand = "handle";
  } else if (elapsed >= 6.3 && elapsed < 7.2) {
    hand = "dial";
  }
  return { hand, door, dial };
}

/**
 * Huagua's mood board: one card moved to the other spot on the board and patted flat, then a
 * step back in the chair to look at it. `along` is the card's trip, 0..1.
 */
export interface MoodboardStep {
  hand: boolean;
  along: number;
  press: number;
}

export function moodboardStep(elapsed: number): MoodboardStep {
  return {
    hand: elapsed < 3.0,
    along: progress(elapsed, 1.0, 2.2),
    press: presses(elapsed, 2.2, 3.0, 2),
  };
}

/**
 * Yor reseating one node's network cable: pulled out, held a moment, pushed back in, then the
 * node's light blinks fast while it comes back. `out` is how far the plug is out, 0..1.
 */
export interface PiStep {
  hand: boolean;
  out: number;
  linkUp: boolean;
  booting: boolean;
}

export function piStep(elapsed: number): PiStep {
  const out = progress(elapsed, 0.9, 1.6) - progress(elapsed, 3.0, 3.6);
  const linkUp = out < 0.3;
  return { hand: elapsed < 3.8, out, linkUp, booting: linkUp && elapsed >= 3.0 && elapsed < 5.0 };
}

/** The face that goes with a bit, or null to keep the mood's own. `time` drives talking and bites. */
export function deskBitFace(bit: ActiveDeskBit, time: number): ExpressionWeights | null {
  const k = deskBitEnvelope(bit);
  switch (bit.kind) {
    case "plush-hug":
      return { happy: 0.85 * k };
    case "rose":
    case "sip":
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
    case "stamp":
      // Pleased with the mark once it is on the paper.
      return stampStep(bit.elapsed).stamped ? { happy: 0.6 * k } : null;
    case "moodboard":
      return moodboardStep(bit.elapsed).hand ? null : { happy: 0.45 * k };
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

  /** `hands` overrides a bit's usual hand, for things that sit on the other side of this desk. */
  constructor(
    private readonly bits: readonly DeskBit[],
    private readonly random: () => number = Math.random,
    private readonly hands: Partial<Record<DeskBit, DeskHand>> = {},
  ) {}

  /**
   * `atDesk`: idling at their own desk. Anything else ends the current bit at once. `possible`
   * leaves out bits that cannot be done right now, such as a sip from an empty mug.
   */
  update(now: number, atDesk: boolean, possible: (bit: DeskBit) => boolean = () => true): ActiveDeskBit | null {
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
    const open = this.bits.filter(possible);
    const choices = open.length > 1 ? open.filter((bit) => bit !== this.last) : open;
    const kind = choices[Math.floor(this.random() * choices.length) % Math.max(1, choices.length)];
    if (kind === undefined) {
      this.nextAt = now + this.gap();
      return null;
    }
    this.last = kind;
    const hand = this.hands[kind] ?? bitSpecs[kind].hand;
    this.current = { kind, elapsed: 0, duration: bitSpecs[kind].duration, startedAt: now, hand };
    return this.current;
  }

  private gap(): number {
    return 6 + this.random() * 8;
  }
}
