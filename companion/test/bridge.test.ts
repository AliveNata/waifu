import { describe, expect, it } from "vitest";
import { toForwardedPayload } from "../src/bridge/forward.js";
import { buildHooksConfig } from "../src/bridge/hooks-config.js";

describe("toForwardedPayload", () => {
  it("drops tool input so file contents never reach the companion", () => {
    // Arrange
    const stdin = JSON.stringify({
      hook_event_name: "PostToolUse",
      tool_name: "Write",
      tool_input: { file_path: "a.txt", content: "secret" },
      tool_response: { filePath: "a.txt" },
    });

    // Act
    const payload = toForwardedPayload(stdin);

    // Assert
    expect(payload).toEqual({ hook_event_name: "PostToolUse", tool_name: "Write" });
  });

  it("returns null for events the companion ignores", () => {
    expect(toForwardedPayload(JSON.stringify({ hook_event_name: "TaskCreated" }))).toBeNull();
  });

  it("throws on invalid JSON", () => {
    expect(() => toForwardedPayload("not json")).toThrow(/not valid JSON/);
  });
});

describe("buildHooksConfig", () => {
  it("uses forward slashes and async hooks for every forwarded event", () => {
    // Act
    const config = buildHooksConfig("C:\\Users\\nata\\waifu\\companion\\dist\\node\\bridge\\send-hook-event.js");

    // Assert
    const stop = config.hooks.Stop?.[0];
    expect(stop).toEqual({
      hooks: [
        {
          type: "command",
          command: 'node "C:/Users/nata/waifu/companion/dist/node/bridge/send-hook-event.js"',
          async: true,
        },
      ],
    });
    expect(config.hooks.PreToolUse?.[0]?.matcher).toBe("*");
    expect(Object.keys(config.hooks)).not.toContain("SubagentStop");
  });
});
