import type { FoodKind } from "./office-food.js";

/**
 * Food Alyx orders in: a courier leaves the bag on the mat inside the glass door, Alyx picks it
 * up and carries it to the bar. One order at a time.
 */
export type OrderPhase = "on-the-way" | "at-door" | "in-hand";

export interface FoodOrder {
  kind: FoodKind;
  phase: OrderPhase;
  /** When the courier sets the bag down at the door, in ms. */
  arrivesAt: number;
}

/** From ordering to the bag at the door: long enough to feel like a delivery, short enough to wait for. */
export const courierMs = 12_000;

/** The door opens for the courier this long either side of the drop, so the bag is seen coming in. */
const courierDoorMs = 1_500;

/** A new order, unless one is already on its way or in hand; then that one stands. */
export function orderFood(order: FoodOrder | null, kind: FoodKind, now: number): FoodOrder {
  return order ?? { kind, phase: "on-the-way", arrivesAt: now + courierMs };
}

/** The courier drops the bag at the door once the time is up. */
export function stepOrder(order: FoodOrder | null, now: number): FoodOrder | null {
  if (order?.phase === "on-the-way" && now >= order.arrivesAt) {
    return { ...order, phase: "at-door" };
  }
  return order;
}

/** Alyx takes the bag off the mat. Only a bag that is there can be picked up. */
export function pickUpOrder(order: FoodOrder | null): FoodOrder | null {
  return order?.phase === "at-door" ? { ...order, phase: "in-hand" } : order;
}

/** Leaving first person with the bag in hand sets it back down at the door, so it is not lost. */
export function dropOrder(order: FoodOrder | null): FoodOrder | null {
  return order?.phase === "in-hand" ? { ...order, phase: "at-door" } : order;
}

/** The glass doors stand open while the courier comes in with the bag. */
export function courierAtDoor(order: FoodOrder | null, now: number): boolean {
  return order !== null && order.phase !== "in-hand" && Math.abs(now - order.arrivesAt) < courierDoorMs;
}

/** What the order is doing, for the picker: null when there is none. */
export function orderStatus(order: FoodOrder | null, now: number): string | null {
  if (order === null) {
    return null;
  }
  switch (order.phase) {
    case "on-the-way":
      return `Kurir lagi di jalan, ${Math.max(1, Math.ceil((order.arrivesAt - now) / 1000))} dtk lagi`;
    case "at-door":
      return "Pesanan udah di depan pintu";
    case "in-hand":
      return "Bawa pesanan ke meja bar";
  }
}
