import { describe, expect, it } from "vitest";
import {
  isTransientExpired,
  memberSignalForHook,
  reactionForHook,
  signalsForHook,
  statusText,
} from "../src/shared/reaction.js";

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
    const reaction = reactionForHook({ hook_event_name: "SubagentStop", agent_id: "a", agent_type: "reviewer" }, 1000);

    // Assert
    expect(reaction).toBeNull();
  });

  it("ignores tool use from inside a subagent", () => {
    // Act
    const reaction = reactionForHook(
      { hook_event_name: "PreToolUse", tool_name: "Bash", agent_id: "a", agent_type: "platform-sre" },
      1000,
    );

    // Assert
    expect(reaction).toBeNull();
  });

  it("shows delegation when the main session starts a subagent", () => {
    // Act
    const reaction = reactionForHook({ hook_event_name: "PreToolUse", tool_name: "Agent" }, 1000);

    // Assert
    expect(reaction?.detail).toBe("Delegasi ke tim");
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

describe("memberSignalForHook", () => {
  it.each([
    ["SubagentStart", "start"],
    ["SubagentStop", "stop"],
    ["PreToolUse", "tool"],
  ] as const)("maps %s from a team agent to %s", (eventName, activity) => {
    // Act
    const signal = memberSignalForHook(
      { hook_event_name: eventName, agent_id: "a1", agent_type: "data-engineer", tool_name: "Edit" },
      5,
    );

    // Assert
    expect(signal?.memberId).toBe("asuna");
    expect(signal?.activity).toBe(activity);
  });

  it("ignores built-in subagents outside the roster", () => {
    expect(
      memberSignalForHook({ hook_event_name: "SubagentStart", agent_id: "a", agent_type: "Explore" }, 5),
    ).toBeNull();
  });

  it("ignores main-session events", () => {
    expect(memberSignalForHook({ hook_event_name: "PreToolUse", tool_name: "Bash" }, 5)).toBeNull();
  });
});

describe("signalsForHook", () => {
  it("produces exactly one signal for a subagent tool call", () => {
    // Act
    const signals = signalsForHook(
      { hook_event_name: "PostToolUse", tool_name: "Read", agent_id: "a", agent_type: "architect" },
      9,
    );

    // Assert
    expect(signals.map((signal) => signal.kind)).toEqual(["member"]);
  });
});
