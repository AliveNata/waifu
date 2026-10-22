import { Vector3 } from "three";

export type Hand = "left" | "right";

/** Touch typing's split: the left hand owns the left half of each row, the right hand the rest. */
const leftHandKeys: ReadonlySet<string> = new Set("12345qwertasdfgzxcvb");

export function handForKey(character: string): Hand {
  return leftHandKeys.has(character.toLowerCase()) ? "left" : "right";
}

/** How high a fingertip hovers over the keys between strokes, in meters. */
export const hoverHeight = 0.014;
/** One stroke: down onto the key and back up. */
export const strikeSeconds = 0.14;
/** How quickly a hand slides over to the next key, per second; fast, but not a teleport. */
const followRate = 22;

interface HandState {
  target: Vector3;
  current: Vector3;
  sinceStrike: number;
}

/** Fingertip height above the key during a stroke: hover, touch the key mid-stroke, hover again. */
export function strokeLift(sinceStrike: number): number {
  const t = Math.min(1, sinceStrike / strikeSeconds);
  return hoverHeight * Math.abs(Math.cos(t * Math.PI));
}

/**
 * Where each fingertip is over a keyboard, in the keyboard's local space. A typed key pulls the
 * hand that owns it over and taps it; the other hand stays where it last typed.
 */
export class TypingHands {
  private readonly hands: Record<Hand, HandState>;

  constructor(homes: Record<Hand, Vector3>) {
    const state = (home: Vector3): HandState => ({
      target: home.clone(),
      current: home.clone(),
      sinceStrike: strikeSeconds,
    });
    this.hands = { left: state(homes.left), right: state(homes.right) };
  }

  strike(hand: Hand, keyTop: Vector3): void {
    const state = this.hands[hand];
    state.target.copy(keyTop);
    state.sinceStrike = 0;
  }

  update(deltaSeconds: number): void {
    const blend = 1 - Math.exp(-followRate * deltaSeconds);
    for (const state of Object.values(this.hands)) {
      state.current.lerp(state.target, blend);
      state.sinceStrike += deltaSeconds;
    }
  }

  fingertip(hand: Hand, out = new Vector3()): Vector3 {
    const state = this.hands[hand];
    out.copy(state.current);
    out.y = state.target.y + strokeLift(state.sinceStrike);
    return out;
  }
}

/**
 * Every so often a typist takes the right hand off the keys to use the mouse for a few seconds.
 * `random` is injectable so tests can pin the timing.
 */
export class MouseHabit {
  private nextAt: number;
  private until = Number.NEGATIVE_INFINITY;

  constructor(
    now: number,
    private readonly random: () => number = Math.random,
  ) {
    this.nextAt = now + this.gap();
  }

  /** Whether the right hand is on the mouse at `now` (seconds). Only typing starts a mouse spell. */
  using(now: number, typing: boolean): boolean {
    if (now < this.until) {
      return typing;
    }
    if (typing && now >= this.nextAt) {
      this.until = now + 2 + this.random() * 3;
      this.nextAt = this.until + this.gap();
      return true;
    }
    return false;
  }

  private gap(): number {
    return 7 + this.random() * 14;
  }
}
