/**
 * Food shared on the bar: someone brings a box, people take a piece at a time, and whoever takes
 * the last one bins the empty box. A while later someone goes out for more, never the same food
 * twice in a row.
 */
export type FoodKind = "pizza" | "platter" | "donuts" | "sushi";

export const foodKinds: readonly FoodKind[] = ["pizza", "platter", "donuts", "sushi"];

/** Pieces in a full box. */
export const foodPieces: Record<FoodKind, number> = { pizza: 8, platter: 6, donuts: 6, sushi: 8 };

export interface BarFood {
  /** What is (or was) in the box on the bar; null once the box is binned. */
  kind: FoodKind | null;
  /** Pieces still in the box. */
  left: number;
  /** The box is on the bar, full or empty. */
  boxOnBar: boolean;
  /** When someone may go out for more, in ms; only matters while there is no box on the bar. */
  nextBuyAt: number;
  /** The last food bought, so the next run picks something else. */
  last: FoodKind | null;
}

/** Between an empty box being binned and someone going out for more: 3 to 10 minutes. */
const buyGapMs: readonly [number, number] = [3 * 60_000, 10 * 60_000];

function pickKind(random: () => number, not: FoodKind | null): FoodKind {
  const choices = foodKinds.filter((kind) => kind !== not);
  return choices[Math.floor(random() * choices.length) % choices.length] ?? "pizza";
}

/**
 * The bar when the office opens: half the time there is already food, partly eaten; otherwise
 * someone goes out for some within a few minutes.
 */
export function initialFood(now: number, random: () => number = Math.random): BarFood {
  if (random() < 0.5) {
    const kind = pickKind(random, null);
    const full = foodPieces[kind];
    return {
      kind,
      left: Math.max(2, Math.round(full * (0.4 + 0.6 * random()))),
      boxOnBar: true,
      nextBuyAt: now,
      last: kind,
    };
  }
  return { kind: null, left: 0, boxOnBar: false, nextBuyAt: now + (1 + 3 * random()) * 60_000, last: null };
}

/** Someone may go out for food: nothing on the bar, and the wait is over. */
export function canBuy(food: BarFood, now: number): boolean {
  return !food.boxOnBar && now >= food.nextBuyAt;
}

/** Takes one piece. `emptied` says this was the last, so the taker bins the box. */
export function takePiece(food: BarFood): { food: BarFood; took: boolean; emptied: boolean } {
  if (!food.boxOnBar || food.left <= 0) {
    return { food, took: false, emptied: false };
  }
  const left = food.left - 1;
  return { food: { ...food, left }, took: true, emptied: left === 0 };
}

/** The empty box goes in the bin; the next run out for food is a few minutes away. */
export function binBox(food: BarFood, now: number, random: () => number = Math.random): BarFood {
  const [shortest, longest] = buyGapMs;
  return { ...food, kind: null, left: 0, boxOnBar: false, nextBuyAt: now + shortest + random() * (longest - shortest) };
}

/** Fresh food on the bar, something other than last time. */
export function deliver(food: BarFood, random: () => number = Math.random): BarFood {
  const kind = pickKind(random, food.last);
  return { ...food, kind, left: foodPieces[kind], boxOnBar: true, last: kind };
}
