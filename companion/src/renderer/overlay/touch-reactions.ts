import type { ExpressionWeights } from "../common/expressions.js";
import type { TouchSide, TouchZone } from "./touch-zones.js";

/** A quick click, a press held still, or a press dragged across her (petting). */
export type TouchKind = "tap" | "hold" | "stroke";

/** Body language for a reaction; the overlay pose turns each into bone rotations. */
export type TouchGesture =
  | "lean-in"
  | "sleepy"
  | "tuck-hair"
  | "giggle"
  | "flinch"
  | "rub-forehead"
  | "surprise-smile"
  | "pout-away"
  | "turn-nod"
  | "tilt-ask"
  | "follow-hand"
  | "wave-small"
  | "step-back"
  | "turn-away"
  | "scrunch";

/** One stretch of a reaction's face, until `untilSeconds` after it started. */
export interface ReactionPhase {
  untilSeconds: number;
  expressions: ExpressionWeights;
}

export interface TouchReaction {
  zone: TouchZone;
  side: TouchSide;
  gesture: TouchGesture;
  durationSeconds: number;
  phases: ReactionPhase[];
  /** A short line next to her, or null to react without words. */
  line: string | null;
}

/** Annoyance gained per touch. Petting her head or hair soothes instead of annoying. */
const annoyanceGain: Record<TouchZone, number> = {
  head: 0.08,
  hair: 0.1,
  forehead: 0.22,
  cheek: 0.2,
  nose: 0.18,
  shoulder: 0.12,
  hand: 0.1,
  body: 0.35,
};
const soothing = -0.06;
/** Per second: a poked 2B calms down in a few seconds if left alone. */
const annoyanceDecay = 0.12;
const annoyedAt = 0.55;
const sulkAt = 0.9;
const sulkSeconds = 5;
/** Touches on the same zone this close together count as "again". */
const repeatWindowSeconds = 1.6;

function once(expressions: ExpressionWeights, seconds: number): ReactionPhase[] {
  return [{ untilSeconds: seconds, expressions }];
}

/**
 * How 2B answers being touched. Keeps an annoyance level that rises with pokes, falls with
 * petting and time, and makes her sulk for a moment when it overflows.
 * `random` is injectable so tests can pin the line variants.
 */
export class TouchMood {
  private annoyance = 0;
  private lastAt = Number.NEGATIVE_INFINITY;
  private sulkUntil = Number.NEGATIVE_INFINITY;
  private lastZone: TouchZone | null = null;
  private repeats = 0;

  constructor(private readonly random: () => number = Math.random) {}

  annoyanceAt(at: number): number {
    return Math.max(0, this.annoyance - annoyanceDecay * Math.max(0, at - this.lastAt));
  }

  react(zone: TouchZone, kind: TouchKind, side: TouchSide, at: number): TouchReaction {
    const calm = this.annoyanceAt(at);
    this.repeats = zone === this.lastZone && at - this.lastAt < repeatWindowSeconds ? this.repeats + 1 : 0;
    this.lastZone = zone;
    this.lastAt = at;

    if (at < this.sulkUntil) {
      this.annoyance = calm;
      return {
        zone,
        side,
        gesture: "turn-away",
        durationSeconds: 1.6,
        phases: once({ angry: 0.35 }, 1.6),
        line: this.pick(["Hmph.", "Lagi ngambek."]),
      };
    }

    const petting = (zone === "head" || zone === "hair") && kind !== "tap";
    this.annoyance = Math.min(1, Math.max(0, calm + (petting ? soothing : annoyanceGain[zone])));
    if (this.annoyance >= sulkAt) {
      this.sulkUntil = at + sulkSeconds;
      this.annoyance = 0.6;
      return {
        zone,
        side,
        gesture: "turn-away",
        durationSeconds: sulkSeconds,
        phases: once({ angry: 0.45 }, sulkSeconds),
        line: "Udah ah, aku ngambek bentar.",
      };
    }
    const annoyed = this.annoyance >= annoyedAt;
    return { zone, side, ...this.zoneReaction(zone, kind, annoyed) };
  }

  private zoneReaction(zone: TouchZone, kind: TouchKind, annoyed: boolean): Omit<TouchReaction, "zone" | "side"> {
    const again = this.repeats;
    switch (zone) {
      case "head":
        if (kind === "hold") {
          return {
            gesture: "sleepy",
            durationSeconds: 3.5,
            phases: once({ relaxed: 0.7 }, 3.5),
            line: this.pick(["Lima menit lagi...", "Mm, enak."]),
          };
        }
        return {
          gesture: "lean-in",
          durationSeconds: 2.4,
          phases: once({ happy: 0.85 }, 2.4),
          line: kind === "stroke" ? this.pick(["Hehe.", "Mm, terusin."]) : this.pick(["Hehe.", "Iya, iya."]),
        };
      case "hair":
        if (kind === "stroke" || again >= 2) {
          return {
            gesture: "giggle",
            durationSeconds: 2,
            phases: once({ happy: 0.6 }, 2),
            line: this.pick(["Hihi, geli.", "Rambutku jadi berantakan."]),
          };
        }
        return {
          gesture: "tuck-hair",
          durationSeconds: 2.2,
          phases: once({ relaxed: 0.3 }, 2.2),
          line: this.pick(["Eh, rambutku.", "Hm?"]),
        };
      case "forehead":
        if (again >= 1 || annoyed) {
          return {
            gesture: "rub-forehead",
            durationSeconds: 2.4,
            phases: [
              { untilSeconds: 0.5, expressions: { angry: 0.3, sad: 0.2 } },
              { untilSeconds: 2.4, expressions: { angry: 0.45 } },
            ],
            line: this.pick(["Ih, sakit tau.", "Aduh, udah dong."]),
          };
        }
        return {
          gesture: "flinch",
          durationSeconds: 1.8,
          phases: [
            { untilSeconds: 0.35, expressions: { surprised: 0.7 } },
            { untilSeconds: 1.8, expressions: { sad: 0.25 } },
          ],
          line: "Aduh!",
        };
      case "cheek":
        if (again >= 2 || annoyed) {
          return {
            gesture: "pout-away",
            durationSeconds: 2.6,
            phases: once({ angry: 0.4 }, 2.6),
            line: annoyed ? "Iya iya, aku lihat kok." : "Hmph.",
          };
        }
        return {
          gesture: "surprise-smile",
          durationSeconds: 2,
          phases: [
            { untilSeconds: 0.45, expressions: { surprised: 0.7 } },
            { untilSeconds: 2, expressions: { happy: 0.5 } },
          ],
          line: this.pick(["Eh?", "Kenapa?"]),
        };
      case "nose":
        return {
          gesture: "scrunch",
          durationSeconds: 1.8,
          phases: [
            { untilSeconds: 0.5, expressions: { happy: 0.9 } },
            { untilSeconds: 1.8, expressions: { happy: 0.5 } },
          ],
          line: this.pick(["Hidungku!", "Boop?"]),
        };
      case "shoulder":
        if (again >= 1) {
          return {
            gesture: "tilt-ask",
            durationSeconds: 2.2,
            phases: once({ surprised: 0.25 }, 2.2),
            line: "Ada apa?",
          };
        }
        return {
          gesture: "turn-nod",
          durationSeconds: 1.8,
          phases: once({ happy: 0.25 }, 1.8),
          line: annoyed ? "Iya, kenapa lagi?" : "Ya?",
        };
      case "hand":
        return kind === "hold"
          ? {
              gesture: "follow-hand",
              durationSeconds: 2.5,
              phases: once({ happy: 0.3 }, 2.5),
              line: this.pick(["Mau ke mana?", "Ikut."]),
            }
          : {
              gesture: "wave-small",
              durationSeconds: 1.8,
              phases: once({ happy: 0.4 }, 1.8),
              line: "Dah.",
            };
      case "body":
        if (again >= 1 || annoyed) {
          return {
            gesture: "turn-away",
            durationSeconds: 2.4,
            phases: once({ angry: 0.3 }, 2.4),
            line: "Eh, jangan gitu.",
          };
        }
        return {
          gesture: "step-back",
          durationSeconds: 1.8,
          phases: once({ surprised: 0.45 }, 1.8),
          line: "Eh?",
        };
    }
  }

  private pick(options: readonly string[]): string {
    return options[Math.floor(this.random() * options.length) % options.length] as string;
  }
}

/** The face for `elapsed` seconds into a reaction, or null once the reaction is over. */
export function reactionFace(reaction: TouchReaction, elapsed: number): ExpressionWeights | null {
  if (elapsed >= reaction.durationSeconds) {
    return null;
  }
  return reaction.phases.find((phase) => elapsed < phase.untilSeconds)?.expressions ?? null;
}
