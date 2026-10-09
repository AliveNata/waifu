import { describe, expect, it } from "vitest";
import { actorActivity, angleDelta, initialActor, stepActor } from "../src/renderer/office/office-actor.js";
import { distance, hub, planPath, stationForMood, stations } from "../src/renderer/office/office-layout.js";

function simulate(seconds: number, desired: Parameters<typeof stepActor>[1], start = initialActor("sofa")) {
  let state = start;
  for (let t = 0; t < seconds; t += 1 / 60) {
    state = stepActor(state, desired, 1 / 60);
  }
  return state;
}

describe("office actor", () => {
  it("routes through the hub between stations", () => {
    // Act
    const path = planPath(stations.sofa.spot, "desk");

    // Assert
    expect(path).toEqual([hub, stations.desk.spot]);
  });

  it("walks to the desk, sits and faces it", () => {
    // Act
    const state = simulate(12, "desk");

    // Assert
    expect(distance(state.position, stations.desk.spot)).toBeLessThan(0.01);
    expect(Math.abs(angleDelta(state.yaw, stations.desk.facing))).toBeLessThan(0.01);
    expect(actorActivity(state)).toEqual({ kind: "station", activity: "sit-type" });
  });

  it("is walking mid-trip", () => {
    // Act
    const state = simulate(1, "whiteboard");

    // Assert
    expect(actorActivity(state).kind).toBe("walk");
  });

  it("re-plans when the mood changes mid-walk", () => {
    // Arrange
    const halfway = simulate(1, "desk");

    // Act
    const state = simulate(12, "front", halfway);

    // Assert
    expect(state.target).toBe("front");
    expect(distance(state.position, stations.front.spot)).toBeLessThan(0.01);
  });

  it("sends each mood to its station", () => {
    expect(stationForMood("working")).toBe("desk");
    expect(stationForMood("thinking")).toBe("whiteboard");
    expect(stationForMood("idle")).toBe("sofa");
    expect(stationForMood("waiting")).toBe("front");
  });

  it.each([
    [0, Math.PI * 1.5, -Math.PI / 2],
    [Math.PI * 0.9, -Math.PI * 0.9, Math.PI * 0.2],
  ])("takes the short way round from %d to %d", (from, to, expected) => {
    expect(angleDelta(from, to)).toBeCloseTo(expected);
  });
});
