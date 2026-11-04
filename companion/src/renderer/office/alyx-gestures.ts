import { Vector3 } from "three";
import type { Finger, VrHandSide } from "../common/vr-hand.js";

/**
 * What Alyx's hands do on their own while he stands or sits about: glance at his watch, tug a
 * cuff straight, drum his fingers, rub his hands, make a fist, look at his palm. One at a time,
 * picked at random every few seconds, and dropped the moment he walks or uses his hands.
 */

export interface Placement {
  /** Where the palm sits, in the view's frame (x right, y up, z toward the viewer). */
  palm: Vector3;
  fingers: Vector3;
  facing: Vector3;
  curl: Record<Finger, number>;
  /** Turn about the line of sight, radians. */
  roll: number;
}

const fingerOrder: readonly Finger[] = ["thumb", "index", "middle", "ring", "pinky"];

export function mix(from: Placement, to: Placement, t: number): Placement {
  const curl = {} as Record<Finger, number>;
  for (const finger of fingerOrder) {
    curl[finger] = from.curl[finger] + (to.curl[finger] - from.curl[finger]) * t;
  }
  return {
    palm: from.palm.clone().lerp(to.palm, t),
    fingers: from.fingers.clone().lerp(to.fingers, t),
    facing: from.facing.clone().lerp(to.facing, t),
    curl,
    roll: from.roll + (to.roll - from.roll) * t,
  };
}

function curlOf(thumb: number, index: number, middle: number, ring: number, pinky: number): Record<Finger, number> {
  return { thumb, index, middle, ring, pinky };
}

const flat = curlOf(0.05, 0.03, 0.03, 0.05, 0.08);
const fist = curlOf(0.75, 0.95, 1, 1, 1);
const pinch = curlOf(0.55, 0.6, 0.75, 0.85, 0.9);

export type Gesture = "watch" | "cuff" | "tap" | "rub" | "clench" | "palm";

export const gestures: readonly Gesture[] = ["watch", "cuff", "tap", "rub", "clench", "palm"];

/** How long each one takes, raising the hands and lowering them again included. */
export const gestureSeconds: Record<Gesture, number> = {
  watch: 3.2,
  cuff: 3,
  tap: 4,
  rub: 2.8,
  clench: 3,
  palm: 3.2,
};

/** Seconds to bring the hands into a gesture and back out of it. */
const reachSeconds = 0.45;

/** 0..1: eased in over the first moments of a gesture, held, eased back out at its end. */
export function gestureAmount(gesture: Gesture, seconds: number): number {
  const length = gestureSeconds[gesture];
  if (seconds <= 0 || seconds >= length) {
    return 0;
  }
  const k = Math.min(1, seconds / reachSeconds, (length - seconds) / reachSeconds);
  return k * k * (3 - 2 * k);
}

/**
 * Where the hands go for a gesture, `seconds` into it, at full strength; the caller blends from
 * `rest` by `gestureAmount`. A hand the gesture leaves alone is not in the result.
 */
export function gesturePlacements(
  gesture: Gesture,
  seconds: number,
  rest: Record<VrHandSide, Placement>,
): Partial<Record<VrHandSide, Placement>> {
  switch (gesture) {
    case "watch":
      // Left forearm up and across, the back of the wrist turned to the eyes.
      return {
        Left: {
          palm: new Vector3(-0.05, -0.14, -0.34),
          fingers: new Vector3(1, 0.25, -0.25),
          facing: new Vector3(0.05, -0.65, -0.8),
          curl: rest.Left.curl,
          roll: 0,
        },
      };
    case "cuff": {
      // Left arm across, palm down; the right hand pinches its cuff and tugs it down the wrist.
      const leftFingers = new Vector3(0.9, 0.2, -0.5).normalize();
      const leftPalm = new Vector3(-0.08, -0.23, -0.37);
      const wrist = leftPalm.clone().addScaledVector(leftFingers, -0.09);
      const tug = 0.012 * Math.sin(seconds * 9);
      return {
        Left: { palm: leftPalm, fingers: leftFingers, facing: new Vector3(0, -1, 0.1), curl: rest.Left.curl, roll: 0 },
        Right: {
          palm: wrist
            .clone()
            .add(new Vector3(0.03, 0.05, 0.02))
            .addScaledVector(leftFingers, -tug),
          fingers: new Vector3(-0.7, -0.45, -0.55),
          facing: new Vector3(-0.3, -1, 0),
          curl: pinch,
          roll: 0,
        },
      };
    }
    case "tap": {
      // Fingers drummed one after another, little finger to index, both hands out of step.
      const drum = (side: VrHandSide, offset: number): Placement => {
        const base = rest[side];
        const curl = { ...base.curl };
        (["pinky", "ring", "middle", "index"] as const).forEach((finger, order) => {
          const beat = Math.sin(seconds * 2 * Math.PI * 2.2 - order * 0.9 + offset);
          curl[finger] = Math.max(0, base.curl[finger] - 0.25 + 0.45 * Math.max(0, beat));
        });
        return { ...base, palm: base.palm.clone().add(new Vector3(0, 0.03, 0.01)), curl };
      };
      return { Right: drum("Right", 0), Left: drum("Left", Math.PI / 2) };
    }
    case "rub": {
      // Palms together in front of the chest, sliding against each other.
      const slide = 0.022 * Math.sin(seconds * 13);
      const together = (side: VrHandSide): Placement => {
        const sign = side === "Right" ? 1 : -1;
        return {
          palm: new Vector3(0.032 * sign, -0.19 + slide * sign, -0.38 + 0.008 * Math.cos(seconds * 13)),
          fingers: new Vector3(-0.15 * sign, 0.55, -0.82),
          facing: new Vector3(-sign, 0, 0),
          curl: flat,
          roll: 0,
        };
      };
      return { Right: together("Right"), Left: together("Left") };
    }
    case "clench": {
      // Two slow fists, opened out flat in between, as if loosening up the fingers.
      const squeeze = 0.5 - 0.5 * Math.cos(((seconds - reachSeconds) / 1.05) * 2 * Math.PI);
      const hand = (side: VrHandSide): Placement => {
        const base = rest[side];
        const curl = {} as Record<Finger, number>;
        for (const finger of fingerOrder) {
          curl[finger] = flat[finger] + (fist[finger] - flat[finger]) * squeeze;
        }
        return { ...base, palm: base.palm.clone().add(new Vector3(0, 0.04, 0.02)), curl };
      };
      return { Right: hand("Right"), Left: hand("Left") };
    }
    case "palm":
      // Right hand up, palm to the face, turned a little this way and that.
      return {
        Right: {
          palm: new Vector3(0.09, -0.12, -0.36),
          fingers: new Vector3(-0.2, 1, -0.3),
          facing: new Vector3(0, -0.15, 1),
          curl: flat,
          roll: 0.3 * Math.sin(seconds * 2.2),
        },
      };
  }
}

/** Idle this long, in seconds, before the next gesture: the low end after one just ended. */
const pause: readonly [number, number] = [3, 8];
/** How fast a gesture gives way once he is busy, per second. */
const yieldRate = 6;

export interface GestureFrame {
  gesture: Gesture;
  /** Seconds into the gesture. */
  seconds: number;
  /** 1 while idle; falls to 0 quickly once he walks or uses his hands. */
  weight: number;
}

export class IdleGestures {
  private current: { gesture: Gesture; seconds: number } | null = null;
  private last: Gesture | null = null;
  private weight = 0;
  private wait: number;

  constructor(private readonly random: () => number) {
    this.wait = this.pauseLength();
  }

  /** Advances by `delta` seconds; `busy` while walking or while the hands have something to do. */
  update(delta: number, busy: boolean): GestureFrame | null {
    if (busy) {
      this.weight = Math.max(0, this.weight - yieldRate * delta);
      if (this.weight === 0) {
        this.current = null;
        this.wait = this.pauseLength();
      }
    } else if (this.current === null) {
      this.wait -= delta;
      if (this.wait <= 0) {
        this.current = { gesture: this.pick(), seconds: 0 };
        this.weight = 1;
      }
    } else {
      this.weight = Math.min(1, this.weight + yieldRate * delta);
    }
    const current = this.current;
    if (current === null) {
      return null;
    }
    if (!busy) {
      current.seconds += delta;
    }
    if (current.seconds >= gestureSeconds[current.gesture]) {
      this.current = null;
      this.wait = this.pauseLength();
      return null;
    }
    return { gesture: current.gesture, seconds: current.seconds, weight: this.weight };
  }

  private pick(): Gesture {
    const choices = gestures.filter((gesture) => gesture !== this.last);
    const gesture = choices[Math.min(choices.length - 1, Math.floor(this.random() * choices.length))] ?? "tap";
    this.last = gesture;
    return gesture;
  }

  private pauseLength(): number {
    return pause[0] + this.random() * (pause[1] - pause[0]);
  }
}
