import type { Mood } from "../../shared/reaction.js";
import type { ExpressionWeights } from "../common/expressions.js";
import { addRotation, type PoseBones } from "../common/pose.js";
import { applyTouchGesture, envelope } from "./pose-bones.js";

/** Small things 2B does on her own while nothing is going on, so she never loops one motion. */
export type Fidget =
  | "look-around"
  | "hum-sway"
  | "glance-down"
  | "yawn"
  | "smile"
  | "shoulder-roll"
  | "head-tilt"
  | "tuck-hair"
  | "look-up";

export interface ActiveFidget {
  kind: Fidget;
  elapsed: number;
  duration: number;
}

/** Which fidgets fit each mood. Busy moods get fewer and quieter ones; a greeting or a finish gets none. */
const fidgetsByMood: Record<Mood, readonly Fidget[]> = {
  idle: ["look-around", "hum-sway", "glance-down", "yawn", "smile", "shoulder-roll", "head-tilt", "tuck-hair"],
  thinking: ["look-up", "head-tilt", "glance-down"],
  working: ["glance-down", "shoulder-roll"],
  waiting: ["look-around", "head-tilt", "hum-sway", "smile"],
  greeting: [],
  done: [],
};

const durations: Record<Fidget, number> = {
  "look-around": 3.2,
  "hum-sway": 4,
  "glance-down": 2.2,
  yawn: 2.8,
  smile: 2.4,
  "shoulder-roll": 1.8,
  "head-tilt": 2.4,
  "tuck-hair": 2.2,
  "look-up": 2.6,
};

/**
 * Picks the next fidget after a quiet gap, never the same one twice in a row. Touches and poses
 * from the chat take over the body, so `busy` holds fidgets off while they play. `random` is
 * injectable for tests.
 */
export class FidgetScheduler {
  private current: { kind: Fidget; startedAt: number } | null = null;
  private last: Fidget | null = null;
  private nextAt: number;

  constructor(
    now: number,
    private readonly random: () => number = Math.random,
  ) {
    this.nextAt = now + this.gap();
  }

  update(now: number, mood: Mood, busy: boolean): ActiveFidget | null {
    if (this.current !== null) {
      const elapsed = now - this.current.startedAt;
      const duration = durations[this.current.kind];
      if (busy || elapsed >= duration || !fidgetsByMood[mood].includes(this.current.kind)) {
        this.current = null;
        this.nextAt = now + this.gap();
      } else {
        return { kind: this.current.kind, elapsed, duration };
      }
    }
    if (busy || now < this.nextAt) {
      return null;
    }
    const choices = fidgetsByMood[mood].filter((kind) => kind !== this.last);
    const kind = choices[Math.floor(this.random() * choices.length) % Math.max(1, choices.length)];
    if (kind === undefined) {
      this.nextAt = now + this.gap();
      return null;
    }
    this.current = { kind, startedAt: now };
    this.last = kind;
    return { kind, elapsed: 0, duration: durations[kind] };
  }

  private gap(): number {
    return 5 + this.random() * 8;
  }
}

/** Adds a fidget's motion on top of the mood pose. */
export function applyFidget(bones: PoseBones, fidget: ActiveFidget): void {
  const { elapsed, duration } = fidget;
  const k = envelope(elapsed, duration, 0.4, 0.5);
  const t = elapsed / duration;
  switch (fidget.kind) {
    case "look-around":
      // A look off to one side, then the other, then back.
      bones.neck = addRotation(bones.neck, { y: 0.2 * Math.sin(t * Math.PI * 2) * k });
      bones.head = addRotation(bones.head, { y: 0.35 * Math.sin(t * Math.PI * 2) * k, x: -0.04 * k });
      break;
    case "hum-sway":
      // Swaying to a tune only she can hear.
      bones.head = addRotation(bones.head, { z: 0.1 * Math.sin(elapsed * 3) * k });
      bones.chest = addRotation(bones.chest, { z: -0.03 * Math.sin(elapsed * 3) * k });
      break;
    case "glance-down":
      bones.head = addRotation(bones.head, { x: 0.22 * k });
      bones.neck = addRotation(bones.neck, { x: 0.08 * k });
      break;
    case "yawn":
      bones.head = addRotation(bones.head, { x: -0.2 * k, z: 0.05 * k });
      bones.chest = addRotation(bones.chest, { x: -0.04 * k });
      break;
    case "smile":
      bones.head = addRotation(bones.head, { z: 0.1 * k });
      break;
    case "shoulder-roll": {
      // One shoulder up and back, then the other, loosening up.
      const roll = Math.sin(t * Math.PI * 2);
      bones.leftShoulder = addRotation(bones.leftShoulder, { z: 0.18 * Math.max(0, roll) * k });
      bones.rightShoulder = addRotation(bones.rightShoulder, { z: -0.18 * Math.max(0, -roll) * k });
      bones.head = addRotation(bones.head, { z: 0.05 * roll * k });
      break;
    }
    case "head-tilt":
      bones.head = addRotation(bones.head, { z: -0.16 * k, x: -0.03 * k });
      break;
    case "tuck-hair":
      applyTouchGesture(bones, {
        gesture: "tuck-hair",
        elapsed,
        durationSeconds: duration,
        side: "right",
        aimYaw: 0,
        aimPitch: 0,
      });
      break;
    case "look-up":
      bones.head = addRotation(bones.head, { x: -0.18 * k, y: 0.2 * k });
      break;
  }
}

/** The face that goes with a fidget, or null to keep the mood's own. */
export function fidgetFace(fidget: ActiveFidget): ExpressionWeights | null {
  const k = envelope(fidget.elapsed, fidget.duration, 0.4, 0.5);
  switch (fidget.kind) {
    case "yawn":
      return { aa: 0.9 * k, blink: 0.65 * k };
    case "smile":
      return { happy: 0.7 * k };
    case "hum-sway":
      return { relaxed: 0.5 * k };
    case "head-tilt":
      return { surprised: 0.15 * k };
    default:
      return null;
  }
}

/**
 * Each time a mood starts she holds it a little differently: which way the head tips while
 * thinking, where she glances while working, how she greets. Picked once per mood, from 0..2.
 */
export function applyMoodVariant(bones: PoseBones, mood: Mood, variant: number, moodElapsed: number): void {
  const v = variant % 3;
  switch (mood) {
    case "thinking":
      if (v === 1) {
        bones.head = addRotation(bones.head, { z: -0.28, y: -0.15 });
      } else if (v === 2) {
        bones.head = addRotation(bones.head, { x: 0.22, z: -0.06 });
      }
      break;
    case "working":
      if (v === 1) {
        bones.head = addRotation(bones.head, { y: 0.15, x: -0.04 });
      } else if (v === 2) {
        bones.head = addRotation(bones.head, { y: -0.12, z: 0.05 });
      }
      break;
    case "waiting":
      if (v === 1) {
        bones.head = addRotation(bones.head, { z: 0.2 });
      } else if (v === 2) {
        bones.spine = addRotation(bones.spine, { x: -0.06 });
        bones.head = addRotation(bones.head, { x: -0.06 });
      }
      break;
    case "greeting": {
      // A small bow that comes back up, or a tilt to the other side.
      const bow = Math.sin(Math.min(Math.PI, moodElapsed * 2.4)) * (moodElapsed < 1.3 ? 1 : 0);
      if (v === 1) {
        bones.spine = addRotation(bones.spine, { x: 0.12 * bow });
        bones.head = addRotation(bones.head, { x: 0.1 * bow });
      } else if (v === 2) {
        bones.head = addRotation(bones.head, { z: -0.24 });
      }
      break;
    }
    case "done":
      if (v === 1) {
        bones.head = addRotation(bones.head, { z: 0.14 });
      } else if (v === 2) {
        // A little bounce of the shoulders.
        const bounce = 0.05 * Math.abs(Math.sin(moodElapsed * 9)) * Math.exp(-moodElapsed * 1.5);
        bones.chest = addRotation(bones.chest, { x: -bounce });
        bones.head = addRotation(bones.head, { x: -bounce });
      }
      break;
    case "idle":
      break;
  }
}
