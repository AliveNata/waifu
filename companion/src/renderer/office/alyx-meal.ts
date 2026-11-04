import type { FoodKind } from "./office-food.js";

/**
 * Alyx at the bar: a piece taken from the open box and eaten, and once the box is empty, the box
 * folded into a trash bag and carried to the bin.
 */
export type AlyxMeal = { kind: "eating"; food: FoodKind; startedAt: number } | { kind: "bag" } | null;

/** From taking the piece to the last bite, in seconds. */
export const eatSeconds = 2.6;

/** A bite every so often while eating: the piece gets smaller with each. */
const bites = 3;

/** How much of the piece is left, 1 whole to 0 eaten, `seconds` into eating it. */
export function pieceLeft(seconds: number): number {
  if (seconds <= 0.6) {
    return 1;
  }
  // Lifted for the first 0.6 s, then eaten in bites, each a step down.
  const bitesTaken = Math.min(bites, Math.floor(((seconds - 0.6) / (eatSeconds - 0.6)) * bites) + 1);
  return Math.max(0, 1 - bitesTaken / bites);
}

/** How far the hand is raised to the mouth, 0 down to 1 at the mouth. */
export function eatLift(seconds: number): number {
  if (seconds <= 0 || seconds >= eatSeconds) {
    return 0;
  }
  const k = Math.min(1, seconds / 0.5, (eatSeconds - seconds) / 0.4);
  return k * k * (3 - 2 * k);
}

/** Eating is over once the last bite is gone. `now` and the start are in milliseconds. */
export function stepMeal(meal: AlyxMeal, now: number): AlyxMeal {
  return meal?.kind === "eating" && now - meal.startedAt >= eatSeconds * 1000 ? null : meal;
}
