import { describe, expect, it } from "vitest";
import {
  afterSip,
  brewSeconds,
  initialMug,
  type MugInput,
  mugPickSeconds,
  stepMug,
  washSeconds,
} from "../src/renderer/office/office-mug.js";

describe("mug", () => {
  const base: MugInput = {
    desk: "desk-asuna",
    station: "desk-asuna",
    arrived: true,
    errand: null,
    action: "desk-idle",
    actionElapsed: 0,
  };

  it("takes the mug off the desk, fills it at the machine, and puts it back by the keyboard", () => {
    // Arrange
    const empty = { ...initialMug(0) };

    // Act
    const reaching = stepMug(empty, { ...base, errand: "get-mug", action: "fetch", actionElapsed: 0.3 });
    const taken = stepMug(reaching, { ...base, errand: "get-mug", action: "fetch", actionElapsed: mugPickSeconds });
    const walking = stepMug(taken, { ...base, station: "coffee", arrived: false, action: null });
    const brewed = stepMug(walking, { ...base, station: "coffee", action: "brew", actionElapsed: brewSeconds });
    const home = stepMug(brewed, { ...base, action: "desk-idle" });

    // Assert
    expect(reaching.place).toBe("desk");
    expect(taken.place).toBe("hand");
    expect(walking.place).toBe("hand");
    expect(brewed).toEqual({ place: "hand", level: 1 });
    expect(home).toEqual({ place: "desk", level: 1 });
  });

  it("washes an empty mug and leaves it on the drying rack", () => {
    // Arrange
    const inHand = { place: "hand" as const, level: 0 };

    // Act
    const washing = stepMug(inHand, { ...base, station: "sink", errand: "wash-mug", action: "wash", actionElapsed: 1 });
    const washed = stepMug(washing, {
      ...base,
      station: "sink",
      errand: "wash-mug",
      action: "wash",
      actionElapsed: washSeconds,
    });

    // Assert
    expect(washing.place).toBe("hand");
    expect(washed).toEqual({ place: "rack", level: 0 });
  });

  it("takes the clean mug from the rack for the next coffee", () => {
    // Act
    const taken = stepMug(
      { place: "rack", level: 0 },
      { ...base, station: "sink", errand: "rack-mug", action: "pick", actionElapsed: mugPickSeconds },
    );

    // Assert
    expect(taken.place).toBe("hand");
  });

  it("empties a sip at a time and never below empty", () => {
    // Act
    const sips = [1, 2, 3, 4, 5].reduce((mug) => afterSip(mug), initialMug(1));

    // Assert
    expect(sips.level).toBe(0);
    expect(afterSip(initialMug(0.5)).level).toBeCloseTo(0.25);
  });
});
