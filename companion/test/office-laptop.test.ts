import { describe, expect, it } from "vitest";
import {
  deskLock,
  laptopTakeSeconds,
  laptopView,
  lockAt,
  signedInAt,
  signInFrom,
} from "../src/renderer/office/office-laptop.js";

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

describe("the desk at the end and start of the day", () => {
  it("locks, then shuts the laptop before leaving, and keeps it shut while away", () => {
    // Act
    const sitting = laptopView({ errand: "pack-up", arrived: true, stepElapsed: 0.5, remaining: 3 });
    const shut = laptopView({ errand: "pack-up", arrived: true, stepElapsed: 3.5, remaining: 0.5 });
    const away = laptopView({ errand: "go-home", arrived: true, stepElapsed: 100, remaining: 1000 });

    // Assert
    expect(sitting.lid).toBe(1);
    expect(shut.lid).toBe(0);
    expect(away).toMatchObject({ place: "home", lid: 0 });
    expect(deskLock("pack-up", true, lockAt - 0.1)).toEqual({ kind: "open" });
    expect(deskLock("pack-up", true, lockAt)).toEqual({ kind: "locked" });
    expect(deskLock("go-home", false, 0)).toEqual({ kind: "locked" });
  });

  it("keeps the desk shut and locked while its owner is at the locker", () => {
    // Act
    const atLocker = laptopView({ errand: "locker", arrived: true, stepElapsed: 1, remaining: 1.6 });

    // Assert
    expect(atLocker).toMatchObject({ place: "home", lid: 0 });
    expect(deskLock("locker", true, 1)).toEqual({ kind: "locked" });
  });

  it("opens the laptop on arrival and signs back in, the dots filling before it unlocks", () => {
    // Act
    const walkingIn = laptopView({ errand: "unpack", arrived: false, stepElapsed: 0, remaining: Infinity });
    const opened = laptopView({ errand: "unpack", arrived: true, stepElapsed: 2, remaining: 3 });
    const typing = deskLock("unpack", true, (signInFrom + signedInAt) / 2);

    // Assert
    expect(walkingIn.lid).toBe(0);
    expect(opened.lid).toBe(1);
    expect(deskLock("unpack", true, signInFrom - 0.1)).toEqual({ kind: "locked" });
    expect(typing.kind).toBe("signing-in");
    expect(typing.kind === "signing-in" ? typing.typed : 0).toBeGreaterThan(0);
    expect(deskLock("unpack", true, signedInAt)).toEqual({ kind: "open" });
    expect(deskLock(null, true, 5)).toEqual({ kind: "open" });
  });
});
