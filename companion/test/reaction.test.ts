import { describe, expect, it } from "vitest";
import { isTransientExpired, reactionForHook, statusText } from "../src/shared/reaction.js";

describe("reactionForHook", () => {
  it.each([
    ["SessionStart", "greeting"],
    ["UserPromptSubmit", "thinking"],
    ["PreCompact", "thinking"],
    ["PreToolUse", "working"],
    ["PostToolUse", "working"],
    ["Notification", "waiting"],
    ["Stop", "done"],
    ["SessionEnd", "idle"],
  ] as const)("maps %s to %s", (eventName, mood) => {
    // Act
    const reaction = reactionForHook({ hook_event_name: eventName }, 1000);

    // Assert
    expect(reaction?.mood).toBe(mood);
  });

  it("ignores SubagentStop so the main agent's mood holds", () => {
    // Act
    const reaction = reactionForHook({ hook_event_name: "SubagentStop" }, 1000);

    // Assert
    expect(reaction).toBeNull();
  });

  it("carries the tool name as detail", () => {
    // Act
    const reaction = reactionForHook({ hook_event_name: "PreToolUse", tool_name: "Edit" }, 1000);

    // Assert
    expect(reaction).toEqual({ mood: "working", detail: "Edit", receivedAt: 1000 });
  });
});

describe("statusText", () => {
  it("hides the chip when idle", () => {
    // Act
    const text = statusText({ mood: "idle", detail: null, receivedAt: 0 });

    // Assert
    expect(text).toBeNull();
  });

  it("names the tool while working", () => {
    // Act
    const text = statusText({ mood: "working", detail: "Bash", receivedAt: 0 });

    // Assert
    expect(text).toBe("Ngerjain: Bash");
  });
});

describe("isTransientExpired", () => {
  it("expires done after its duration", () => {
    // Arrange
    const done = { mood: "done" as const, detail: null, receivedAt: 0 };

    // Act + Assert
    expect(isTransientExpired(done, 4999)).toBe(false);
    expect(isTransientExpired(done, 5000)).toBe(true);
  });

  it("never expires persistent moods", () => {
    // Arrange
    const working = { mood: "working" as const, detail: null, receivedAt: 0 };

    // Act + Assert
    expect(isTransientExpired(working, 10_000_000)).toBe(false);
  });
});
