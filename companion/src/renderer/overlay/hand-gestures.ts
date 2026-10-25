import type { TouchKind } from "./touch-reactions.js";
import type { TouchZone } from "./touch-zones.js";

/**
 * What the 3D pointer hand does: rest open over her, or one of the touches when clicked. Each
 * part of her body has its own touches, picked at random so the same click does not always
 * look the same.
 */
export type HandGesture =
  | "open"
  | "pat"
  | "ruffle"
  | "flick"
  | "double-flick"
  | "boop"
  | "boop-twice"
  | "poke"
  | "poke-twice"
  | "poke-wiggle"
  | "two-finger-tap"
  | "high-five"
  | "chest-tap";

type Finger = "thumb" | "index" | "middle" | "ring" | "pinky";

/**
 * How the hand is turned toward her: pointing up at her with the back of the hand to the viewer,
 * coming down from above (so a flick at her forehead does not cover her eyes), palm down on top
 * of her head, or palm out for a high five.
 */
export type HandFacing = "point" | "from-above" | "palm-down" | "palm-out";

/** Which point of the hand sits on the spot that was touched. */
export type HandAnchor = "index-tip" | "middle-tip" | "palm";

/** One moment of a gesture. */
export interface HandFrame {
  /** 0 straight to 1 curled into the palm. */
  curl: Record<Finger, number>;
  /** Shift from the touched spot in the camera's frame, in meters: x right, y up, z toward the viewer. */
  offset: { x: number; y: number; z: number };
  /** Roll of the hand around the view direction, in radians. */
  roll: number;
}

export interface GestureSpec {
  facing: HandFacing;
  anchor: HandAnchor;
  seconds: number;
}

/** Touches on each part of her, in the order the variants are picked from. */
const variants: Record<TouchZone, readonly Exclude<HandGesture, "open">[]> = {
  head: ["pat", "ruffle"],
  hair: ["pat", "ruffle"],
  forehead: ["flick", "double-flick"],
  nose: ["boop", "boop-twice"],
  cheek: ["poke", "poke-twice", "poke-wiggle"],
  shoulder: ["two-finger-tap", "poke"],
  hand: ["high-five"],
  body: ["poke", "poke-twice"],
  chest: ["chest-tap"],
};

/**
 * The touch for a part of her. Petting (a held press or a stroke) on the head or hair is
 * always the stroking pat; otherwise `roll` (0 to 1) picks one of the part's variants.
 */
export function gestureForZone(zone: TouchZone, kind: TouchKind, roll: number): Exclude<HandGesture, "open"> {
  if ((zone === "head" || zone === "hair") && kind !== "tap") {
    return "pat";
  }
  const options = variants[zone];
  return options[Math.floor(roll * options.length) % options.length] ?? options[0] ?? "poke";
}

export const gestureSpecs: Record<HandGesture, GestureSpec> = {
  // The fingertip sits on the spot, so the hand rests beside what it points at, not over it.
  open: { facing: "point", anchor: "index-tip", seconds: Number.POSITIVE_INFINITY },
  pat: { facing: "palm-down", anchor: "palm", seconds: 1.4 },
  ruffle: { facing: "palm-down", anchor: "palm", seconds: 1.4 },
  flick: { facing: "from-above", anchor: "middle-tip", seconds: 0.8 },
  "double-flick": { facing: "from-above", anchor: "middle-tip", seconds: 1.25 },
  boop: { facing: "point", anchor: "index-tip", seconds: 0.55 },
  "boop-twice": { facing: "point", anchor: "index-tip", seconds: 0.8 },
  poke: { facing: "point", anchor: "index-tip", seconds: 0.6 },
  "poke-twice": { facing: "point", anchor: "index-tip", seconds: 0.9 },
  "poke-wiggle": { facing: "point", anchor: "index-tip", seconds: 0.9 },
  "two-finger-tap": { facing: "point", anchor: "index-tip", seconds: 0.8 },
  "high-five": { facing: "palm-out", anchor: "palm", seconds: 0.7 },
  "chest-tap": { facing: "point", anchor: "index-tip", seconds: 1.6 },
};

/** When her hand meets the pointer on a chest touch, in seconds; the swat in her pose lands here too. */
export const chestSwatSeconds = 0.5;

/**
 * When the flicking finger hits her forehead, in seconds; her head snaps back at the same moment.
 * A double flick hits again at `secondFlickSnapSeconds`.
 */
export const flickSnapSeconds = 0.26;
export const secondFlickSnapSeconds = 0.74;
/** Loading a flick: the hand draws back and the finger presses against the thumb. */
const flickLoadSeconds = 0.22;
/** The finger flies out in about one frame at 20 fps: a real flick is that quick. */
const flickSnapLength = 0.05;

/** 0 to 1, eased at both ends. */
function ease(value: number): number {
  const u = Math.min(1, Math.max(0, value));
  return u * u * (3 - 2 * u);
}

/**
 * A flick: the middle fingertip held against the pad of the thumb while the hand draws back a
 * little and the fingers tremble with the pressure, then the finger flies out past straight,
 * the hand jerks forward with it, and everything springs back and relaxes.
 */
function flickFrame(t: number, snaps: readonly number[]): HandFrame {
  // The snap this moment belongs to: the last one already started, or the first one coming.
  const at = [...snaps].reverse().find((snap) => t >= snap - flickLoadSeconds) ?? snaps[0] ?? flickSnapSeconds;
  const since = t - at;
  const loading = ease((since + flickLoadSeconds) / 0.12);
  // Holding back: middle curled onto the thumb, the other fingers loose and a little fanned.
  const held = { thumb: 0.75, index: 0.2, middle: 0.95, ring: 0.28, pinky: 0.35 };
  if (since < 0) {
    const tremble = since > -0.1 ? 0.0012 * Math.sin(t * 90) : 0;
    return {
      curl: {
        thumb: relaxed.thumb + (held.thumb - relaxed.thumb) * loading,
        index: relaxed.index + (held.index - relaxed.index) * loading,
        middle: relaxed.middle + (held.middle - relaxed.middle) * loading,
        ring: relaxed.ring + (held.ring - relaxed.ring) * loading,
        pinky: relaxed.pinky + (held.pinky - relaxed.pinky) * loading,
      },
      offset: { x: tremble, y: 0.004 * loading, z: 0.012 * loading },
      roll: 0,
    };
  }
  if (since < flickSnapLength) {
    // Let go: the finger shoots past straight and the hand jerks in after it.
    const out = since / flickSnapLength;
    return {
      curl: { ...held, thumb: 0.75 - 0.3 * out, middle: 0.95 - 1.1 * out },
      offset: { x: 0, y: 0.004 * (1 - out), z: 0.012 - 0.02 * out },
      roll: 0,
    };
  }
  // Spring back: the finger settles from bent back to straight, the hand drifts out and relaxes.
  const settle = ease((since - flickSnapLength) / 0.3);
  return {
    curl: {
      thumb: 0.45 + (relaxed.thumb - 0.45) * settle,
      index: held.index + (relaxed.index - held.index) * settle,
      middle: -0.15 + (relaxed.middle + 0.15) * settle,
      ring: held.ring + (relaxed.ring - held.ring) * settle,
      pinky: held.pinky + (relaxed.pinky - held.pinky) * settle,
    },
    offset: { x: 0, y: 0.003 * settle, z: -0.008 + 0.018 * settle },
    roll: 0,
  };
}

/** A press held still keeps the stroke going this many times as long. */
export const holdStretch = 2;

const fist = { thumb: 0.6, index: 0.9, middle: 0.9, ring: 0.9, pinky: 0.9 };
const relaxed = { thumb: 0.15, index: 0.12, middle: 0.14, ring: 0.16, pinky: 0.2 };
const pointing = { ...fist, index: 0 };
const twoFingers = { ...fist, index: 0, middle: 0 };
const flat = { thumb: 0.1, index: 0.05, middle: 0.05, ring: 0.05, pinky: 0.08 };
const still = { x: 0, y: 0, z: 0 };

/** Pulses from 0 up to 1 and back over `width` seconds, starting at `at`. */
function pulse(t: number, at: number, width: number): number {
  const u = (t - at) / width;
  return u <= 0 || u >= 1 ? 0 : Math.sin(u * Math.PI);
}

/** Pushes toward her (negative z), once per start time. */
function pushes(t: number, starts: readonly number[], depth: number, width: number): number {
  return -depth * starts.reduce((sum, at) => sum + pulse(t, at, width), 0);
}

/** The hand `t` seconds into a gesture. */
export function handFrame(gesture: HandGesture, t: number): HandFrame {
  switch (gesture) {
    case "open": {
      // Resting open over her, the fingers drifting a little so the hand looks alive.
      const drift = 0.05 * Math.sin(t * 1.7);
      return {
        curl: { ...relaxed, index: relaxed.index + drift, ring: relaxed.ring - drift },
        offset: still,
        roll: 0,
      };
    }
    case "pat":
      // Side to side across the top of her head, lifting a little at each end.
      return {
        curl: flat,
        offset: { x: 0.035 * Math.sin(t * 9), y: 0.006 * Math.abs(Math.cos(t * 9)), z: 0 },
        roll: 0.08 * Math.sin(t * 9),
      };
    case "ruffle": {
      // Small circles with the fingers working in and out, messing her hair up.
      const work = 0.5 + 0.5 * Math.sin(t * 14);
      return {
        curl: {
          thumb: 0.2,
          index: 0.15 + 0.4 * work,
          middle: 0.2 + 0.4 * work,
          ring: 0.2 + 0.4 * work,
          pinky: 0.25 + 0.4 * work,
        },
        offset: { x: 0.02 * Math.cos(t * 10), y: 0.012 * Math.sin(t * 10), z: 0 },
        roll: 0,
      };
    }
    case "flick":
    case "double-flick":
      return flickFrame(t, gesture === "flick" ? [flickSnapSeconds] : [flickSnapSeconds, secondFlickSnapSeconds]);
    case "boop":
    case "boop-twice": {
      const starts = gesture === "boop" ? [0.1] : [0.08, 0.4];
      return { curl: pointing, offset: { x: 0, y: 0, z: pushes(t, starts, 0.012, 0.25) }, roll: 0 };
    }
    case "poke":
    case "poke-twice":
    case "poke-wiggle": {
      const starts = gesture === "poke-twice" ? [0.1, 0.45] : [0.12];
      const width = gesture === "poke-wiggle" ? 0.7 : 0.35;
      const twist = gesture === "poke-wiggle" ? 0.25 * Math.sin(t * 20) * pulse(t, 0.12, width) : 0;
      return { curl: pointing, offset: { x: 0, y: 0, z: pushes(t, starts, 0.018, width) }, roll: twist };
    }
    case "two-finger-tap":
      return { curl: twoFingers, offset: { x: 0, y: 0, z: pushes(t, [0.1, 0.4], 0.012, 0.22) }, roll: 0 };
    case "high-five":
      return {
        curl: { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 },
        offset: { x: 0, y: 0, z: pushes(t, [0.12], 0.03, 0.4) },
        roll: 0,
      };
    case "chest-tap": {
      // A light tap, then her hand knocks it aside toward the screen's left; it comes back slowly.
      if (t < chestSwatSeconds) {
        return { curl: twoFingers, offset: { x: 0, y: 0, z: pushes(t, [0.12], 0.01, 0.3) }, roll: 0 };
      }
      const since = t - chestSwatSeconds;
      const away = since < 0.15 ? since / 0.15 : Math.max(0, 1 - (since - 0.15) / 0.9);
      const eased = away * away * (3 - 2 * away);
      return {
        curl: { thumb: 0.3, index: 0.25, middle: 0.3, ring: 0.35, pinky: 0.4 },
        offset: { x: -0.13 * eased, y: -0.03 * eased, z: 0.02 * eased },
        roll: -0.7 * eased,
      };
    }
  }
}
