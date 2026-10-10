import { afterEach, describe, expect, it } from "vitest";
import { HookServer } from "../src/server/hook-server.js";
import type { CompanionSignal } from "../src/shared/reaction.js";

let server: HookServer | null = null;

async function startServer(): Promise<{ server: HookServer; base: string }> {
  server = new HookServer({ host: "127.0.0.1", port: 0, now: () => 1234 });
  const port = await server.listen();
  return { server, base: `http://127.0.0.1:${port}` };
}

function postJson(base: string, body: string, contentType = "application/json"): Promise<Response> {
  return fetch(`${base}/hook`, { method: "POST", headers: { "content-type": contentType }, body });
}

afterEach(async () => {
  await server?.close();
  server = null;
});

describe("HookServer", () => {
  it("emits a reaction for a valid hook", async () => {
    // Arrange
    const { server, base } = await startServer();
    const received: CompanionSignal[] = [];
    server.on("signal", (signal) => received.push(signal));

    // Act
    const response = await postJson(base, JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Bash" }));

    // Assert
    expect(response.status).toBe(202);
    expect(received).toEqual([{ kind: "reaction", reaction: { mood: "working", detail: "Bash", receivedAt: 1234 } }]);
  });

  it("emits a member signal for a team subagent", async () => {
    // Arrange
    const { server, base } = await startServer();
    const received: CompanionSignal[] = [];
    server.on("signal", (signal) => received.push(signal));

    // Act
    await postJson(base, JSON.stringify({ hook_event_name: "SubagentStart", agent_id: "a1", agent_type: "reviewer" }));

    // Assert
    expect(received).toEqual([
      {
        kind: "member",
        member: { memberId: "erza", activity: "start", agentId: "a1", tool: null, summary: null, receivedAt: 1234 },
      },
    ]);
  });

  it("accepts ignored events without emitting", async () => {
    // Arrange
    const { server, base } = await startServer();
    const received: CompanionSignal[] = [];
    server.on("signal", (signal) => received.push(signal));

    // Act
    const response = await postJson(
      base,
      JSON.stringify({ hook_event_name: "SubagentStop", agent_id: "x", agent_type: "Explore" }),
    );

    // Assert
    expect(response.status).toBe(202);
    expect(received).toEqual([]);
  });

  it.each([
    ["non-JSON content type", '{"hook_event_name":"Stop"}', "text/plain", 415],
    ["broken JSON", "{", "application/json", 400],
    ["unknown event", '{"hook_event_name":"Nope"}', "application/json", 400],
    ["oversized body", JSON.stringify({ hook_event_name: "Stop", pad: "x".repeat(20_000) }), "application/json", 413],
  ])("rejects %s", async (_label, body, contentType, status) => {
    // Arrange
    const { base } = await startServer();

    // Act
    const response = await postJson(base, body, contentType);

    // Assert
    expect(response.status).toBe(status);
  });

  it("does not serve pages or events outside web mode", async () => {
    // Arrange
    const { base } = await startServer();

    // Act
    const response = await fetch(`${base}/events`);

    // Assert
    expect(response.status).toBe(404);
  });

  it("reports a busy port as a listen error", async () => {
    // Arrange
    const { base } = await startServer();
    const busyPort = Number(new URL(base).port);
    const second = new HookServer({ host: "127.0.0.1", port: busyPort });

    // Act + Assert
    await expect(second.listen()).rejects.toMatchObject({ code: "EADDRINUSE" });
  });
});
