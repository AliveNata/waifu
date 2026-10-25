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
  flick: { facing: "from-above", anchor: "middle-tip", seconds: 0.7 },
  "double-flick": { facing: "from-above", anchor: "middle-tip", seconds: 1.1 },
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
    case "double-flick": {
      // The middle finger held back by the thumb, then let go; twice for the double.
      const releases = gesture === "flick" ? [0.32] : [0.32, 0.78];
      const loaded = releases.some((at) => t < at && t > at - 0.32);
      const snap = releases.reduce((sum, at) => sum + pulse(t, at, 0.14), 0);
      return {
        curl: { thumb: loaded ? 0.85 : 0.45, index: 0.55, middle: loaded ? 0.95 : 0, ring: 0.6, pinky: 0.65 },
        offset: { x: 0, y: 0.004 * snap, z: -0.008 * snap },
        roll: 0,
      };
    }
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
