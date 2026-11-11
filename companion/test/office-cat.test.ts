import { describe, expect, it } from "vitest";
import {
  afterMeal,
  Cat,
  type CatSpotId,
  catSpots,
  hopHeight,
  keyboardLiftPath,
  nextCatPlan,
} from "../src/renderer/office/office-cat.js";
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
    // Arrange: down off the beanbag and walking the floor on her way somewhere.
    const cat = new Cat("beanbag");
    cat.update(0.05, 0, toAquarium, false, null);
    let now = 46_000;
    for (let frame = 0; frame < 40; frame++) {
      now += 50;
      cat.update(0.05, now, toAquarium, false, null);
    }
    const before = { ...cat.position };

    // Act
    const pose = cat.update(0.5, now + 500, toAquarium, true, 0);

    // Assert
    expect(cat.height).toBe(0);
    expect(cat.position).toEqual(before);
    expect(pose).toBe("sit");
  });

  it("finishes a hop before stopping to be stroked, never stuck inside the cushion", () => {
    // Arrange: just off the beanbag, mid-hop down.
    const cat = new Cat("beanbag");
    cat.update(0.05, 0, toAquarium, false, null);
    cat.update(0.05, 46_000, toAquarium, false, null);
    cat.update(0.1, 46_100, toAquarium, false, null);
    const midHop = cat.height;

    // Act: held from here on.
    let now = 46_100;
    for (let frame = 0; frame < 40; frame++) {
      now += 50;
      cat.update(0.05, now, toAquarium, true, 0);
    }

    // Assert
    expect(midHop).toBeGreaterThan(0);
    expect(cat.height).toBe(0);
  });

  it("jumps clear of the cushion onto the beanbag instead of ramping through it", () => {
    // Arrange: from the floor at the edge to the spot on the cushion.
    const edge = catSpots.beanbag.perch?.[0];
    const spot = catSpots.beanbag.spot;
    const across = edge === undefined ? 0 : Math.hypot(edge.x - spot.x, edge.z - spot.z);

    // Act + Assert: at each point along the hop she is above the cushion's rounded top.
    expect(edge?.height).toBe(0);
    for (const done of [0.2, 0.4, 0.6, 0.8]) {
      const fromCenter = 0.12 + across * (1 - done);
      const cushion = fromCenter >= 0.34 ? 0 : 0.17 * (0.5 + 0.5 * Math.sqrt(1 - (fromCenter / 0.34) ** 2));
      expect(hopHeight(0, catSpots.beanbag.height, done), `at ${done}`).toBeGreaterThan(cushion);
    }
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

describe("keyboardLiftPath", () => {
  // A back-row desk: keys 0.345 m in front of the seat, set down beside the chair 0.55 m to its left.
  const from = { x: 0, z: -4.265, height: 0.575 };
  const to = { x: -0.55, z: -3.92 };
  const seat = { x: 0, z: -3.92 };
  // She faces the chair, toward +z.
  const facing = 0;
  const samples = Array.from({ length: 101 }, (_, index) => keyboardLiftPath(from, to, facing, index / 100));

  it("starts on the keys and ends on the floor beside the chair", () => {
    // Act
    const start = keyboardLiftPath(from, to, facing, 0);
    const end = keyboardLiftPath(from, to, facing, 1);

    // Assert
    expect(start.x).toBeCloseTo(from.x);
    expect(start.z).toBeCloseTo(from.z);
    expect(start.height).toBeCloseTo(from.height);
    expect(end.x).toBeCloseTo(to.x);
    expect(end.z).toBeCloseTo(to.z);
    expect(end.height).toBeCloseTo(0);
  });

  it("goes sideways over the desk before coming toward the chair", () => {
    // Act
    const halfway = keyboardLiftPath(from, to, facing, 0.5);

    // Assert: all the way across, none of the way toward the chair yet, and above the keys.
    expect(halfway.x).toBeCloseTo(to.x);
    expect(halfway.z).toBeCloseTo(from.z);
    expect(halfway.height).toBeGreaterThan(from.height);
  });

  it("never passes through the lap of whoever sits in the chair", () => {
    // Arrange: off the desk, past its front edge, and lower than a seated chest, about 0.6 m up.
    const edgeZ = -4.15;
    const offDeskAndLow = samples.filter((point) => point.z > edgeZ && point.height < 0.6);

    // Act
    const nearest = Math.min(...offDeskAndLow.map((point) => Math.hypot(point.x - seat.x, point.z - seat.z)));

    // Assert: clear of the knees, which reach about 0.3 m out from the seat's middle. The old
    // straight line came within 0.3 m, right over the left knee.
    expect(nearest).toBeGreaterThan(0.45);
  });

  it("stays above the desk until she is past its front edge", () => {
    // Arrange: the desk's front edge, 0.115 m in front of the keys.
    const edgeZ = -4.15;

    // Act
    const overDesk = samples.filter((point) => point.z < edgeZ);

    // Assert
    for (const point of overDesk) {
      expect(point.height).toBeGreaterThanOrEqual(from.height - 1e-9);
    }
  });
});
