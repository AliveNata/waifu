import type { Errand } from "./office-life.js";

/**
 * Where a member's laptop is during a meeting run: taken from the desk (out of the drawer, or the
 * desk laptop itself folded shut), carried to the table, opened and switched on, then shut down,
 * closed, and carried back.
 */
export interface LaptopView {
  place: "home" | "hand" | "seat";
  /** 0 closed to 1 open: the desk laptop's lid at home, the one at the table while seated. */
  lid: number;
  screenOn: boolean;
  /** 0 shut to 1 pulled out: the drawer under the desk. */
  drawer: number;
}

export interface LaptopInput {
  errand: Errand | null;
  arrived: boolean;
  /** Seconds since arriving at this step. */
  stepElapsed: number;
  /** Seconds left at this step, for packing up before leaving the table. */
  remaining: number;
}

/** Taken out of the drawer, or off the desk, this far into fetching it. */
export const laptopTakeSeconds = 1.2;
/** Put back this far into stowing it. */
export const laptopPutSeconds = 1;
/** At the table: set down, then opened, then switched on. */
const setDownSeconds = 0.6;
const openSeconds = 0.8;
const bootSeconds = 1.8;
/** Before leaving the table: shut down, close the lid, pick it up. */
const shutDownBefore = 2.4;
const closeBefore = 1.6;
const pickUpBefore = 0.5;

const atHome: LaptopView = { place: "home", lid: 1, screenOn: true, drawer: 0 };

function ramp(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

/** The drawer pulled out between `from` and `to` seconds, a moment either side to slide. */
function drawerOpen(seconds: number, from: number, to: number): number {
  return Math.min(ramp((seconds - from) / 0.5), ramp((to - seconds) / 0.5));
}

export function laptopView(input: LaptopInput): LaptopView {
  const t = input.stepElapsed;
  switch (input.errand) {
    case "fetch-laptop":
      if (!input.arrived) {
        return atHome;
      }
      return {
        place: t < laptopTakeSeconds ? "home" : "hand",
        // A desk laptop is folded shut before it is picked up.
        lid: 1 - ramp(t / 1),
        screenOn: false,
        drawer: drawerOpen(t, 0, laptopTakeSeconds + 0.6),
      };
    case "meeting-laptop": {
      if (!input.arrived || t < setDownSeconds || input.remaining < pickUpBefore) {
        return { place: "hand", lid: 0, screenOn: false, drawer: 0 };
      }
      const opened = ramp((t - setDownSeconds) / openSeconds);
      const closing = ramp((input.remaining - pickUpBefore) / (closeBefore - pickUpBefore));
      return {
        place: "seat",
        lid: Math.min(opened, closing),
        screenOn: t >= bootSeconds && input.remaining > shutDownBefore,
        drawer: 0,
      };
    }
    case "stow-laptop":
      if (!input.arrived || t < laptopPutSeconds) {
        return {
          place: "hand",
          lid: 0,
          screenOn: false,
          drawer: input.arrived ? drawerOpen(t, 0, laptopPutSeconds + 0.6) : 0,
        };
      }
      return {
        place: "home",
        lid: ramp((t - laptopPutSeconds) / 1),
        screenOn: t > laptopPutSeconds + 1,
        drawer: drawerOpen(t, 0, laptopPutSeconds + 0.6),
      };
    default:
      return atHome;
  }
}
