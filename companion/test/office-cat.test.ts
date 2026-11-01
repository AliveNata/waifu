import { describe, expect, it } from "vitest";
import { Cat, type CatSpotId, catSpots, nextCatPlan } from "../src/renderer/office/office-cat.js";
import { navGrid } from "../src/renderer/office/office-nav.js";

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const none: ReadonlySet<CatSpotId> = new Set();

describe("Mochi's day", () => {
  it("sleeps on through the night instead of getting up", () => {
    // Act: already asleep on the beanbag at 02:00.
    const random = seeded(4);
    const plans = Array.from({ length: 100 }, () =>
      nextCatPlan("beanbag", 2, random, { snacking: false, unavailable: none }),
    );

    // Assert
    expect(plans.filter((plan) => plan.spot === "beanbag").length).toBeGreaterThan(60);
  });

  it("sleeps on the beanbag most of the night", () => {
    // Arrange
    const random = seeded(3);
    let asleep = 0;

    // Act: what she picks after a spell elsewhere, two hundred times at 22:00.
    for (let turn = 0; turn < 200; turn++) {
      const plan = nextCatPlan("aquarium", 22, random, { snacking: false, unavailable: none });
      if (plan.spot === "beanbag" && plan.pose === "sleep") {
        asleep += 1;
      }
    }

    // Assert
    expect(asleep / 200).toBeGreaterThan(0.6);
  });

  it("never goes back to the spot she just left, nor to one she cannot use", () => {
    // Arrange
    const random = seeded(5);
    const unavailable = new Set<CatSpotId>(["visit", "aquarium"]);

    // Act
    const plans = Array.from({ length: 100 }, () =>
      nextCatPlan("beanbag", 11, random, { snacking: false, unavailable }),
    );

    // Assert
    expect(plans.some((plan) => plan.spot === "beanbag")).toBe(false);
    expect(plans.some((plan) => plan.spot === "visit" || plan.spot === "aquarium")).toBe(false);
  });

  it("comes to beg when someone is snacking at the fridge", () => {
    // Arrange
    const random = seeded(9);
    const count = (snacking: boolean): number =>
      Array.from({ length: 200 }, () => nextCatPlan("lounge-rug", 13, random, { snacking, unavailable: none })).filter(
        (plan) => plan.spot === "fridge",
      ).length;

    // Act
    const quiet = count(false);
    const snacking = count(true);

    // Assert
    expect(snacking).toBeGreaterThan(quiet * 3);
  });

  it("has every spot of hers reachable on open floor", () => {
    for (const [id, spot] of Object.entries(catSpots)) {
      expect(navGrid.isFree(spot.approach), id).toBe(true);
    }
  });
});

describe("Mochi moving about", () => {
  const toAquarium = () => ({
    plan: { spot: "aquarium" as const, pose: "stare" as const, durationMs: 60_000 },
    target: catSpots.aquarium,
  });

  it("hops down from the beanbag, walks over and settles to watch the fish", () => {
    // Arrange
    // She starts asleep for a while before her first plan.
    const cat = new Cat("beanbag");
    cat.update(0.05, 0, toAquarium, false, null);
    let now = 46_000;
    let pose = cat.update(0.05, now, toAquarium, false, null);

    // Act: two minutes of frames, plenty to cross the room.
    for (let frame = 0; frame < 2400 && cat.arrivedAt === null; frame++) {
      now += 50;
      pose = cat.update(0.05, now, toAquarium, false, null);
    }

    // Assert
    expect(cat.arrivedAt).not.toBeNull();
    expect(pose).toBe("stare");
    expect(cat.height).toBe(0);
    expect(
      Math.hypot(cat.position.x - catSpots.aquarium.spot.x, cat.position.z - catSpots.aquarium.spot.z),
    ).toBeLessThan(0.01);
  });

  it("stays put while held, as while being stroked", () => {
    // Arrange: on her way somewhere.
    const cat = new Cat("beanbag");
    cat.update(0.05, 0, toAquarium, false, null);
    cat.update(0.05, 46_000, toAquarium, false, null);
    cat.update(0.5, 46_500, toAquarium, false, null);
    const before = { ...cat.position };

    // Act
    const pose = cat.update(0.5, 47_000, toAquarium, true, 0);

    // Assert
    expect(cat.position).toEqual(before);
    expect(pose).toBe("sit");
  });
});
