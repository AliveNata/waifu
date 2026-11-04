import { describe, expect, it } from "vitest";
import {
  doorOpenPause,
  doorwayLength,
  doorwayReturnSeconds,
  doorwayWalk,
} from "../src/renderer/office/office-doorway.js";
import { doorwayPath, entryHall, room, stations } from "../src/renderer/office/office-plan.js";

describe("walking out through the door", () => {
  it("starts at the door spot and ends round the turn at the end of the hall", () => {
    // Arrange
    const start = doorwayPath[0];
    const end = doorwayPath[doorwayPath.length - 1];

    // Assert
    expect(start).toEqual(stations.door.spot);
    expect(end?.x).toBeGreaterThan(entryHall.turn.from);
    expect(end?.x).toBeLessThan(entryHall.turn.to);
    // Past the hall's north wall, so the room's own wall hides whoever stands there.
    expect(end?.z).toBeGreaterThan(entryHall.z + entryHall.width / 2);
    expect(end?.z).toBeLessThan(entryHall.turn.zTo);
  });

  it("waits for the doors, walks the hall, and is gone once round the turn", () => {
    // Act
    const waiting = doorwayWalk(doorOpenPause / 2, 60);
    const halfway = doorwayWalk(doorOpenPause + doorwayLength / 2, 60);
    const gone = doorwayWalk(doorOpenPause + doorwayLength + 1, 60);

    // Assert
    expect(waiting).toMatchObject({ walking: false, gone: false, position: stations.door.spot });
    expect(halfway.walking).toBe(true);
    expect(halfway.gone).toBe(false);
    expect(halfway.position.x).toBeGreaterThan(room.maxX);
    expect(gone).toMatchObject({ walking: false, gone: true });
  });

  it("walks back in to the door spot as the step ends, facing the room", () => {
    // Act
    const comingBack = doorwayWalk(120, doorwayReturnSeconds / 2);
    const back = doorwayWalk(120, 0);

    // Assert
    expect(comingBack.walking).toBe(true);
    expect(comingBack.gone).toBe(false);
    expect(back.position).toEqual(stations.door.spot);
    // Through the door the walk in heads to -x, into the room.
    expect(Math.sin(doorwayWalk(120, 0.2).yaw)).toBeLessThan(-0.9);
  });

  it("meets in the middle on a step too short for the whole walk, without a jump", () => {
    // Arrange: a step of four seconds in all.
    const total = 4;

    // Act
    const distances = [0, 1, 2, 3, 4].map((elapsed) => {
      const { position } = doorwayWalk(elapsed, total - elapsed);
      return Math.hypot(position.x - stations.door.spot.x, position.z - stations.door.spot.z);
    });

    // Assert
    expect(distances[0]).toBe(0);
    expect(distances[4]).toBe(0);
    for (let index = 1; index < distances.length; index++) {
      expect(Math.abs((distances[index] ?? 0) - (distances[index - 1] ?? 0))).toBeLessThanOrEqual(1.0001);
    }
    expect(distances.every((distance) => distance < doorwayLength)).toBe(true);
  });
});
