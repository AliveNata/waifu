import { describe, expect, it } from "vitest";
import {
  type BarFood,
  binBox,
  canBuy,
  deliver,
  foodPieces,
  initialFood,
  takePiece,
} from "../src/renderer/office/office-food.js";

const fullPizza: BarFood = { kind: "pizza", left: 8, boxOnBar: true, nextBuyAt: 0, last: "pizza" };

describe("food on the bar", () => {
  it("is eaten one piece at a time, and the last piece empties the box", () => {
    // Arrange
    let food: BarFood = { ...fullPizza, left: 2 };

    // Act
    const first = takePiece(food);
    food = first.food;
    const last = takePiece(food);

    // Assert
    expect(first).toMatchObject({ took: true, emptied: false });
    expect(first.food.left).toBe(1);
    expect(last).toMatchObject({ took: true, emptied: true });
    expect(last.food.left).toBe(0);
  });

  it("has nothing to take from an empty or binned box", () => {
    // Arrange
    const empty: BarFood = { ...fullPizza, left: 0 };
    const binned = binBox(fullPizza, 0, () => 0);

    // Act
    const fromEmpty = takePiece(empty);
    const fromBinned = takePiece(binned);

    // Assert
    expect(fromEmpty.took).toBe(false);
    expect(fromBinned.took).toBe(false);
  });

  it("waits 3 to 10 minutes after the box is binned before anyone goes out for more", () => {
    // Arrange
    const now = 1_000_000;

    // Act
    const soonest = binBox(fullPizza, now, () => 0);
    const latest = binBox(fullPizza, now, () => 0.999_999);

    // Assert
    expect(soonest.boxOnBar).toBe(false);
    expect(soonest.nextBuyAt - now).toBe(3 * 60_000);
    expect(latest.nextBuyAt - now).toBeLessThanOrEqual(10 * 60_000);
    expect(latest.nextBuyAt - now).toBeGreaterThan(9.9 * 60_000);
    expect(canBuy(soonest, now)).toBe(false);
    expect(canBuy(soonest, now + 3 * 60_000)).toBe(true);
  });

  it("never buys the same food twice in a row, and brings a full box", () => {
    // Arrange
    const binned = binBox(fullPizza, 0, () => 0);

    // Act
    const kinds = [0, 0.3, 0.6, 0.99].map((roll) => deliver(binned, () => roll));

    // Assert
    for (const food of kinds) {
      expect(food.kind).not.toBe("pizza");
      expect(food.boxOnBar).toBe(true);
      expect(food.left).toBe(foodPieces[food.kind ?? "pizza"]);
      expect(food.last).toBe(food.kind);
    }
  });

  it("opens with food partly eaten on the bar, or with a run out for some coming soon", () => {
    // Arrange
    const rolls = (values: number[]) => {
      let index = 0;
      return () => values[index++ % values.length] ?? 0;
    };

    // Act
    const withFood = initialFood(0, rolls([0.2, 0.5, 0.5]));
    const without = initialFood(0, rolls([0.8, 0.5]));

    // Assert
    expect(withFood.boxOnBar).toBe(true);
    expect(withFood.left).toBeGreaterThanOrEqual(2);
    expect(withFood.left).toBeLessThanOrEqual(foodPieces[withFood.kind ?? "pizza"]);
    expect(without.boxOnBar).toBe(false);
    expect(without.nextBuyAt).toBeGreaterThanOrEqual(60_000);
    expect(without.nextBuyAt).toBeLessThanOrEqual(4 * 60_000);
  });
});
