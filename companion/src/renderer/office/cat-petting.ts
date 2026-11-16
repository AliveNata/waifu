import { crouchAmount, crouchSeconds } from "./alyx-crouch.js";

/**
 * A teammate stopping on the way past Mochi to crouch and stroke her: down beside her, the hand on
 * her back for a few strokes, and back up to carry on. Timed from the moment they stop.
 */

/** Of the teammates who say hello to her in passing, about one in three stops to stroke her too. */
export const petChance = 1 / 3;

/** How long the hand stays on her back. */
export const strokeSeconds = 3;

/** The whole stop: getting down, the strokes, and standing back up. */
export const memberPetSeconds = strokeSeconds + 2 * crouchSeconds;

/** How far from her they crouch, center to center: near enough for the hand to reach her back. */
export const memberPetDistance = 0.3;

/** She has gone this far from where she was, in meters: no longer within reach, so they get up. */
export const petReachSlack = 0.3;

export interface PetPhase {
  /** 0 standing to 1 fully crouched. */
  down: number;
  /** The hand is on her back. */
  stroking: boolean;
  /** Back up and walking on. */
  done: boolean;
}

export function petPhase(seconds: number): PetPhase {
  return {
    down: crouchAmount(seconds, memberPetSeconds),
    stroking: seconds >= crouchSeconds && seconds < crouchSeconds + strokeSeconds,
    done: seconds >= memberPetSeconds,
  };
}

/**
 * Where along her back the hand is, in meters ahead of the middle: slow strokes from the shoulders
 * toward the tail, about one a second.
 */
export function strokeOffset(seconds: number): number {
  return 0.05 * Math.cos(seconds * Math.PI * 2 * 0.9);
}
