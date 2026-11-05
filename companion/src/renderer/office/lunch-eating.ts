import { type MemberId, memberIds } from "../../shared/team.js";
import type { SpeakerGesture } from "./office-chatter.js";

/**
 * How one member eats: their own pace, how far they lean over the box, how many bites they take
 * before stopping for a moment, and what the free hand does. Twelve people at one table never eat
 * in step, so each member gets their own.
 */
export interface EatStyle {
  /** Seconds for one bite, from the box up to the mouth and back down. */
  biteSeconds: number;
  /** How far over the box: 0 upright, 1 hunched over it. */
  lean: number;
  /** The most bites in a row before a pause. */
  bitesPerRound: number;
  /** One round of bites and the pause after it, in seconds. */
  roundSeconds: number;
  /** Where the free hand stays: steadying the box, resting on the table edge, or in the lap. */
  freeHand: "box" | "table" | "lap";
  /** Picks this member's rounds, and offsets them from everyone else's. */
  seed: number;
}

/** What the member is doing at one moment of the meal. */
export type LunchMoment =
  /** 0 with the chopsticks at the box, 1 at the mouth. */
  | { kind: "bite"; amount: number }
  /** Chewing with the chopsticks low, glancing about: -1 left to 1 right. */
  | { kind: "chew"; look: number; amount: number }
  /** Sitting back from the box for a moment. */
  | { kind: "sit-back"; amount: number }
  /** Poking around the box for the next piece. */
  | { kind: "pick"; amount: number };

/** A number in [0, 1) from two integers, the same every time for the same pair. */
function noise(seed: number, index: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(index + 1, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x27d4eb2f);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const freeHands: readonly EatStyle["freeHand"][] = ["box", "table", "lap"];

/** A member's way of eating, from their place in the roster. */
export function eatStyleFor(memberId: MemberId): EatStyle {
  const seed = memberIds.indexOf(memberId) * 7919 + 17;
  return {
    biteSeconds: 2.4 + 1.6 * noise(seed, 1),
    lean: 0.3 + 0.7 * noise(seed, 2),
    bitesPerRound: 2 + Math.floor(3 * noise(seed, 3)),
    roundSeconds: 11 + 6 * noise(seed, 4),
    freeHand: freeHands[Math.floor(noise(seed, 5) * freeHands.length)] ?? "box",
    seed,
  };
}

export const eatStyles: Record<MemberId, EatStyle> = Object.fromEntries(
  memberIds.map((memberId) => [memberId, eatStyleFor(memberId)]),
) as Record<MemberId, EatStyle>;

/** Up and back down over 0..1: 0 at both ends, 1 in the middle. */
function arc(t: number): number {
  return 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
}

/** In and out over 0..1, holding in between, so a pause eases into its pose and out again. */
function hold(t: number): number {
  return Math.min(1, t / 0.2, (1 - t) / 0.2);
}

/**
 * What the member is doing `seconds` into the meal. Each round is a few bites, each a little
 * faster or slower than the last, then a pause of a kind and length picked for that round.
 */
export function lunchMoment(seconds: number, style: EatStyle): LunchMoment {
  // Everyone's rounds start at a different point, so the table never bites in unison.
  const shifted = Math.max(0, seconds) + style.roundSeconds * noise(style.seed, 0);
  const round = Math.floor(shifted / style.roundSeconds);
  const into = shifted - round * style.roundSeconds;
  const bites = 1 + Math.floor(style.bitesPerRound * noise(style.seed, round * 8 + 1));
  let start = 0;
  for (let bite = 0; bite < bites; bite++) {
    const length = style.biteSeconds * (0.85 + 0.35 * noise(style.seed, round * 8 + 2 + bite));
    // Leave at least a short pause at the end of every round.
    if (start + length > style.roundSeconds - 1.5) {
      break;
    }
    if (into < start + length) {
      return { kind: "bite", amount: arc((into - start) / length) };
    }
    start += length;
  }
  const pause = (into - start) / (style.roundSeconds - start);
  const pick = noise(style.seed, round * 8 + 7);
  if (pick < 0.5) {
    return { kind: "chew", look: Math.sin(round * 2.3 + pause * 3), amount: hold(pause) };
  }
  return pick < 0.75 ? { kind: "sit-back", amount: hold(pause) } : { kind: "pick", amount: hold(pause) };
}

/** Gestures made while saying a line, as against listening: an eater stops eating to make them. */
export const speakerGestureKinds: ReadonlySet<string> = new Set([
  "explain",
  "point",
  "count",
  "chin",
  "shrug",
  "hips",
  "clasp",
  "wave-off",
] satisfies SpeakerGesture[]);
