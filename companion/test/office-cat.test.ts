import { describe, expect, it } from "vitest";
import { afterMeal, Cat, type CatSpotId, catSpots, nextCatPlan } from "../src/renderer/office/office-cat.js";
import { navGrid } from "../src/renderer/office/office-nav.js";

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const none: ReadonlySet<CatSpotId> = new Set();
/** Nothing special going on: fed, bowl full, no game on. */
const calm = { snacking: false, unavailable: none, hungry: false, bowlFood: 1, rally: false };

describe("Mochi's day", () => {
  it("sleeps on through the night instead of getting up", () => {
    // Act: already asleep on the beanbag at 02:00.
    const random = seeded(4);
    const plans = Array.from({ length: 100 }, () => nextCatPlan("beanbag", 2, random, calm));

    // Assert
    expect(plans.filter((plan) => plan.spot === "beanbag").length).toBeGreaterThan(60);
  });

  it("sleeps on the beanbag most of the night", () => {
    // Arrange
    const random = seeded(3);
    let asleep = 0;

    // Act: what she picks after a spell elsewhere, two hundred times at 22:00.
    for (let turn = 0; turn < 200; turn++) {
      const plan = nextCatPlan("aquarium", 22, random, calm);
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
    const plans = Array.from({ length: 100 }, () => nextCatPlan("beanbag", 11, random, { ...calm, unavailable }));

    // Assert
    expect(plans.some((plan) => plan.spot === "beanbag")).toBe(false);
    expect(plans.some((plan) => plan.spot === "visit" || plan.spot === "aquarium")).toBe(false);
  });

  it("comes to beg when someone is snacking at the fridge", () => {
    // Arrange
    const random = seeded(9);
    const count = (snacking: boolean): number =>
      Array.from({ length: 200 }, () => nextCatPlan("lounge-rug", 13, random, { ...calm, snacking })).filter(
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

describe("Mochi's bowl, naps and ping-pong", () => {
  it("goes to eat when hungry and the bowl has food, and to ask when it is empty", () => {
    // Arrange: a draw that always takes the hungry path.
    const random = () => 0.1;

    // Act
    const eating = nextCatPlan("aquarium", 11, random, { ...calm, hungry: true, bowlFood: 0.6 });
    const asking = nextCatPlan("aquarium", 11, random, { ...calm, hungry: true, bowlFood: 0 });

    // Assert
    expect(eating).toMatchObject({ spot: "bowl", pose: "eat" });
    expect(asking).toMatchObject({ spot: "bowl", pose: "beg" });
  });

  it("takes a third of the bowl per meal, never below empty", () => {
    // Act
    const meals = [afterMeal(1), afterMeal(afterMeal(1)), afterMeal(afterMeal(afterMeal(1))), afterMeal(0)];

    // Assert
    expect(meals[0]).toBeCloseTo(0.66, 2);
    expect(meals[1]).toBeCloseTo(0.32, 2);
    expect(meals[2]).toBe(0);
    expect(meals[3]).toBe(0);
  });

  it("watches ping-pong only while a rally is on", () => {
    // Arrange
    const random = seeded(12);
    const picks = (rally: boolean) =>
      Array.from({ length: 200 }, () => nextCatPlan("aquarium", 15, random, { ...calm, rally })).filter(
        (plan) => plan.spot === "pingpong",
      ).length;

    // Act
    const quiet = picks(false);
    const rally = picks(true);

    // Assert
    expect(quiet).toBe(0);
    expect(rally).toBeGreaterThan(30);
  });

  it("hops up onto a desk by its short leg and settles on the keys at desk height", () => {
    // Arrange: a keyboard on a desk 0.55 m up, reached over a leg at the same height.
    const cat = new Cat("beanbag");
    const target = {
      ...catSpots["lounge-rug"],
      spot: { x: catSpots["lounge-rug"].spot.x + 0.3, z: catSpots["lounge-rug"].spot.z },
      height: 0.575,
      perch: [{ x: catSpots["lounge-rug"].spot.x + 0.15, z: catSpots["lounge-rug"].spot.z, height: 0.55 }],
    };
    const toKeys = () => ({ plan: { spot: "keyboard" as const, pose: "sleep" as const, durationMs: 12_000 }, target });
    cat.update(0.05, 0, toKeys, false, null);
    let now = 46_000;
    cat.update(0.05, now, toKeys, false, null);
    let highest = 0;

    // Act
    for (let frame = 0; frame < 3000 && cat.arrivedAt === null; frame++) {
      now += 50;
      cat.update(0.05, now, toKeys, false, null);
      highest = Math.max(highest, cat.height);
    }
    const later = cat.update(0.05, now + 60_000, toKeys, false, null);

    // Assert: there, up on the desk, and still asleep a minute on: only a lift ends a keyboard nap.
    expect(cat.arrivedAt).not.toBeNull();
    expect(cat.height).toBeCloseTo(0.575, 3);
    expect(highest).toBeLessThanOrEqual(0.575 + 1e-9);
    expect(later).toBe("sleep");
  });

  it("goes where she is carried and picks something new once set down", () => {
    // Arrange
    const cat = new Cat("beanbag");
    const choices: string[] = [];
    const choose = (previous: CatSpotId | null) => {
      choices.push(String(previous));
      return {
        plan: { spot: "aquarium" as const, pose: "stare" as const, durationMs: 60_000 },
        target: catSpots.aquarium,
      };
    };
    cat.update(0.05, 0, choose, false, null);

    // Act
    cat.carry({ x: 1, z: 1 }, 0.3, 0);
    const held = { ...cat.position, height: cat.height };
    cat.update(0.05, 100, choose, false, null);
    cat.land({ x: 2, z: 2 });
    cat.update(0.05, 200, choose, false, null);

    // Assert
    expect(held).toEqual({ x: 1, z: 1, height: 0.3 });
    expect(cat.height).toBe(0);
    expect(choices).toEqual(["beanbag"]);
  });
});
