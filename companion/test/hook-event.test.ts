import { describe, expect, it } from "vitest";
import { parseHookPayload } from "../src/shared/hook-event.js";

describe("parseHookPayload", () => {
  it("keeps only the fields the companion uses", () => {
    // Arrange
    const raw = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "cat secrets.txt" },
      session_id: "abc",
    };

    // Act
    const result = parseHookPayload(raw);

    // Assert
    expect(result).toEqual({ ok: true, value: { hook_event_name: "PreToolUse", tool_name: "Bash" } });
  });

  it("keeps agent identity and drops subagent transcripts", () => {
    // Arrange
    const raw = {
      hook_event_name: "SubagentStop",
      agent_id: "agent-1",
      agent_type: "reviewer",
      last_assistant_message: "private findings",
      agent_transcript_path: "/x.jsonl",
    };

    // Act
    const result = parseHookPayload(raw);

    // Assert
    expect(result).toEqual({
      ok: true,
      value: { hook_event_name: "SubagentStop", agent_id: "agent-1", agent_type: "reviewer" },
    });
  });

  it("drops empty agent fields from internal agents", () => {
    expect(parseHookPayload({ hook_event_name: "Stop", agent_id: "", agent_type: "" })).toEqual({
      ok: true,
      value: { hook_event_name: "Stop" },
    });
  });

  it("truncates long notification messages", () => {
    // Arrange
    const raw = { hook_event_name: "Notification", message: "x".repeat(500) };

    // Act
    const result = parseHookPayload(raw);

    // Assert
    expect(result.ok && result.value.message?.length).toBe(200);
  });

  it.each([
    [null, "payload must be a JSON object"],
    [[], "payload must be a JSON object"],
    [{ hook_event_name: "Teleport" }, "unsupported hook_event_name: Teleport"],
    [{ hook_event_name: "PreToolUse", tool_name: 42 }, "tool_name must be a string"],
  ])("rejects %j", (raw, error) => {
    // Act
    const result = parseHookPayload(raw);

    // Assert
    expect(result).toEqual({ ok: false, error });
  });
});
