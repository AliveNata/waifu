import { describe, expect, it } from "vitest";
import {
  ChatterDirector,
  lineSeconds,
  planConversation,
  voiceCoverage,
} from "../src/renderer/office/office-chatter.js";
import { WalkHabits } from "../src/renderer/office/walk-life.js";

function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

describe("voices", () => {
  it("give every member an opener and two replies on every topic", () => {
    // Act
    const gaps = voiceCoverage().filter((entry) => entry.openers < 1 || entry.replies < 2);

    // Assert
    expect(gaps).toEqual([]);
  });
});

describe("planConversation", () => {
  it("alternates the two speakers over four lines", () => {
    // Act
    const turns = planConversation("asuna", "erza", sequence(0.3));

    // Assert
    expect(turns.map((turn) => turn.speaker)).toEqual(["asuna", "erza", "asuna", "erza"]);
    for (const turn of turns) {
      expect(turn.text).not.toMatch(/[—–;]/);
      expect(turn.seconds).toBe(lineSeconds(turn.text));
    }
  });
});

describe("ChatterDirector", () => {
  it("puts one line up at a time and has the other person react to it", () => {
    // Arrange
    const chatter = new ChatterDirector(sequence(0.1));
    const pair = [["rias", "ruby"]] as const;

    // Act: past catching each other's eye, which comes before the first line.
    chatter.update(0, 0, pair);
    chatter.update(2.5, 2.5, pair);

    // Assert
    const riasSpeech = chatter.speechOf("rias");
    const rubySpeech = chatter.speechOf("ruby");
    expect([riasSpeech, rubySpeech].filter((speech) => speech !== null)).toHaveLength(1);
    const speaker = riasSpeech === null ? "ruby" : "rias";
    const listener = speaker === "rias" ? "ruby" : "rias";
    expect(chatter.reactionOf(speaker)).toBe("talk");
    expect(["nod", "laugh"]).toContain(chatter.reactionOf(listener));
    expect(chatter.partnerOf(listener)).toBe(speaker);
  });

  it("ends the conversation when the pair splits up", () => {
    // Arrange
    const chatter = new ChatterDirector(sequence(0.1));
    chatter.update(0, 0, [["rias", "ruby"]]);
    chatter.update(2.5, 2.5, [["rias", "ruby"]]);

    // Act
    chatter.update(2, 0.5, []);

    // Assert
    expect(chatter.speechOf("rias")).toBeNull();
    expect(chatter.partnerOf("ruby")).toBeNull();
  });

  it("has them catch each other's eye before anyone speaks", () => {
    // Arrange: 0.1 makes rias the opener.
    const chatter = new ChatterDirector(sequence(0.1));
    const pair = [["rias", "ruby"]] as const;
    chatter.update(0, 0, pair);

    // Act
    chatter.update(0.3, 0.3, pair);
    const openerFirst = { rias: chatter.gazeOf("rias"), ruby: chatter.gazeOf("ruby") };
    chatter.update(1.5, 1.2, pair);
    const eyesMeet = { rias: chatter.reactionOf("rias"), ruby: chatter.reactionOf("ruby") };
    const speechDuringOpening = chatter.speechOf("rias") ?? chatter.speechOf("ruby");

    // Assert
    expect(openerFirst.rias).toBeGreaterThan(0.5);
    expect(openerFirst.ruby).toBe(0);
    expect(eyesMeet).toEqual({ rias: "acknowledge", ruby: "acknowledge" });
    expect(speechDuringOpening).toBeNull();
  });

  it("gives the speaker a gesture and the listener a posture for each line", () => {
    // Arrange
    const chatter = new ChatterDirector(sequence(0.1));
    const pair = [["asuna", "erza"]] as const;
    chatter.update(0, 0, pair);
    chatter.update(2.5, 2.5, pair);

    // Act
    const speaker = chatter.speechOf("asuna") === null ? "erza" : "asuna";
    const listener = speaker === "asuna" ? "erza" : "asuna";
    const speakerGesture = chatter.gestureOf(speaker);
    const listenerGesture = chatter.gestureOf(listener);

    // Assert
    expect(["explain", "point", "count", "chin", "shrug", "hips", "clasp", "wave-off"]).toContain(speakerGesture?.kind);
    expect(["relaxed", "arms-crossed", "head-tilt", "chin", "cover-laugh"]).toContain(listenerGesture?.kind);
  });

  it("greets a pair once, then not again while on cooldown", () => {
    // Arrange
    const chatter = new ChatterDirector(sequence(0.5));

    // Act
    const first = chatter.greet("yor", "kobayashi", 10);
    chatter.update(10.1, 0.1, []);
    const again = chatter.greet("yor", "kobayashi", 20);

    // Assert
    expect(first).toBe(true);
    expect(chatter.speechOf("yor")).not.toBeNull();
    expect(again).toBe(false);
  });
});

describe("WalkHabits", () => {
  it("keeps the phone and the stretch away while carrying a mug", () => {
    // Arrange: rolls that would pick the phone if it were allowed.
    const habits = new WalkHabits(0, sequence(0.6));

    // Act
    const gimmick = habits.update(30, true, true);

    // Assert
    expect(gimmick?.kind).toBe("look-around");
  });

  it("drops whatever it was doing once the member stops walking", () => {
    // Arrange
    const habits = new WalkHabits(0, sequence(0));
    habits.wave(1);

    // Act
    const standing = habits.update(1.5, false, false);

    // Assert
    expect(standing).toBeNull();
  });
});
