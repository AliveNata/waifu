import type { FoodOrder } from "./alyx-order.js";
import { angleDelta, strideRadiansPerMeter, walkSpeed } from "./office-actor.js";
import { doorwayAlong, doorwayLength } from "./office-doorway.js";
import type { FoodKind } from "./office-food.js";
import type { Point } from "./office-plan.js";

/**
 * The courier, when there is a model for one: walks in along the hall with the order, timed to
 * reach the door spot as it arrives, waits there for Alyx to take it, then walks back out.
 */
export interface CourierVisit {
  kind: FoodKind;
  /** When the courier reaches the door spot, in ms: the order's own arrival. */
  arrivesAt: number;
  /** When the courier turned to go, in ms, or null while still bringing or holding the order. */
  leftAt: number | null;
}

/**
 * How long the courier waits for Alyx before leaving the order on the mat and going. Alyx may
 * have left first person, and nobody else picks it up, so the courier cannot wait forever.
 */
export const courierPatienceMs = 45_000;

/** Turning round from the room to the door before walking off. */
const turnSeconds = 0.5;

/**
 * The visit for this frame. One starts with an order on its way, ends once the courier is round
 * the turn after leaving, and the courier leaves when the order is taken or after waiting too long.
 */
export function stepCourier(visit: CourierVisit | null, order: FoodOrder | null, now: number): CourierVisit | null {
  if (visit === null) {
    return order?.phase === "on-the-way" ? { kind: order.kind, arrivesAt: order.arrivesAt, leftAt: null } : null;
  }
  if (visit.leftAt !== null) {
    return courierWalk(visit, now).gone ? null : visit;
  }
  if (order === null || order.phase === "in-hand") {
    return { ...visit, leftAt: Math.max(now, visit.arrivesAt) };
  }
  const giveUpAt = visit.arrivesAt + courierPatienceMs;
  return now >= giveUpAt ? { ...visit, leftAt: giveUpAt } : visit;
}

/** Whether the courier still has the order in hand: on the way in or waiting at the door. */
export function courierHolding(visit: CourierVisit | null): boolean {
  return visit !== null && visit.leftAt === null;
}

/** Whether the courier is waiting at the door spot for Alyx to take the order. */
export function courierWaiting(visit: CourierVisit | null, now: number): boolean {
  return courierHolding(visit) && visit !== null && now >= visit.arrivesAt;
}

export interface CourierWalk {
  position: Point;
  yaw: number;
  walking: boolean;
  walkPhase: number;
  /** Out of sight round the turn at the end of the hall: not yet in, or already gone. */
  gone: boolean;
}

/** Where the courier is and which way they face at `now`, from the visit's own times. */
export function courierWalk(visit: CourierVisit, now: number): CourierWalk {
  if (visit.leftAt === null) {
    // Coming in: the hall walked backwards in time from the door spot, facing the room.
    const distance = Math.min(doorwayLength, Math.max(0, ((visit.arrivesAt - now) / 1000) * walkSpeed));
    const { position, heading } = doorwayAlong(distance);
    return {
      position,
      yaw: heading + Math.PI,
      walking: distance > 0 && distance < doorwayLength,
      walkPhase: distance * strideRadiansPerMeter,
      gone: distance >= doorwayLength,
    };
  }
  // Going: a turn on the spot toward the door, then out the way they came.
  const seconds = Math.max(0, (now - visit.leftAt) / 1000);
  const distance = Math.min(doorwayLength, Math.max(0, seconds - turnSeconds) * walkSpeed);
  const { position, heading } = doorwayAlong(distance);
  const facingRoom = doorwayAlong(0).heading + Math.PI;
  const turned = Math.min(1, seconds / turnSeconds);
  return {
    position,
    yaw: distance > 0 ? heading : facingRoom + angleDelta(facingRoom, heading) * turned,
    walking: distance > 0 && distance < doorwayLength,
    walkPhase: distance * strideRadiansPerMeter,
    gone: distance >= doorwayLength,
  };
}
