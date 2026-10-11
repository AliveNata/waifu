import { describe, expect, it } from "vitest";
import type { DialogLine } from "../src/renderer/common/conversation.js";
import type { Tone } from "../src/renderer/common/report-lines.js";
import { SpeakerFace } from "../src/renderer/common/speaker-face.js";

function line(text: string, tone: Tone | null): DialogLine {
  return { id: 1, memberId: "erza", text, simulated: false, gesture: "none", mood: "done", tone };
}

/** Runs the face at 60 fps up to `seconds` into the line and returns the last frame. */
function faceAt(face: SpeakerFace, dialog: DialogLine, seconds: number, revealedPerSecond = 22) {
  let frame = face.update({ line: dialog, lineElapsed: 0, revealed: 0, talking: true }, 0, 1 / 60);
  for (let time = 1 / 60; time <= seconds; time += 1 / 60) {
    const revealed = Math.floor(time * revealedPerSecond);
    frame = face.update(
      { line: dialog, lineElapsed: time, revealed, talking: revealed < dialog.text.length },
      time,
      1 / 60,
    );
  }
  return frame;
}

describe("SpeakerFace", () => {
  it("builds the sentence's emotion and opens the mouth on vowels while talking", () => {
    // Arrange
    const face = new SpeakerFace(() => 0.5);
    const dialog = line("Masih ada bug di validasi tanggal kosong.", "concern");

    // Act
    const frame = faceAt(face, dialog, 0.8);

    // Assert
    expect(frame.expressions.sad).toBeGreaterThan(0.3);
    const mouth = ["aa", "ih", "ou", "ee", "oh"].reduce((sum, viseme) => sum + (frame.expressions[viseme] ?? 0), 0);
    expect(mouth).toBeGreaterThan(0);
  });

  it("on VRoid models puts worry in the brows and keeps the eyelids open", () => {
    // Arrange
    const face = new SpeakerFace(() => 0.5);
    face.reset(true);
    const dialog = line("Masih ada bug di validasi tanggal kosong.", "concern");

    // Act
    const frame = faceAt(face, dialog, 0.8);

    // Assert: VRoid's whole-face "sad" droops the eyelids, so it stays faint here.
    expect(frame.expressions.Fcl_BRW_Sorrow).toBeGreaterThan(0.5);
    expect(frame.expressions.sad).toBeLessThan(0.15);
    expect(frame.expressions.happy).toBeLessThan(0.1);
  });

  it("writes every expression it controls, so an eased-out weight lands on zero", () => {
    // Arrange
    const face = new SpeakerFace(() => 0.5);

    // Act
    const frame = face.update({ line: null, lineElapsed: 10, revealed: 0, talking: false }, 0, 1 / 60);

    // Assert
    for (const name of ["happy", "sad", "surprised", "relaxed", "angry", "aa", "oh", "blink"]) {
      expect(frame.expressions[name]).toBeTypeOf("number");
    }
  });

  it("glances up to the side at the start of an unsure sentence, then looks back at the viewer", () => {
    // Arrange
    const face = new SpeakerFace(() => 0.5);
    const dialog = line("Belum bisa dipastikan dari repo.", "confused");

    // Act
    const early = faceAt(face, dialog, 0.4);
    const later = faceAt(new SpeakerFace(() => 0.5), dialog, 2);

    // Assert
    expect(early.gaze.y).toBeGreaterThan(0.2);
    expect(Math.abs(later.gaze.y)).toBeLessThan(0.05);
  });

  it("blinks right after a sentence ends", () => {
    // Arrange: random() = 0.99 puts the next scheduled blink about 5.8 s away.
    const face = new SpeakerFace(() => 0.99);
    const dialog = line("Oke.", "positive");
    faceAt(face, dialog, 0.15);

    // Act: the four characters are out after 0.18 s, then the blink lands within 0.12 s.
    let closed = 0;
    for (let time = 0.2; time < 0.6; time += 1 / 60) {
      const frame = face.update({ line: dialog, lineElapsed: time, revealed: 4, talking: false }, time, 1 / 60);
      closed = Math.max(closed, frame.expressions.blink ?? 0);
    }

    // Assert
    expect(closed).toBeGreaterThan(0.5);
  });
});
