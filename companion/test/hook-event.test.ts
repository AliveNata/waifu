import { describe, expect, it } from "vitest";
import { parseHookPayload, shortenText } from "../src/shared/hook-event.js";

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

  it("keeps agent identity and a short report summary, but drops transcripts", () => {
    // Arrange
    const raw = {
      hook_event_name: "SubagentStop",
      agent_id: "agent-1",
      agent_type: "reviewer",
      last_assistant_message: "Verdict: PASS\n\nAll   tests green.",
      agent_transcript_path: "/x.jsonl",
    };

    // Act
    const result = parseHookPayload(raw);

    // Assert
    expect(result).toEqual({
      ok: true,
      value: {
        hook_event_name: "SubagentStop",
        agent_id: "agent-1",
        agent_type: "reviewer",
        summary: "Verdict: PASS\n\nAll tests green.",
      },
    });
  });

  it("takes only the agent name and short title from an Agent call, never the prompt", () => {
    // Arrange
    const raw = {
      hook_event_name: "PreToolUse",
      tool_name: "Agent",
      tool_input: { subagent_type: "data-engineer", description: "Fix dbt model", prompt: "secret context" },
    };

    // Act
    const result = parseHookPayload(raw);

    // Assert
    expect(result).toEqual({
      ok: true,
      value: {
        hook_event_name: "PreToolUse",
        tool_name: "Agent",
        subagent_type: "data-engineer",
        task_description: "Fix dbt model",
      },
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("parses the flattened payload the bridge forwards the same way", () => {
    // Arrange
    const forwarded = {
      hook_event_name: "PreToolUse",
      tool_name: "Agent",
      subagent_type: "reviewer",
      task_description: "x",
    };

    // Act + Assert
    expect(parseHookPayload(forwarded)).toEqual({ ok: true, value: forwarded });
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

describe("shortenText", () => {
  it("collapses whitespace and cuts at a word boundary", () => {
    expect(shortenText("alpha   beta\ngamma delta epsilon", 18)).toBe("alpha beta gamma…");
  });

  it("leaves short text untouched", () => {
    expect(shortenText("  done  ", 20)).toBe("done");
  });
});
