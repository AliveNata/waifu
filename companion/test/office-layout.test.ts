import { describe, expect, it } from "vitest";
import { angleDelta, initialActor, isWalking, stepActor } from "../src/renderer/office/office-actor.js";
import { memberPlan, propForAction, twobPlan, usesHandIk } from "../src/renderer/office/office-director.js";
import { homeStations } from "../src/renderer/office/office-layout.js";
import { OfficeLife } from "../src/renderer/office/office-life.js";
import { bodyRadius, navGrid, planPath } from "../src/renderer/office/office-nav.js";
import { distance, furniture, type Point, room, type StationId, stations } from "../src/renderer/office/office-plan.js";
import { fitSeat, type LegMetrics } from "../src/renderer/office/seating.js";
import { memberIds } from "../src/shared/team.js";

const stationIds = Object.keys(stations) as StationId[];

function simulate(seconds: number, desired: StationId, start = initialActor("desk-twob")) {
  let state = start;
  for (let t = 0; t < seconds; t += 1 / 60) {
    state = stepActor(state, desired, 1 / 60);
  }
  return state;
}

/** Furniture a walking segment would clip, ignoring pieces people step into (seats) and the segment ends. */
function crossesFurniture(a: Point, b: Point): boolean {
  const steps = Math.ceil(distance(a, b) / 0.05);
  for (let step = 1; step < steps; step++) {
    const t = step / steps;
    const point = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    const hit = furniture.some(
      (piece) =>
        piece.blocksWalking &&
        Math.abs(point.x - piece.x) < piece.width / 2 &&
        Math.abs(point.z - piece.z) < piece.depth / 2,
    );
    if (hit) {
      return true;
    }
  }
  return false;
}

const lie = (value: number): LegMetrics => ({
  hipsHeight: 0.4,
  thighJointDrop: 0.03,
  thigh: 0.16,
  shin: value,
  poseUnitsPerMeter: 2,
});

describe("floor plan", () => {
  it.each(stationIds)("keeps the approach to %s on walkable floor", (id) => {
    expect(navGrid.isFree(stations[id].approach)).toBe(true);
  });

  it("keeps every station inside the room", () => {
    for (const id of stationIds) {
      const { spot } = stations[id];
      expect(spot.x).toBeGreaterThan(room.minX + bodyRadius);
      expect(spot.x).toBeLessThan(room.maxX - bodyRadius);
      expect(spot.z).toBeGreaterThan(room.minZ + bodyRadius);
      expect(spot.z).toBeLessThan(room.maxZ - bodyRadius);
    }
  });
});

describe("planPath", () => {
  it.each([
    ["desk-asuna", "sofa-2"],
    ["arcade", "fridge"],
    ["desk-ruby", "rack"],
    ["beanbag-chizuru", "desk-yor"],
    ["front", "bar-left"],
  ] as const)("walks from %s to %s around the furniture", (from, to) => {
    // Act
    const path = planPath(stations[from].spot, to);

    // Assert: the walk between approach points never cuts through a desk, counter or sofa.
    const walking = [stations[from].approach, ...path.slice(0, -2)];
    for (let index = 1; index < walking.length; index++) {
      expect(crossesFurniture(walking[index - 1] as Point, walking[index] as Point)).toBe(false);
    }
    expect(path.at(-1)).toEqual(stations[to].spot);
  });

  it("steps out of a seat over its approach point before walking anywhere", () => {
    // Act
    const path = planPath(stations["desk-asuna"].spot, "coffee");

    // Assert: chairs block walking, so leaving one must go the way the sitter came in.
    expect(path[0]).toEqual(stations["desk-asuna"].approach);
  });

  it("is empty when already at the station", () => {
    expect(planPath(stations.front.spot, "front")).toEqual([]);
  });
});

describe("walking", () => {
  it("walks from her desk to the coffee machine and faces it", () => {
    // Act
    const state = simulate(30, "coffee");

    // Assert
    expect(distance(state.position, stations.coffee.spot)).toBeLessThan(0.01);
    expect(Math.abs(angleDelta(state.yaw, stations.coffee.facing))).toBeLessThan(0.01);
    expect(isWalking(state)).toBe(false);
  });

  it("re-plans when the destination changes mid-walk", () => {
    // Arrange
    const halfway = simulate(2, "sofa-1");

    // Act
    const state = simulate(30, "arcade", halfway);

    // Assert
    expect(distance(state.position, stations.arcade.spot)).toBeLessThan(0.01);
  });

  it("lets two people walking head-on pass each other instead of through each other", () => {
    // Arrange: one walks from the front of the room to the corner plant, the other the opposite way.
    let east = initialActor("front");
    let west = initialActor("plant-corner");
    let closest = Number.POSITIVE_INFINITY;

    // Act
    for (let t = 0; t < 20; t += 1 / 60) {
      const nextEast = stepActor(east, "plant-corner", 1 / 60, [west.position]);
      const nextWest = stepActor(west, "front", 1 / 60, [east.position]);
      east = nextEast;
      west = nextWest;
      closest = Math.min(closest, distance(east.position, west.position));
    }

    // Assert
    expect(closest).toBeGreaterThan(0.3);
    expect(distance(east.position, stations["plant-corner"].spot)).toBeLessThan(0.01);
    expect(distance(west.position, stations.front.spot)).toBeLessThan(0.01);
  });

  it.each([
    [0, Math.PI * 1.5, -Math.PI / 2],
    [Math.PI * 0.9, -Math.PI * 0.9, Math.PI * 0.2],
  ])("takes the short way round from %d to %d", (from, to, expected) => {
    expect(angleDelta(from, to)).toBeCloseTo(expected);
  });
});

describe("fitSeat", () => {
  it("lets short legs dangle from a high stool instead of pushing the feet through the floor", () => {
    // Act
    const fit = fitSeat(lie(0.15), 0.42);

    // Assert: the stool is above the standing hips, so they rise onto it and the feet hang.
    expect(fit.thighLift).toBe(0);
    expect(fit.hipsDrop).toBeCloseTo((0.4 - (0.42 + 0.035 + 0.03)) * 2);
  });

  it("raises the knees on a low seat so the soles stay on the floor", () => {
    // Act
    const fit = fitSeat(lie(0.2), 0.14);

    // Assert: sole height = thigh joint + thigh * sin(lift) - shin = 0.
    const thighJoint = 0.14 + 0.035;
    expect(thighJoint + 0.16 * Math.sin(fit.thighLift) - 0.2).toBeCloseTo(0, 5);
    expect(fit.hipsDrop).toBeCloseTo((0.4 - (thighJoint + 0.03)) * 2);
  });
});

describe("office life", () => {
  function sequence(values: number[]): () => number {
    let index = 0;
    return () => values[index++ % values.length] as number;
  }

  it("never repeats a break activity twice in a row", () => {
    // Arrange
    const life = new OfficeLife(sequence([0.13, 0.71, 0.42, 0.95, 0.05, 0.6, 0.33]));
    let now = 0;
    const history: string[] = [];

    // Act
    for (let turn = 0; turn < 40; turn++) {
      const choice = life.planFor("asuna", now);
      life.arrived("asuna", now);
      history.push(choice.activity);
      now += choice.durationMs + 1;
    }

    // Assert: only the desk may repeat, as the fallback when every break is cooling down.
    for (let index = 1; index < history.length; index++) {
      if (history[index] !== "desk") {
        expect(history[index]).not.toBe(history[index - 1]);
      }
    }
    expect(new Set(history).size).toBeGreaterThan(4);
  });

  it("never seats two members in the same reserved spot", () => {
    // Arrange
    const life = new OfficeLife(sequence([0.2, 0.8, 0.5, 0.1, 0.9, 0.35, 0.65]));

    // Act
    const choices = memberIds.map((memberId) => life.planFor(memberId, 0));

    // Assert
    const shared = choices.filter((choice) => choice.activity !== "desk").map((choice) => choice.station);
    expect(new Set(shared).size).toBe(shared.length);
  });

  it("takes a break after real work instead of going straight back to the desk", () => {
    // Arrange
    const life = new OfficeLife(() => 0);

    // Act
    life.interrupt("kobayashi", 0);
    const choice = life.planFor("kobayashi", 1);

    // Assert
    expect(choice.activity).not.toBe("desk");
  });

  it("carries a fresh coffee back to the desk", () => {
    // Arrange
    const life = new OfficeLife(Math.random);
    let now = 0;
    let previous: string | null = null;
    const afterCoffee: string[] = [];

    // Act
    for (let turn = 0; turn < 300; turn++) {
      const choice = life.planFor("asuna", now);
      life.arrived("asuna", now);
      if (previous === "coffee") {
        afterCoffee.push(choice.activity);
      }
      previous = choice.activity;
      now += choice.durationMs + 1;
    }

    // Assert
    expect(afterCoffee.length).toBeGreaterThan(0);
    expect(new Set(afterCoffee)).toEqual(new Set(["desk"]));
  });

  it("keeps role activities to their owners", () => {
    // Arrange
    const life = new OfficeLife(Math.random);
    let now = 0;

    // Act
    const seen = new Set<string>();
    for (let turn = 0; turn < 200; turn++) {
      const choice = life.planFor("erza", now);
      life.arrived("erza", now);
      seen.add(choice.activity);
      now += choice.durationMs + 1;
    }

    // Assert
    expect(seen.has("selfie")).toBe(false);
    expect(seen.has("rack")).toBe(false);
    expect(seen.size).toBeGreaterThan(4);
  });
});

describe("office director", () => {
  const idle = {
    activity: "tv" as const,
    station: "sofa-2" as const,
    action: "watch" as const,
    durationMs: 1,
    arrivedAt: 0,
    chosenAt: 0,
  };

  it.each([
    ["working", "desk-twob", "type"],
    ["thinking", "board-twob", "draw"],
    ["waiting", "front", "wave"],
  ] as const)("sends 2B to work on %s", (mood, station, action) => {
    expect(twobPlan(mood, idle)).toMatchObject({ station, action });
  });

  it("lets 2B join the break routine when idle", () => {
    expect(twobPlan("idle", idle)).toEqual({ station: "sofa-2", action: "watch", mood: "idle" });
  });

  it("works at the home station and follows the routine when idle", () => {
    expect(memberPlan("asuna", "working", idle)).toEqual({
      station: homeStations.asuna,
      action: "type",
      mood: "working",
    });
    expect(memberPlan("chizuru", "working", null).action).toBe("stick");
    expect(memberPlan("ruby", "idle", idle)).toEqual({ station: "sofa-2", action: "watch", mood: "idle" });
  });

  it.each([
    ["brew", "mug"],
    ["pingpong", "paddle"],
    ["lounge", "phone"],
    ["read", "book"],
    ["type", null],
    [null, null],
  ] as const)("puts the right prop in hand for %s", (action, prop) => {
    expect(propForAction(action)).toBe(prop);
  });

  it("uses hand IK only for board work", () => {
    expect(usesHandIk("draw")).toBe(true);
    expect(usesHandIk("stick")).toBe(true);
    expect(usesHandIk("type")).toBe(false);
  });
});
