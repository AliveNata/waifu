import type { StationId } from "./office-plan.js";

/**
 * Where a member's coffee mug is. Desk owners take their mug from the desk to the pantry and put
 * it back next to the keyboard; people without a desk carry the cup to their next spot and finish
 * it there.
 */
export interface MugState {
  inHand: boolean;
  /** False while the desk mug is away at the pantry or in the owner's hand. */
  onDesk: boolean;
  /** For members without a desk: the spot where they drink it, dropped once they move on. */
  drinkingAt: StationId | null;
}

export interface MugInput {
  /** The member's own desk station, or null for members who work standing at a board. */
  desk: StationId | null;
  target: StationId;
  arrived: boolean;
  /** The station the member just walked away from this frame, if they started a new walk. */
  departedFrom: StationId | null;
}

export const initialMug: MugState = { inHand: false, onDesk: true, drinkingAt: null };

export function stepMug(state: MugState, input: MugInput): MugState {
  let { inHand, onDesk, drinkingAt } = state;
  if (input.target === "coffee" && input.departedFrom !== null && input.departedFrom === input.desk && onDesk) {
    // Leaving the desk for a refill: the mug goes along.
    onDesk = false;
    inHand = true;
  }
  if (input.target === "coffee" && input.arrived) {
    inHand = true;
  }
  if (inHand && input.arrived && input.target !== "coffee") {
    if (input.target === input.desk) {
      inHand = false;
      onDesk = true;
    } else if (input.desk === null && drinkingAt === null) {
      drinkingAt = input.target;
    }
  }
  if (drinkingAt !== null && input.target !== drinkingAt) {
    inHand = false;
    drinkingAt = null;
  }
  return { inHand, onDesk, drinkingAt };
}
