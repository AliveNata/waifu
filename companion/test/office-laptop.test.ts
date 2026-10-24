import { describe, expect, it } from "vitest";
import { laptopTakeSeconds, laptopView } from "../src/renderer/office/office-laptop.js";

describe("laptopView", () => {
  it("leaves the laptop at the desk outside a meeting run", () => {
    // Act
    const view = laptopView({ errand: null, arrived: true, stepElapsed: 5, remaining: 10 });

    // Assert
    expect(view).toMatchObject({ place: "home", lid: 1, drawer: 0 });
  });

  it("opens the drawer, takes the laptop out, and shuts the drawer again", () => {
    // Act
    const opening = laptopView({ errand: "fetch-laptop", arrived: true, stepElapsed: 0.6, remaining: 2 });
    const taken = laptopView({ errand: "fetch-laptop", arrived: true, stepElapsed: laptopTakeSeconds, remaining: 1 });
    const shut = laptopView({ errand: "fetch-laptop", arrived: true, stepElapsed: 2.3, remaining: 0.1 });

    // Assert
    expect(opening.place).toBe("home");
    expect(opening.drawer).toBeGreaterThan(0.9);
    expect(taken.place).toBe("hand");
    expect(shut.drawer).toBe(0);
  });

  it("folds a desk laptop shut before picking it up", () => {
    // Act
    const view = laptopView({ errand: "fetch-laptop", arrived: true, stepElapsed: 1, remaining: 1.4 });

    // Assert
    expect(view.lid).toBe(0);
  });

  it("sets it down shut, opens it, then switches it on", () => {
    // Act
    const carried = laptopView({ errand: "meeting-laptop", arrived: false, stepElapsed: 0, remaining: Infinity });
    const setDown = laptopView({ errand: "meeting-laptop", arrived: true, stepElapsed: 0.7, remaining: 20 });
    const booting = laptopView({ errand: "meeting-laptop", arrived: true, stepElapsed: 1.5, remaining: 20 });
    const working = laptopView({ errand: "meeting-laptop", arrived: true, stepElapsed: 5, remaining: 15 });

    // Assert
    expect(carried.place).toBe("hand");
    expect(setDown).toMatchObject({ place: "seat", screenOn: false });
    expect(setDown.lid).toBeLessThan(0.2);
    expect(booting.lid).toBe(1);
    expect(booting.screenOn).toBe(false);
    expect(working).toMatchObject({ place: "seat", lid: 1, screenOn: true });
  });

  it("shuts it down, closes the lid, and takes it before leaving the table", () => {
    // Act
    const shutDown = laptopView({ errand: "meeting-laptop", arrived: true, stepElapsed: 20, remaining: 2 });
    const closed = laptopView({ errand: "meeting-laptop", arrived: true, stepElapsed: 21, remaining: 0.6 });
    const taken = laptopView({ errand: "meeting-laptop", arrived: true, stepElapsed: 22, remaining: 0.3 });

    // Assert
    expect(shutDown.screenOn).toBe(false);
    expect(shutDown.lid).toBeGreaterThan(0.5);
    expect(closed.lid).toBeLessThan(0.05);
    expect(taken.place).toBe("hand");
  });

  it("puts it back in the drawer and the desk laptop opens up again", () => {
    // Act
    const carrying = laptopView({ errand: "stow-laptop", arrived: true, stepElapsed: 0.4, remaining: 2 });
    const stowed = laptopView({ errand: "stow-laptop", arrived: true, stepElapsed: 2.2, remaining: 0.2 });

    // Assert
    expect(carrying.place).toBe("hand");
    expect(stowed).toMatchObject({ place: "home", lid: 1, drawer: 0 });
  });
});
