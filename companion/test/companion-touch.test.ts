import { describe, expect, it, vi } from "vitest";
import { PointerGestures } from "../src/renderer/overlay/pointer-gestures.js";
import { applyCommandPose, envelope, poseHoldSeconds } from "../src/renderer/overlay/pose-bones.js";
import { reactionFace, TouchMood } from "../src/renderer/overlay/touch-reactions.js";
import { classifyTouch, type TouchProbe } from "../src/renderer/overlay/touch-zones.js";
import { parsePoseCommand } from "../src/shared/companion-pose.js";

function probe(overrides: Partial<TouchProbe>): TouchProbe {
  return { materialName: "Face_00_SKIN", bone: "head", head: { x: 0, y: 0, z: 0.08 }, eyeHeight: 0.07, ...overrides };
}

describe("classifyTouch", () => {
  it.each([
    // Measured on the base model: crown, bangs, brow, bridge, nose tip, cheek, chin.
    [probe({ materialName: "Hair_00_HAIR", head: { x: 0, y: 0.184, z: 0.094 }, eyeHeight: 0.062 }), "head"],
    [probe({ materialName: "Hair_00_HAIR", head: { x: 0.001, y: 0.126, z: 0.108 }, eyeHeight: 0.063 }), "forehead"],
    [probe({ head: { x: -0.026, y: 0.083, z: 0.091 }, eyeHeight: 0.063 }), "forehead"],
    [probe({ head: { x: 0, y: 0.062, z: 0.089 }, eyeHeight: 0.063 }), "nose"],
    [probe({ head: { x: 0, y: 0.02, z: 0.1 }, eyeHeight: 0.063 }), "nose"],
    [probe({ head: { x: -0.049, y: 0.022, z: 0.086 }, eyeHeight: 0.062 }), "cheek"],
    [probe({ bone: "neck", head: { x: 0.003, y: -0.024, z: 0.082 }, eyeHeight: 0.062 }), "cheek"],
    [probe({ materialName: "Hair_00_HAIR", head: { x: 0, y: 0.16, z: 0 } }), "head"],
    [probe({ materialName: "Hair_00_HAIR", head: { x: 0.08, y: 0.05, z: 0 } }), "hair"],
    [probe({ head: { x: 0, y: 0.11, z: 0.08 } }), "forehead"],
    [probe({ head: { x: 0.005, y: 0.04, z: 0.1 } }), "nose"],
    [probe({ head: { x: 0.04, y: 0.04, z: 0.08 } }), "cheek"],
    [probe({ materialName: "Tops_01_CLOTH", bone: "rightShoulder", head: { x: -0.12, y: -0.15, z: 0 } }), "shoulder"],
    [probe({ materialName: "Body_00_SKIN", bone: "leftHand", head: { x: 0.2, y: -0.5, z: 0 } }), "hand"],
    [probe({ materialName: "Tops_01_CLOTH", bone: "upperChest", head: { x: 0, y: -0.2, z: 0.05 } }), "body"],
  ] as const)("reads %j as %s", (input, zone) => {
    // Act + Assert
    expect(classifyTouch(input).zone).toBe(zone);
  });

  it("keeps the same zones on a head one and a half times bigger", () => {
    // Arrange: the base model's bangs and nose tip, scaled up with the eyes.
    const scale = 1.5;
    const bangs = probe({
      materialName: "Hair_00_HAIR",
      head: { x: 0.001 * scale, y: 0.126 * scale, z: 0.108 * scale },
      eyeHeight: 0.063 * scale,
    });
    const nose = probe({ head: { x: 0, y: 0.02 * scale, z: 0.1 * scale }, eyeHeight: 0.063 * scale });

    // Act + Assert
    expect(classifyTouch(bangs).zone).toBe("forehead");
    expect(classifyTouch(nose).zone).toBe("nose");
  });

  it("uses her own left and right: her left is +x", () => {
    // Act
    const cheek = classifyTouch(probe({ head: { x: 0.04, y: 0.04, z: 0.08 } }));
    const shoulder = classifyTouch(probe({ bone: "rightUpperArm" }));

    // Assert
    expect(cheek.side).toBe("left");
    expect(shoulder.side).toBe("right");
  });
});

describe("TouchMood", () => {
  it("smiles at a head pat and goes sleepy when the hand stays", () => {
    // Arrange
    const mood = new TouchMood(() => 0);

    // Act
    const pat = mood.react("head", "tap", "center", 0);
    const hold = mood.react("head", "hold", "center", 5);

    // Assert
    expect(pat.gesture).toBe("lean-in");
    expect(reactionFace(pat, 0.5)).toEqual({ happy: 0.85 });
    expect(hold.gesture).toBe("sleepy");
  });

  it("is surprised by one cheek poke and pouts after three in a row", () => {
    // Arrange
    const mood = new TouchMood(() => 0);

    // Act
    const first = mood.react("cheek", "tap", "left", 0);
    mood.react("cheek", "tap", "left", 0.5);
    const third = mood.react("cheek", "tap", "left", 1);

    // Assert
    expect(first.gesture).toBe("surprise-smile");
    expect(reactionFace(first, 0.2)).toEqual({ surprised: 0.7 });
    expect(reactionFace(first, 1)).toEqual({ happy: 0.5 });
    expect(third.gesture).toBe("pout-away");
  });

  it("sulks when poked too much, ignores touches for a while, then calms down", () => {
    // Arrange
    const mood = new TouchMood(() => 0);

    // Act: rapid pokes at the body overflow the annoyance meter.
    const reactions = [0, 0.2, 0.4].map((at) => mood.react("body", "tap", "center", at));
    const duringSulk = mood.react("head", "tap", "center", 2);
    const later = mood.react("head", "tap", "center", 20);

    // Assert
    expect(reactions.at(-1)?.line).toBe("Udah ah, aku ngambek bentar.");
    expect(duringSulk.gesture).toBe("turn-away");
    expect(later.gesture).toBe("lean-in");
    expect(mood.annoyanceAt(40)).toBe(0);
  });

  it("is soothed by petting instead of annoyed", () => {
    // Arrange
    const mood = new TouchMood(() => 0);
    mood.react("cheek", "tap", "left", 0);
    const poked = mood.annoyanceAt(0);

    // Act
    mood.react("head", "stroke", "center", 0.1);

    // Assert
    expect(mood.annoyanceAt(0.1)).toBeLessThan(poked);
  });
});

describe("parsePoseCommand", () => {
  it.each([
    ["@2B angkat tangan", { pose: "raise-hand", face: null }],
    ["@2B coba melet dong", { pose: "tongue", face: null }],
    ["Merenung.", { pose: "ponder", face: null }],
    ["@2B senyum ya", { pose: null, face: "smile" }],
    ["thumbs up", { pose: "thumbs-up", face: "smile" }],
  ] as const)("reads %j as a pose command", (text, command) => {
    // Act + Assert
    expect(parsePoseCommand(text)).toEqual(command);
  });

  it.each(["aku lagi mikir soal kerjaan", "@2B", "hari ini capek banget"])("leaves %j as a chat message", (text) => {
    // Act + Assert
    expect(parsePoseCommand(text)).toBeNull();
  });
});

describe("pose bones", () => {
  it("eases a pose in, holds it, and lets it go", () => {
    // Act + Assert
    expect(envelope(0, poseHoldSeconds)).toBe(0);
    expect(envelope(3, poseHoldSeconds, 0.5, 0.6)).toBe(1);
    expect(envelope(poseHoldSeconds, poseHoldSeconds)).toBe(0);
  });

  it("raises the right arm overhead for raise-hand", () => {
    // Arrange
    const bones = {};

    // Act
    applyCommandPose(bones, "raise-hand", 3);

    // Assert: right upper arm z below zero is above the shoulder line.
    expect((bones as { rightUpperArm?: { z: number } }).rightUpperArm?.z).toBeLessThan(-1);
  });
});

/** A stand-in for the overlay root: records pointer capture and lets the test dispatch events. */
class FakeRoot extends EventTarget {
  setPointerCapture = vi.fn();
}

function pointer(type: string, init: { x: number; y: number; screenX?: number; screenY?: number; target?: unknown }) {
  const event = new Event(type) as Event & Record<string, unknown>;
  Object.assign(event, {
    pointerId: 1,
    button: 0,
    clientX: init.x,
    clientY: init.y,
    screenX: init.screenX ?? init.x,
    screenY: init.screenY ?? init.y,
  });
  Object.defineProperty(event, "target", { value: init.target ?? { closest: () => null } });
  return event;
}

describe("PointerGestures", () => {
  function setup(zone: "head" | "body" | null) {
    const root = new FakeRoot();
    const target = { zoneAt: vi.fn(() => zone), touch: vi.fn(), beginDrag: vi.fn(), drag: vi.fn() };
    new PointerGestures(root as unknown as HTMLElement, target).start();
    return { root, target };
  }

  it("turns a quick click on her into a tap", () => {
    // Arrange
    const { root, target } = setup("head");

    // Act
    root.dispatchEvent(pointer("pointerdown", { x: 100, y: 80 }));
    root.dispatchEvent(pointer("pointerup", { x: 101, y: 80 }));

    // Assert
    expect(target.touch).toHaveBeenCalledWith(100, 80, "tap");
    expect(target.beginDrag).not.toHaveBeenCalled();
  });

  it("moves the window when dragging her body or the empty space around her", () => {
    // Arrange
    const { root, target } = setup(null);

    // Act
    root.dispatchEvent(pointer("pointerdown", { x: 100, y: 300, screenX: 1000, screenY: 700 }));
    root.dispatchEvent(pointer("pointermove", { x: 140, y: 320, screenX: 1040, screenY: 720 }));
    root.dispatchEvent(pointer("pointerup", { x: 140, y: 320 }));

    // Assert
    expect(target.beginDrag).toHaveBeenCalledOnce();
    expect(target.drag).toHaveBeenCalledWith(40, 20);
    expect(target.touch).not.toHaveBeenCalled();
  });

  it("pets instead of dragging when the press started on her head", () => {
    // Arrange
    const { root, target } = setup("head");

    // Act: stroke 150 px across her head.
    root.dispatchEvent(pointer("pointerdown", { x: 100, y: 60 }));
    for (let x = 110; x <= 250; x += 10) {
      root.dispatchEvent(pointer("pointermove", { x, y: 60 }));
    }
    root.dispatchEvent(pointer("pointerup", { x: 250, y: 60 }));

    // Assert
    expect(target.touch).toHaveBeenCalledWith(expect.any(Number), 60, "stroke");
    expect(target.beginDrag).not.toHaveBeenCalled();
  });

  it("holds when the press stays still", () => {
    // Arrange
    vi.useFakeTimers();
    const { root, target } = setup("head");

    // Act
    root.dispatchEvent(pointer("pointerdown", { x: 100, y: 60 }));
    vi.advanceTimersByTime(700);
    root.dispatchEvent(pointer("pointerup", { x: 100, y: 60 }));
    vi.useRealTimers();

    // Assert: a hold, and no extra tap on release.
    expect(target.touch).toHaveBeenCalledTimes(1);
    expect(target.touch).toHaveBeenCalledWith(100, 60, "hold");
  });

  it("leaves clicks on buttons alone", () => {
    // Arrange
    const { root, target } = setup("head");

    // Act
    root.dispatchEvent(pointer("pointerdown", { x: 10, y: 10, target: { closest: () => ({}) } }));
    root.dispatchEvent(pointer("pointerup", { x: 10, y: 10 }));

    // Assert
    expect(target.touch).not.toHaveBeenCalled();
  });
});
