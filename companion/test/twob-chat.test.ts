import { describe, expect, it } from "vitest";
import { twobMessage } from "../src/shared/office-chat.js";
import { bubbleLine, faceForMood, looksLikeCrisis, parseTwobReply } from "../src/shared/twob-chat.js";

describe("twobMessage", () => {
  it.each([
    ["@2B halo", "halo"],
    ["  @2b, aku capek hari ini", "aku capek hari ini"],
    ["@2B", ""],
  ])("reads %j as a message to 2B", (text, rest) => {
    // Act + Assert
    expect(twobMessage(text)).toBe(rest);
  });

  it.each(["halo 2B", "@Erza cek ini", "email@2b.com"])("leaves %j for Claude", (text) => {
    // Act + Assert
    expect(twobMessage(text)).toBeNull();
  });
});

describe("parseTwobReply", () => {
  it("takes the mood and pose tags off the front of the reply", () => {
    // Act
    const reply = parseTwobReply("[mood:warm] [pose:wave] Hai, gimana harimu?");

    // Assert
    expect(reply).toEqual({ text: "Hai, gimana harimu?", mood: "warm", pose: "wave" });
  });

  it("falls back to a calm reply without a pose when tags are missing or unknown", () => {
    // Act
    const reply = parseTwobReply("[mood:ecstatic] [pose:backflip] Oke.");

    // Assert
    expect(reply).toEqual({ text: "Oke.", mood: "calm", pose: null });
  });

  it("maps moods to faces the overlay knows", () => {
    // Act + Assert
    expect(faceForMood("concern")).toBe("sad");
    expect(faceForMood("thinking")).toBeNull();
  });
});

describe("bubbleLine", () => {
  it("keeps the first sentence and shortens a long one", () => {
    // Act + Assert
    expect(bubbleLine("Aku dengerin kok. Cerita aja pelan-pelan.")).toBe("Aku dengerin kok.");
    expect(bubbleLine("a ".repeat(80)).length).toBeLessThanOrEqual(90);
  });
});

describe("looksLikeCrisis", () => {
  it.each([
    "kadang aku pengen mati aja",
    "aku nggak kuat hidup lagi",
    "kepikiran bunuh diri",
    "pengen nyakitin diri sendiri",
    "I want to die",
  ])("flags %j", (text) => {
    // Act + Assert
    expect(looksLikeCrisis(text)).toBe(true);
  });

  it.each(["hari ini capek banget", "deadline bikin mati gaya", "laptopku mati"])("does not flag %j", (text) => {
    // Act + Assert
    expect(looksLikeCrisis(text)).toBe(false);
  });
});
