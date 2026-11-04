import { describe, expect, it } from "vitest";
import type { FoodOrder } from "../src/renderer/office/alyx-order.js";
import {
  type CourierVisit,
  courierHolding,
  courierPatienceMs,
  courierWaiting,
  courierWalk,
  stepCourier,
} from "../src/renderer/office/courier-visit.js";
import { walkSpeed } from "../src/renderer/office/office-actor.js";
import { doorwayLength } from "../src/renderer/office/office-doorway.js";
import { doorwayPath } from "../src/renderer/office/office-plan.js";

const arrivesAt = 100_000;
const onTheWay: FoodOrder = { kind: "pizza", phase: "on-the-way", arrivesAt };
const atDoor: FoodOrder = { ...onTheWay, phase: "at-door" };
const inHand: FoodOrder = { ...onTheWay, phase: "in-hand" };
const coming: CourierVisit = { kind: "pizza", arrivesAt, leftAt: null };
const walkInMs = (doorwayLength / walkSpeed) * 1000;

describe("stepCourier", () => {
  it("starts a visit for an order on its way, with its food and arrival", () => {
    // Act
    const visit = stepCourier(null, onTheWay, arrivesAt - 5000);

    // Assert
    expect(visit).toEqual(coming);
  });

  it("starts nothing without an order", () => {
    // Act
    const visit = stepCourier(null, null, arrivesAt);

    // Assert
    expect(visit).toBeNull();
  });

  it("keeps waiting while the order is at the door", () => {
    // Act
    const visit = stepCourier(coming, atDoor, arrivesAt + 10_000);

    // Assert
    expect(visit).toEqual(coming);
  });

  it("leaves the moment Alyx takes the order", () => {
    // Arrange
    const now = arrivesAt + 8000;

    // Act
    const visit = stepCourier(coming, inHand, now);

    // Assert
    expect(visit?.leftAt).toBe(now);
  });

  it("gives up after waiting too long, leaving at the end of its patience", () => {
    // Act
    const visit = stepCourier(coming, atDoor, arrivesAt + courierPatienceMs + 3000);

    // Assert
    expect(visit?.leftAt).toBe(arrivesAt + courierPatienceMs);
  });

  it("ends once the courier is round the turn on the way out", () => {
    // Arrange
    const leaving: CourierVisit = { ...coming, leftAt: arrivesAt + 1000 };

    // Act
    const visit = stepCourier(leaving, null, arrivesAt + 1000 + walkInMs + 2000);

    // Assert
    expect(visit).toBeNull();
  });
});

describe("courierWalk", () => {
  it("is out of sight before the walk in starts", () => {
    // Act
    const walk = courierWalk(coming, arrivesAt - walkInMs - 500);

    // Assert
    expect(walk.gone).toBe(true);
  });

  it("is in the hall, walking, partway through the walk in", () => {
    // Act
    const walk = courierWalk(coming, arrivesAt - walkInMs / 2);

    // Assert
    expect(walk.gone).toBe(false);
    expect(walk.walking).toBe(true);
  });

  it("stands at the door spot, still, from the arrival on", () => {
    // Act
    const walk = courierWalk(coming, arrivesAt + 20_000);

    // Assert
    expect(walk.position.x).toBeCloseTo(doorwayPath[0]?.x ?? Number.NaN);
    expect(walk.position.z).toBeCloseTo(doorwayPath[0]?.z ?? Number.NaN);
    expect(walk.walking).toBe(false);
  });

  it("turns round before walking back out", () => {
    // Arrange
    const leaving: CourierVisit = { ...coming, leftAt: arrivesAt + 5000 };
    const waiting = courierWalk(coming, arrivesAt + 5000);

    // Act
    const turning = courierWalk(leaving, arrivesAt + 5250);
    const out = courierWalk(leaving, arrivesAt + 7000);

    // Assert
    expect(turning.walking).toBe(false);
    expect(turning.yaw).not.toBeCloseTo(waiting.yaw);
    expect(out.walking).toBe(true);
  });
});

describe("courierHolding and courierWaiting", () => {
  it("holds the order in and while waiting, but waits only once arrived", () => {
    // Act and Assert
    expect(courierHolding(coming)).toBe(true);
    expect(courierWaiting(coming, arrivesAt - 1000)).toBe(false);
    expect(courierWaiting(coming, arrivesAt)).toBe(true);
  });

  it("holds nothing once leaving", () => {
    // Arrange
    const leaving: CourierVisit = { ...coming, leftAt: arrivesAt };

    // Act and Assert
    expect(courierHolding(leaving)).toBe(false);
    expect(courierWaiting(leaving, arrivesAt + 1000)).toBe(false);
  });
});
