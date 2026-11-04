import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  type Gesture,
  gestureAmount,
  gesturePlacements,
  gestureSeconds,
  gestures,
  IdleGestures,
  type Placement,
} from "../src/renderer/office/alyx-gestures.js";
import { defaultDisplaySettings, normalizeDisplaySettings } from "../src/shared/display-settings.js";

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const relaxed = { thumb: 0.3, index: 0.35, middle: 0.45, ring: 0.5, pinky: 0.55 };
const rest: Record<"Right" | "Left", Placement> = {
  Right: {
    palm: new Vector3(0.2, -0.25, -0.42),
    fingers: new Vector3(-0.12, 0.3, -1),
    facing: new Vector3(-0.7, -0.6, 0),
    curl: relaxed,
    roll: 0,
  },
  Left: {
    palm: new Vector3(-0.2, -0.25, -0.42),
    fingers: new Vector3(0.12, 0.3, -1),
    facing: new Vector3(0.7, -0.6, 0),
    curl: relaxed,
    roll: 0,
  },
};

/** Runs the scheduler for `seconds` at 30 frames a second and lists the gestures it started. */
function started(idle: IdleGestures, seconds: number, busy: (time: number) => boolean): Gesture[] {
  const seen: Gesture[] = [];
  let previous: Gesture | null = null;
  for (let frame = 0; frame < seconds * 30; frame++) {
    const current = idle.update(1 / 30, busy(frame / 30));
    if (current !== null && current.gesture !== previous && current.seconds < 0.1) {
      seen.push(current.gesture);
    }
    previous = current?.gesture ?? null;
  }
  return seen;
}

describe("Alyx's idle hands", () => {
  it("keeps doing things while he stands about, never the same twice in a row", () => {
    // Arrange
    const idle = new IdleGestures(seeded(7));

    // Act: two minutes standing still.
    const seen = started(idle, 120, () => false);

    // Assert
    expect(seen.length).toBeGreaterThan(8);
    expect(seen.some((gesture, index) => index > 0 && gesture === seen[index - 1])).toBe(false);
    expect(new Set(seen).size).toBeGreaterThanOrEqual(4);
  });

  it("does nothing on its own while he walks or uses his hands", () => {
    // Arrange
    const idle = new IdleGestures(seeded(3));

    // Act
    const seen = started(idle, 60, () => true);

    // Assert
    expect(seen).toEqual([]);
  });

  it("lets go of a gesture within a fraction of a second once he moves", () => {
    // Arrange: stand until a gesture is under way.
    const idle = new IdleGestures(seeded(11));
    let frame = idle.update(1 / 30, false);
    for (let step = 0; step < 30 * 10 && (frame === null || frame.seconds < 0.6); step++) {
      frame = idle.update(1 / 30, false);
    }

    // Act: walk for a quarter second.
    let after = frame;
    for (let step = 0; step < 8; step++) {
      after = idle.update(1 / 30, true);
    }

    // Assert
    expect(frame).not.toBeNull();
    expect(after).toBeNull();
  });

  it("eases each gesture in and out, full in the middle", () => {
    for (const gesture of gestures) {
      // Act
      const length = gestureSeconds[gesture];
      const amounts = [0, length / 2, length].map((seconds) => gestureAmount(gesture, seconds));

      // Assert
      expect(amounts, gesture).toEqual([0, 1, 0]);
    }
  });

  it("keeps every gesture's hands in front of the eyes and in view", () => {
    for (const gesture of gestures) {
      for (let seconds = 0; seconds < gestureSeconds[gesture]; seconds += 0.25) {
        // Act
        const placements = Object.values(gesturePlacements(gesture, seconds, rest));

        // Assert: ahead of the camera, within the lower part of a 70° view, no wild values.
        for (const placement of placements) {
          expect(placement.palm.z, gesture).toBeLessThan(-0.25);
          expect(Math.abs(placement.palm.x), gesture).toBeLessThan(0.3);
          expect(placement.palm.y, gesture).toBeLessThan(0);
          expect(Object.values(placement.curl).every((curl) => curl >= 0 && curl <= 1)).toBe(true);
        }
      }
    }
  });
});

describe("office display settings", () => {
  it("keeps only the offered steps", () => {
    // Act
    const chosen = normalizeDisplaySettings({ renderScale: 50, fpsCap: 30 });
    const odd = normalizeDisplaySettings({ renderScale: 62, fpsCap: 144 });
    const missing = normalizeDisplaySettings(null);

    // Assert
    expect(chosen).toEqual({ renderScale: 50, fpsCap: 30 });
    expect(odd).toEqual(defaultDisplaySettings);
    expect(missing).toEqual({ renderScale: 100, fpsCap: 0 });
  });
});
