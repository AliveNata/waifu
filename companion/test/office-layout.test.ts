import { describe, expect, it } from "vitest";
import { angleDelta, initialActor, isWalking, stepActor } from "../src/renderer/office/office-actor.js";
import { memberPlan, usesHandIk, xenoviaPlan } from "../src/renderer/office/office-director.js";
import { distance, laneCorner, planPath, type StationId, stations } from "../src/renderer/office/office-layout.js";

function simulate(seconds: number, desired: StationId, start = initialActor("sofa")) {
  let state = start;
  for (let t = 0; t < seconds; t += 1 / 60) {
    state = stepActor(state, desired, 1 / 60);
  }
  return state;
}

describe("planPath", () => {
  it("turns at the lane corner when going from the left-wall lane to the desk row lane", () => {
    // Act
    const path = planPath(stations.sofa.spot, "desk-xenovia");

    // Assert
    expect(path).toContainEqual(laneCorner);
    expect(path.at(-1)).toEqual(stations["desk-xenovia"].spot);
  });

  it("stays on one lane between stations on the same wall", () => {
    // Act
    const path = planPath(stations["board-xenovia"].spot, "sofa");

    // Assert
    expect(path).not.toContainEqual(laneCorner);
  });

  it("is empty when already at the station", () => {
    expect(planPath(stations.front.spot, "front")).toEqual([]);
  });
});

describe("Xenovia walking", () => {
  it("walks from the sofa to her desk and faces it", () => {
    // Act
    const state = simulate(20, "desk-xenovia");

    // Assert
    expect(distance(state.position, stations["desk-xenovia"].spot)).toBeLessThan(0.01);
    expect(Math.abs(angleDelta(state.yaw, stations["desk-xenovia"].facing))).toBeLessThan(0.01);
    expect(isWalking(state)).toBe(false);
  });

  it("re-plans when the mood changes mid-walk", () => {
    // Arrange
    const halfway = simulate(2, "desk-xenovia");

    // Act
    const state = simulate(20, "board-xenovia", halfway);

    // Assert
    expect(distance(state.position, stations["board-xenovia"].spot)).toBeLessThan(0.01);
  });

  it.each([
    [0, Math.PI * 1.5, -Math.PI / 2],
    [Math.PI * 0.9, -Math.PI * 0.9, Math.PI * 0.2],
  ])("takes the short way round from %d to %d", (from, to, expected) => {
    expect(angleDelta(from, to)).toBeCloseTo(expected);
  });
});

describe("office director", () => {
  it.each([
    ["working", "desk-xenovia", "type"],
    ["thinking", "board-xenovia", "draw"],
    ["idle", "sofa", "relax"],
    ["waiting", "front", "wave"],
  ] as const)("sends Xenovia to work on %s", (mood, station, action) => {
    expect(xenoviaPlan(mood)).toMatchObject({ station, action });
  });

  it("keeps members at their own station and switches action by behavior", () => {
    expect(memberPlan("asuna", "working")).toEqual({ station: "desk-asuna", action: "type", mood: "working" });
    expect(memberPlan("robin", "idle").action).toBe("read");
    expect(memberPlan("chizuru", "working").action).toBe("stick");
  });

  it("uses hand IK only for board work", () => {
    expect(usesHandIk("draw")).toBe(true);
    expect(usesHandIk("stick")).toBe(true);
    expect(usesHandIk("type")).toBe(false);
  });
});
