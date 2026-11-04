import { describe, expect, it } from "vitest";
import {
  courierAtDoor,
  courierMs,
  dropOrder,
  orderFood,
  orderStatus,
  pickUpOrder,
  stepOrder,
} from "../src/renderer/office/alyx-order.js";
import { foodForKey, rememberedFood } from "../src/renderer/office/food-picker.js";
import { foodKinds } from "../src/renderer/office/office-food.js";

describe("Alyx ordering food in", () => {
  it("has the courier drop the bag at the door, then Alyx carries it", () => {
    // Arrange
    const ordered = orderFood(null, "martabak", 1_000);

    // Act
    const early = stepOrder(ordered, 1_000 + courierMs - 1);
    const dropped = stepOrder(ordered, 1_000 + courierMs);
    const carried = pickUpOrder(dropped);

    // Assert
    expect(early?.phase).toBe("on-the-way");
    expect(dropped?.phase).toBe("at-door");
    expect(carried).toEqual({ kind: "martabak", phase: "in-hand", arrivesAt: 1_000 + courierMs });
  });

  it("keeps one order at a time, and nothing to pick up before the bag is there", () => {
    // Arrange
    const first = orderFood(null, "pizza", 0);

    // Act
    const second = orderFood(first, "sushi", 5_000);
    const tooSoon = pickUpOrder(first);

    // Assert
    expect(second).toBe(first);
    expect(tooSoon?.phase).toBe("on-the-way");
  });

  it("puts the bag back at the door when Alyx mode ends with it in hand", () => {
    // Arrange
    const carried = pickUpOrder(stepOrder(orderFood(null, "boba", 0), courierMs));

    // Act
    const dropped = dropOrder(carried);

    // Assert
    expect(dropped?.phase).toBe("at-door");
    expect(dropOrder(null)).toBeNull();
  });

  it("opens the door for the courier only around the drop", () => {
    // Arrange
    const order = orderFood(null, "dimsum", 0);

    // Act + Assert
    expect(courierAtDoor(order, 0)).toBe(false);
    expect(courierAtDoor(order, courierMs - 1_000)).toBe(true);
    expect(courierAtDoor(stepOrder(order, courierMs), courierMs + 1_000)).toBe(true);
    expect(courierAtDoor(stepOrder(order, courierMs), courierMs + 5_000)).toBe(false);
    expect(courierAtDoor(null, 0)).toBe(false);
  });

  it("says how far along the order is", () => {
    // Arrange
    const order = orderFood(null, "chicken", 0);

    // Act + Assert
    expect(orderStatus(null, 0)).toBeNull();
    expect(orderStatus(order, 0)).toBe("Kurir lagi di jalan, 12 dtk lagi");
    expect(orderStatus(stepOrder(order, courierMs), courierMs)).toBe("Pesanan udah di depan pintu");
  });
});

describe("the food list", () => {
  it("picks by number key in list order, and ignores other keys", () => {
    // Act + Assert
    expect(foodForKey("1")).toBe(foodKinds[0]);
    expect(foodForKey("8")).toBe(foodKinds[7]);
    expect(foodForKey("9")).toBeNull();
    expect(foodForKey("0")).toBeNull();
    expect(foodForKey("a")).toBeNull();
  });

  it("remembers the last order, falling back to pizza", () => {
    // Arrange
    const stored = { getItem: () => "dimsum" };
    const junk = { getItem: () => "lasagna" };
    const blocked = {
      getItem: (): string | null => {
        throw new Error("blocked");
      },
    };

    // Act + Assert
    expect(rememberedFood(stored)).toBe("dimsum");
    expect(rememberedFood(junk)).toBe("pizza");
    expect(rememberedFood(null)).toBe("pizza");
    expect(rememberedFood(blocked)).toBe("pizza");
  });
});
