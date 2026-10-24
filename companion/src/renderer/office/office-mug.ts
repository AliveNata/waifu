import type { OfficeAction } from "./office-director.js";
import type { Errand } from "./office-life.js";
import type { StationId } from "./office-plan.js";

/**
 * A member's own mug: on their desk, in their hand, or washed and drying upside down on the rack
 * by the sink. It empties a sip at a time, gets filled at the coffee machine, and an empty one is
 * either refilled or washed up.
 */
export interface MugState {
  place: "desk" | "hand" | "rack";
  /** 0 empty to 1 full. */
  level: number;
}

export interface MugInput {
  /** The member's own desk station. */
  desk: StationId;
  /** Where the member is going, or is. */
  station: StationId;
  arrived: boolean;
  errand: Errand | null;
  action: OfficeAction | null;
  /** Seconds since the current action began, which is when the member arrived. */
  actionElapsed: number;
}

/** The hand reaches the mug this long after the reach starts, and takes it. */
export const mugPickSeconds = 0.8;
/** The machine has filled the cup this long into brewing. */
export const brewSeconds = 3;
/** Washed and rinsed this long into washing up; then it goes on the rack. */
export const washSeconds = 4;
/** One sip's worth of a full mug. */
const sip = 0.25;

export function initialMug(level: number): MugState {
  return { place: "desk", level: Math.min(1, Math.max(0, level)) };
}

export function stepMug(state: MugState, input: MugInput): MugState {
  if (!input.arrived) {
    return state;
  }
  const { place } = state;
  const late = input.actionElapsed;
  if (input.errand === "get-mug" && place === "desk" && late >= mugPickSeconds) {
    return { ...state, place: "hand" };
  }
  if (input.errand === "rack-mug" && place === "rack" && late >= mugPickSeconds) {
    return { ...state, place: "hand" };
  }
  if (input.action === "brew" && place === "hand" && late >= brewSeconds && state.level < 1) {
    return { ...state, level: 1 };
  }
  if (input.errand === "wash-mug" && place === "hand" && late >= washSeconds) {
    return { place: "rack", level: 0 };
  }
  // Back at the desk with it, whether after a coffee or called to work: down it goes.
  if (input.station === input.desk && place === "hand" && input.errand !== "get-mug") {
    return { ...state, place: "desk" };
  }
  return state;
}

export function afterSip(state: MugState): MugState {
  return { ...state, level: Math.max(0, state.level - sip) };
}
