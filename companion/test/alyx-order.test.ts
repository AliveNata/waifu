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
import { phoneLines } from "../src/renderer/office/alyx-phone.js";
import { pickedKind, pickerKey, pickerStart, rememberedFood } from "../src/renderer/office/food-picker.js";
import { drinkKinds, foodNames, mealKinds } from "../src/renderer/office/office-food.js";

describe("Alyx ordering food in", () => {
  it("has the courier drop the bag at the door, then Alyx carries it", () => {
    // Arrange
    const ordered = orderFood(null, "waffle", 1_000);

    // Act
    const early = stepOrder(ordered, 1_000 + courierMs - 1);
    const dropped = stepOrder(ordered, 1_000 + courierMs);
    const carried = pickUpOrder(dropped);

    // Assert
    expect(early?.phase).toBe("on-the-way");
    expect(dropped?.phase).toBe("at-door");
    expect(carried).toEqual({ kind: "waffle", phase: "in-hand", arrivesAt: 1_000 + courierMs });
  });

  it("keeps one order at a time, and nothing to pick up before the bag is there", () => {
    // Arrange
    const first = orderFood(null, "pizza", 0);

    // Act
    const second = orderFood(first, "taco", 5_000);
    const tooSoon = pickUpOrder(first);

    // Assert
    expect(second).toBe(first);
    expect(tooSoon?.phase).toBe("on-the-way");
  });

  it("puts the bag back at the door when Alyx mode ends with it in hand", () => {
    // Arrange
    const carried = pickUpOrder(stepOrder(orderFood(null, "soda", 0), courierMs));

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
    const order = orderFood(null, "burger", 0);

    // Act + Assert
    expect(orderStatus(null, 0)).toBeNull();
    expect(orderStatus(order, 0)).toBe("Kurir lagi di jalan, 12 dtk lagi");
    expect(orderStatus(stepOrder(order, courierMs), courierMs)).toBe("Pesanan udah di depan pintu");
  });
});

describe("the order app on Alyx's phone", () => {
  it("orders by number on the tab that shows, and switches tabs with the arrows", () => {
    // Arrange
    const start = pickerStart("pizza");

    // Act
    const meal = pickerKey(start, "2");
    const drinks = pickerKey(start, "ArrowRight");
    const drink = drinks === null ? null : pickerKey(drinks.state, "1");

    // Assert
    expect(start).toEqual({ tab: "meal", selected: 0 });
    expect(meal?.order).toBe(mealKinds[1]);
    expect(drinks?.state).toEqual({ tab: "drink", selected: 0 });
    expect(drink?.order).toBe(drinkKinds[0]);
  });

  it("moves the highlight round the list and orders it with Enter", () => {
    // Arrange
    const start = pickerStart("pizza");

    // Act
    const up = pickerKey(start, "ArrowUp");
    const ordered = up === null ? null : pickerKey(up.state, "Enter");

    // Assert
    expect(up?.state.selected).toBe(mealKinds.length - 1);
    expect(ordered?.order).toBe(mealKinds[mealKinds.length - 1]);
    expect(pickedKind({ tab: "drink", selected: 2 })).toBe(drinkKinds[2]);
  });

  it("opens on the tab of the last order, closes on I or Escape, and ignores numbers past the list", () => {
    // Act + Assert
    expect(pickerStart("coffee")).toEqual({ tab: "drink", selected: drinkKinds.indexOf("coffee") });
    expect(pickerKey(pickerStart("pizza"), "I")?.close).toBe(true);
    expect(pickerKey(pickerStart("pizza"), "Escape")?.close).toBe(true);
    expect(pickerKey({ tab: "drink", selected: 0 }, "9")).toBeNull();
    expect(pickerKey(pickerStart("pizza"), "q")).toBeNull();
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

  it("shows the list with numbers, or the order's progress while one is out", () => {
    // Act
    const choosing = phoneLines({ open: true, state: pickerStart("pizza"), status: null }, "12:30");
    const waiting = phoneLines(
      { open: true, state: pickerStart("pizza"), status: "Kurir lagi di jalan, 5 dtk lagi" },
      "12:30",
    );

    // Assert
    expect(choosing[0]).toBe("12:30");
    expect(choosing).toContain("1 Pizza");
    expect(choosing).toContain(`${mealKinds.length} ${foodNames[mealKinds[mealKinds.length - 1] ?? "pizza"]}`);
    expect(waiting).toContain("Kurir lagi di jalan, 5 dtk lagi");
    expect(waiting.some((line) => line.startsWith("1 "))).toBe(false);
  });
});
