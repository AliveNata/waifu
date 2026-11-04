/**
 * Food shared on the bar: someone brings a box, people take a piece at a time, and whoever takes
 * the last one bins the empty box. A while later someone goes out for more, never the same food
 * twice in a row. Alyx can order in too; what Alyx brings stays shut until Alyx opens it.
 */
export type FoodKind =
  | "pizza"
  | "taco"
  | "sandwich"
  | "burger"
  | "dimsum"
  | "waffle"
  | "cookies"
  | "platter"
  | "soda"
  | "frappe"
  | "coffee"
  | "carton";

/** Food to eat, in the order the order list shows it. */
export const mealKinds: readonly FoodKind[] = [
  "pizza",
  "taco",
  "sandwich",
  "burger",
  "dimsum",
  "waffle",
  "cookies",
  "platter",
];

/** Drinks, one each, in the order the order list shows them. */
export const drinkKinds: readonly FoodKind[] = ["soda", "frappe", "coffee", "carton"];

export const foodKinds: readonly FoodKind[] = [...mealKinds, ...drinkKinds];

/** Pieces in a full box: slices or one each, and one cup or can each for the drinks. */
export const foodPieces: Record<FoodKind, number> = {
  pizza: 8,
  taco: 6,
  sandwich: 4,
  burger: 6,
  dimsum: 8,
  waffle: 6,
  cookies: 8,
  platter: 6,
  soda: 6,
  frappe: 4,
  coffee: 4,
  carton: 6,
};

/** What each one is called on screen. */
export const foodNames: Record<FoodKind, string> = {
  pizza: "Pizza",
  taco: "Taco",
  sandwich: "Sandwich",
  burger: "Burger",
  dimsum: "Dimsum",
  waffle: "Waffle",
  cookies: "Cookies",
  platter: "Platter keju",
  soda: "Soda kaleng",
  frappe: "Es kopi",
  coffee: "Kopi panas",
  carton: "Susu kotak",
};

export interface BarFood {
  /** What is (or was) in the box on the bar; null once the box is binned. */
  kind: FoodKind | null;
  /** Pieces still in the box. */
  left: number;
  /** The box is on the bar, full or empty. */
  boxOnBar: boolean;
  /** Opened, so people can help themselves. Whoever goes out opens it as they set it down. */
  open: boolean;
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
      open: true,
      nextBuyAt: now,
      last: kind,
    };
  }
  return {
    kind: null,
    left: 0,
    boxOnBar: false,
    open: false,
    nextBuyAt: now + (1 + 3 * random()) * 60_000,
    last: null,
  };
}

/** Someone may go out for food: nothing on the bar, and the wait is over. */
export function canBuy(food: BarFood, now: number): boolean {
  return !food.boxOnBar && now >= food.nextBuyAt;
}

/** Pieces anyone can take right now: none while the box is shut. */
export function piecesOnOffer(food: BarFood): number {
  return food.boxOnBar && food.open ? food.left : 0;
}

/** Takes one piece. `emptied` says this was the last, so the taker bins the box. */
export function takePiece(food: BarFood): { food: BarFood; took: boolean; emptied: boolean } {
  if (piecesOnOffer(food) <= 0) {
    return { food, took: false, emptied: false };
  }
  const left = food.left - 1;
  return { food: { ...food, left }, took: true, emptied: left === 0 };
}

/** The empty box goes in the bin; the next run out for food is a few minutes away. */
export function binBox(food: BarFood, now: number, random: () => number = Math.random): BarFood {
  const [shortest, longest] = buyGapMs;
  return {
    ...food,
    kind: null,
    left: 0,
    boxOnBar: false,
    open: false,
    nextBuyAt: now + shortest + random() * (longest - shortest),
  };
}

/** Fresh food on the bar, something other than last time, opened as it is set down. */
export function deliver(food: BarFood, random: () => number = Math.random): BarFood {
  // Alyx's order got there first: the box on the bar stays, and this lot goes round by hand.
  if (food.boxOnBar) {
    return food;
  }
  const kind = pickKind(random, food.last);
  return { ...food, kind, left: foodPieces[kind], boxOnBar: true, open: true, last: kind };
}

/** Alyx's order set down on the bar, still shut. Only onto an empty bar: null while food is there. */
export function setDownOrder(food: BarFood, kind: FoodKind): BarFood | null {
  if (food.boxOnBar) {
    return null;
  }
  return { ...food, kind, left: foodPieces[kind], boxOnBar: true, open: false, last: kind };
}

/** Opens the box on the bar, so people can help themselves. */
export function openBox(food: BarFood): BarFood {
  return food.boxOnBar ? { ...food, open: true } : food;
}
