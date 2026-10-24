import { describe, expect, it } from "vitest";
import {
  type ActiveDeskBit,
  chessCarry,
  DeskHabits,
  deskBitFace,
  deskBitProp,
  deskBits,
  itemInHand,
  reachingForItem,
  reachSeconds,
} from "../src/renderer/office/desk-habits.js";
import { officePose } from "../src/renderer/office/office-pose.js";
import { memberIds } from "../src/shared/team.js";

function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

function bit(kind: ActiveDeskBit["kind"], elapsed: number, duration: number): ActiveDeskBit {
  return { kind, elapsed, duration, startedAt: 0 };
}

describe("DeskHabits", () => {
  it("settles in after sitting down, then plays a bit and switches to another next time", () => {
    // Arrange: settle-in 2 s, gaps 6 s, always the first choice.
    const habits = new DeskHabits(["tea", "chess"], sequence(0));

    // Act
    const settling = habits.update(0, true);
    const first = habits.update(2.5, true);
    const ended = habits.update(2.5 + 6, true);
    const second = habits.update(2.5 + 6 + 6, true);

    // Assert
    expect(settling).toBeNull();
    expect(first?.kind).toBe("tea");
    expect(ended).toBeNull();
    expect(second?.kind).toBe("chess");
  });

  it("drops the bit at once when the member leaves the desk", () => {
    // Arrange
    const habits = new DeskHabits(["console"], sequence(0));
    habits.update(0, true);
    habits.update(3, true);

    // Act
    const away = habits.update(4, false);
    const back = habits.update(4.5, true);

    // Assert: back at the desk they settle in again first.
    expect(away).toBeNull();
    expect(back).toBeNull();
  });

  it("repeats the only bit a member has", () => {
    // Arrange
    const habits = new DeskHabits(["rose"], sequence(0));
    habits.update(0, true);

    // Act
    const first = habits.update(2, true);
    habits.update(2 + 5, true);
    const second = habits.update(2 + 5 + 6, true);

    // Assert
    expect(first?.kind).toBe("rose");
    expect(second?.kind).toBe("rose");
  });

  it("gives every member something to do at their desk", () => {
    for (const memberId of memberIds) {
      expect(deskBits[memberId].length).toBeGreaterThan(0);
    }
  });
});

describe("desk bit timing", () => {
  it("keeps the teacup on the desk during the reach, in the hand while sipping, back at the end", () => {
    // Act
    const reaching = bit("tea", reachSeconds / 2, 6);
    const sipping = bit("tea", 3, 6);
    const putDown = bit("tea", 6 - reachSeconds / 4, 6);

    // Assert
    expect(reachingForItem(reaching)).toBe(true);
    expect(itemInHand(reaching)).toBe(false);
    expect(reachingForItem(sipping)).toBe(false);
    expect(itemInHand(sipping)).toBe(true);
    expect(deskBitProp(sipping)).toBe("teacup");
    expect(itemInHand(putDown)).toBe(false);
    expect(deskBitProp(putDown)).toBeNull();
  });

  it("takes the phone out of a pocket without reaching for anything", () => {
    // Act
    const middle = bit("desk-selfie", 2.5, 5);

    // Assert
    expect(reachingForItem(middle)).toBe(false);
    expect(deskBitProp(middle)).toBe("phone");
  });

  it("carries the chess piece over and sets it down, lifted only in between", () => {
    // Act
    const start = chessCarry(bit("chess", reachSeconds, 4));
    const middle = chessCarry(bit("chess", reachSeconds + 0.5, 4));
    const end = chessCarry(bit("chess", 3, 4));

    // Assert
    expect(start.along).toBe(0);
    expect(middle.lift).toBeGreaterThan(0.9);
    expect(end.along).toBe(1);
    expect(end.lift).toBeCloseTo(0, 6);
  });

  it("smiles while hugging the plush and talks into the mic", () => {
    // Act
    const hug = deskBitFace(bit("plush-hug", 2.5, 5), 0);
    const mic = deskBitFace(bit("mic", 3, 6), 0.15);

    // Assert
    expect(hug?.happy ?? 0).toBeGreaterThan(0.5);
    expect(mic?.aa ?? 0).toBeGreaterThan(0);
  });
});

describe("desk bit poses", () => {
  const seated = {
    action: "desk-idle" as const,
    walkPhase: 0,
    time: 0,
    actionElapsed: 10,
    seat: null,
    keystrokes: 0,
    carrying: false,
  };

  it("folds both forearms up to the chest for a hug", () => {
    // Act
    const idle = officePose(seated);
    const hug = officePose({ ...seated, deskBit: bit("plush-hug", 2.5, 5) });

    // Assert: right forearm folds about +y, the left mirrors it.
    expect(hug.bones.rightLowerArm?.y ?? 0).toBeGreaterThan((idle.bones.rightLowerArm?.y ?? 0) + 1);
    expect(hug.bones.leftLowerArm?.y ?? 0).toBeLessThan((idle.bones.leftLowerArm?.y ?? 0) - 1);
  });

  it("leans toward the desk and turns to the item's side while reaching", () => {
    // Act: the duck sits on the left of the desk.
    const reaching = officePose({ ...seated, deskBit: bit("duck", reachSeconds * 0.6, 5) });

    // Assert: forward lean, chest turned to the avatar's left (positive y).
    expect(reaching.bones.spine?.x ?? 0).toBeGreaterThan(0.15);
    expect(reaching.bones.chest?.y ?? 0).toBeGreaterThan(0.1);
  });
});
