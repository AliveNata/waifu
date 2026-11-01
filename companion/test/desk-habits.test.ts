import { describe, expect, it } from "vitest";
import {
  type ActiveDeskBit,
  calendarStep,
  chessCarry,
  DeskHabits,
  deskBitFace,
  deskBitProp,
  deskBitSpec,
  deskBits,
  itemInHand,
  moodboardStep,
  piStep,
  reachingForItem,
  reachSeconds,
  safeStep,
  stampPressAt,
  stampStep,
} from "../src/renderer/office/desk-habits.js";
import { furniture } from "../src/renderer/office/office-plan.js";
import { officePose } from "../src/renderer/office/office-pose.js";
import { memberIds } from "../src/shared/team.js";

function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

function bit(kind: ActiveDeskBit["kind"], elapsed: number, duration: number): ActiveDeskBit {
  return { kind, elapsed, duration, startedAt: 0, hand: deskBitSpec(kind).hand };
}

describe("DeskHabits", () => {
  it("settles in after sitting down, then plays a bit and switches to another next time", () => {
    // Arrange: settle-in 2 s, gaps 6 s, always the first choice.
    const habits = new DeskHabits(["sip", "chess"], sequence(0));

    // Act
    const settling = habits.update(0, true);
    const first = habits.update(2.5, true);
    const ended = habits.update(2.5 + 6, true);
    const second = habits.update(2.5 + 6 + 6, true);

    // Assert
    expect(settling).toBeNull();
    expect(first?.kind).toBe("sip");
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

  it("skips a sip from an empty mug and uses the hand nearer the mug", () => {
    // Arrange: the mug is on the left of this desk.
    const habits = new DeskHabits(["sip", "duck"], sequence(0), { sip: "left" });
    habits.update(0, true);

    // Act
    const emptyMug = habits.update(6, true, (bit) => bit !== "sip");
    const later = new DeskHabits(["sip"], sequence(0), { sip: "left" });
    later.update(0, true);
    const sip = later.update(2, true);

    // Assert
    expect(emptyMug?.kind).toBe("duck");
    expect(sip).toMatchObject({ kind: "sip", hand: "left" });
  });

  it("gives every member something to do at their desk", () => {
    for (const memberId of memberIds) {
      expect(deskBits[memberId].length).toBeGreaterThan(0);
    }
  });
});

describe("desk bit timing", () => {
  it("keeps the mug on the desk during the reach, in the hand while sipping, back at the end", () => {
    // Act
    const reaching = bit("sip", reachSeconds / 2, 6);
    const sipping = bit("sip", 3, 6);
    const putDown = bit("sip", 6 - reachSeconds / 4, 6);

    // Assert
    expect(reachingForItem(reaching)).toBe(true);
    expect(itemInHand(reaching)).toBe(false);
    expect(reachingForItem(sipping)).toBe(false);
    expect(itemInHand(sipping)).toBe(true);
    expect(deskBitProp(sipping)).toBe("mug");
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

describe("the newer members' desk bits", () => {
  it.each(["arisu", "komachi", "miruku", "huagua"] as const)(
    "gives %s things of their own to do besides a sip",
    (member) => {
      // Act
      const own = deskBits[member].filter((kind) => kind !== "sip");

      // Assert
      expect(own.length).toBeGreaterThanOrEqual(2);
    },
  );

  it("taps the security key where it sits instead of picking it up", () => {
    // Act
    const spec = deskBitSpec("key-tap");

    // Assert: with no item, the key never disappears from the hub.
    expect(spec.item).toBeNull();
    expect(spec.prop).toBeNull();
  });
});

describe("the L-desk return bits", () => {
  // Each L-desk owner and the thing on their return.
  const returnBits = {
    twob: "calendar",
    erza: "stamp",
    miruku: "safe",
    kobayashi: "phone-test",
    huagua: "moodboard",
    asuna: "printout",
    yor: "pi-reseat",
  } as const;

  it.each(Object.entries(returnBits))("works %s's return with the hand on its side", (member, kind) => {
    // Arrange: the return's side in the desk's own frame, where +x is the sitter's right.
    const desk = furniture.find((piece) => piece.id === `desk-${member}`);
    const leg = furniture.find((piece) => piece.id === `return-${member}`);
    if (desk === undefined || leg === undefined) {
      throw new Error(`${member} has no L-desk`);
    }
    const localX = (leg.x - desk.x) * Math.cos(desk.yaw) - (leg.z - desk.z) * Math.sin(desk.yaw);

    // Act
    const spec = deskBitSpec(kind);

    // Assert
    expect(deskBits[member as keyof typeof returnBits]).toContain(kind);
    expect(spec.hand).toBe(localX > 0 ? "right" : "left");
  });

  it("flips the calendar page all the way over before tapping a date twice", () => {
    // Act
    const reaching = calendarStep(0.5);
    const flipped = calendarStep(1.95);
    const taps = [2.5, 2.8, 3.1, 3.4, 3.69].map((t) => calendarStep(t).press);
    const done = calendarStep(4.5);

    // Assert
    expect(reaching).toMatchObject({ hand: "page", flip: 0 });
    expect(flipped).toMatchObject({ hand: "face", flip: 1 });
    expect(taps[1]).toBeGreaterThan(0.95);
    expect(taps[2]).toBeLessThan(0.05);
    expect(taps[3]).toBeGreaterThan(0.95);
    expect(done.hand).toBeNull();
  });

  it("dabs the ink pad first and leaves the mark only from the press on the sheet", () => {
    // Act
    const inking = stampStep(1.9);
    const beforePress = stampStep(stampPressAt - 0.05);
    const pressed = stampStep(stampPressAt);
    const admiring = stampStep(5);

    // Assert
    expect(inking.hand).toBe("pad");
    expect(inking.stamped).toBe(false);
    expect(beforePress).toMatchObject({ hand: "paper", stamped: false });
    expect(pressed.press).toBeGreaterThan(0.95);
    expect(pressed.stamped).toBe(true);
    expect(admiring).toMatchObject({ hand: null, stamped: true });
  });

  it("dials in, opens the safe for a look inside, and leaves it shut", () => {
    // Act
    const dialling = safeStep(1.5);
    const peeking = safeStep(4.8);
    const end = safeStep(deskBitSpec("safe").duration);

    // Assert
    expect(dialling.hand).toBe("dial");
    expect(dialling.door).toBe(0);
    expect(Math.abs(dialling.dial)).toBeGreaterThan(0);
    expect(peeking).toMatchObject({ hand: null, door: 1 });
    expect(end.door).toBe(0);
  });

  it("carries the mood board card over and lets go before sitting back", () => {
    // Act
    const start = moodboardStep(0.5);
    const placed = moodboardStep(2.4);
    const judging = moodboardStep(4);

    // Assert
    expect(start.along).toBe(0);
    expect(placed.along).toBe(1);
    expect(placed.hand).toBe(true);
    expect(judging.hand).toBe(false);
  });

  it("drops the node's link while its cable is out and blinks it back up after", () => {
    // Act
    const unplugged = piStep(2.2);
    const booting = piStep(4);
    const end = piStep(deskBitSpec("pi-reseat").duration);

    // Assert
    expect(unplugged.out).toBe(1);
    expect(unplugged.linkUp).toBe(false);
    expect(booting).toMatchObject({ linkUp: true, booting: true });
    expect(end).toMatchObject({ out: 0, linkUp: true, booting: false });
  });

  it("turns the chest to the return on the working hand's side", () => {
    // Arrange
    const seated = {
      action: "desk-idle" as const,
      walkPhase: 0,
      time: 0,
      actionElapsed: 10,
      seat: null,
      keystrokes: 0,
      carrying: false,
    };

    // Act: 2B's calendar is on her left, Yor's cluster on his right.
    const calendar = officePose({ ...seated, deskBit: bit("calendar", 2.8, 5.5) });
    const cluster = officePose({ ...seated, deskBit: bit("pi-reseat", 2.2, 6.5) });

    // Assert: positive chest y turns toward the avatar's left.
    expect(calendar.bones.chest?.y ?? 0).toBeGreaterThan(0.3);
    expect(cluster.bones.chest?.y ?? 0).toBeLessThan(-0.3);
  });
});
