import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  chatArgs,
  chatEnv,
  permissionHookSettings,
  quoteForCmd,
  resolveClaudeCommand,
  shellCommandLine,
  userMessageLine,
} from "../src/main/chat/claude-command.js";
import { OfficeChat } from "../src/main/chat/office-chat.js";
import { deniedByUser, hookResponse, PermissionGate } from "../src/main/chat/permission-gate.js";
import { parseStreamLine } from "../src/main/chat/stream-events.js";
import { ChatLog, folderName } from "../src/renderer/office/chat-log.js";
import { insertMention, matchingTargets, mentionQuery } from "../src/renderer/office/mentions.js";
import { HookServer, permissionPath, permissionTokenHeader } from "../src/server/hook-server.js";
import {
  type ChatEvent,
  describeToolInput,
  expandCastMentions,
  summarizeToolInput,
} from "../src/shared/office-chat.js";

const fakeClaude = resolve(import.meta.dirname, "../e2e/fixtures/fake-claude.mjs");

describe("parseStreamLine", () => {
  it("streams main-thread text deltas", () => {
    // Arrange
    const line = JSON.stringify({
      type: "stream_event",
      parent_tool_use_id: null,
      event: { type: "content_block_delta", delta: { type: "text_delta", text: "Halo" } },
    });

    // Act
    const parsed = parseStreamLine(line);

    // Assert
    expect(parsed?.events).toEqual([{ kind: "text", text: "Halo" }]);
  });

  it("ignores subagent messages", () => {
    // Arrange
    const line = JSON.stringify({
      type: "assistant",
      parent_tool_use_id: "tool-9",
      message: { content: [{ type: "tool_use", name: "Bash", input: { command: "ls" } }] },
    });

    // Act + Assert
    expect(parseStreamLine(line)?.events).toEqual([]);
  });

  it("turns a tool call into a one-line note", () => {
    // Arrange
    const line = JSON.stringify({
      type: "assistant",
      parent_tool_use_id: null,
      message: {
        content: [
          { type: "text", text: "x" },
          { type: "tool_use", name: "Edit", input: { file_path: "a.ts" } },
        ],
      },
    });

    // Act + Assert
    expect(parseStreamLine(line)?.events).toEqual([{ kind: "tool", toolName: "Edit", summary: "a.ts" }]);
  });

  it.each([
    [
      { type: "result", subtype: "success", is_error: false, session_id: "s1" },
      { kind: "done", ok: true, message: null },
    ],
    [
      { type: "result", subtype: "error_max_turns", is_error: true, session_id: "s1" },
      { kind: "done", ok: false, message: "run berhenti (error_max_turns)" },
    ],
  ])("reports the end of a run", (message, expected) => {
    // Act
    const parsed = parseStreamLine(JSON.stringify(message));

    // Assert
    expect(parsed?.events).toEqual([expected]);
    expect(parsed?.sessionId).toBe("s1");
  });

  it("captures the session from the init message", () => {
    expect(parseStreamLine(JSON.stringify({ type: "system", subtype: "init", session_id: "abc" }))?.sessionId).toBe(
      "abc",
    );
  });

  it("returns null for a line that is not JSON", () => {
    expect(parseStreamLine("Warning: something")).toBeNull();
  });
});

describe("tool input text", () => {
  it.each([
    ["Bash", { command: "npm test\nnpm run lint" }, "npm test"],
    ["Write", { file_path: "src/a.ts", content: "x" }, "src/a.ts"],
    ["WebFetch", { url: "https://example.com", prompt: "p" }, "https://example.com"],
    ["Mystery", { other: 1 }, "Mystery"],
  ])("summarizes %s by what a person checks first", (tool, input, expected) => {
    expect(summarizeToolInput(tool, input)).toBe(expected);
  });

  it("cuts very long input so the card stays usable", () => {
    // Act
    const detail = describeToolInput({ file_path: "a", content: "x".repeat(10_000) });

    // Assert
    expect(detail.length).toBeLessThan(4200);
    expect(detail).toMatch(/karakter lagi\)$/);
  });
});

describe("claude command", () => {
  it("prefers the native claude.exe over the npm shim on Windows", () => {
    // Arrange
    const present = new Set(["C:\\tools\\claude.cmd", "C:\\bin\\claude.exe"]);

    // Act
    const command = resolveClaudeCommand({ PATH: "C:\\tools;C:\\bin" }, "win32", (path) => present.has(path));

    // Assert: the first PATH entry wins, and a .cmd shim needs a shell.
    expect(command).toEqual({ file: "C:\\tools\\claude.cmd", shell: true });
  });

  it("finds claude on a POSIX PATH and honors the override", () => {
    expect(resolveClaudeCommand({ PATH: "/usr/bin:/opt/bin" }, "linux", (path) => path === "/opt/bin/claude")).toEqual({
      file: "/opt/bin/claude",
      shell: false,
    });
    expect(resolveClaudeCommand({ WAIFU_CLAUDE_COMMAND: "/x/fake" }, "linux", () => false)).toEqual({
      file: "/x/fake",
      shell: false,
    });
    expect(resolveClaudeCommand({ PATH: "/usr/bin" }, "linux", () => false)).toBeNull();
  });

  it("pins the permission mode and resumes the conversation", () => {
    // Act
    const args = chatArgs("/tmp/hooks.json", "s1");

    // Assert
    expect(args.slice(args.indexOf("--permission-mode"), args.indexOf("--permission-mode") + 2)).toEqual([
      "--permission-mode",
      "default",
    ]);
    expect(args.slice(-2)).toEqual(["--resume", "s1"]);
    expect(chatArgs("/tmp/hooks.json", null)).not.toContain("--resume");
  });

  it("quotes paths with spaces for cmd.exe and refuses quotes", () => {
    expect(quoteForCmd("C:\\Users\\Alive Nata\\hooks.json")).toBe('"C:\\Users\\Alive Nata\\hooks.json"');
    expect(quoteForCmd("--verbose")).toBe("--verbose");
    expect(() => quoteForCmd('a"b')).toThrow(/double quote/);
  });

  it("builds one quoted cmd.exe line for the npm shim", () => {
    // Act
    const line = shellCommandLine("C:\\Program Files\\nodejs\\claude.cmd", ["auth", "status"]);

    // Assert
    expect(line).toBe('"C:\\Program Files\\nodejs\\claude.cmd" auth status');
  });

  it("drops a parent Claude Code session's identity from the environment", () => {
    // Act
    const env = chatEnv({ PATH: "/bin", CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "parent" });

    // Assert
    expect(env).toEqual({ PATH: "/bin" });
  });

  it("writes the prompt as one stream-json user message", () => {
    expect(JSON.parse(userMessageLine("halo"))).toEqual({
      type: "user",
      message: { role: "user", content: "halo" },
      parent_tool_use_id: null,
    });
  });

  it("routes every permission prompt to the office with the session token", () => {
    expect(permissionHookSettings("http://127.0.0.1:1/p", "t0k", 600)).toEqual({
      hooks: {
        PermissionRequest: [
          {
            matcher: "*",
            hooks: [{ type: "http", url: "http://127.0.0.1:1/p", timeout: 600, headers: { "x-office-token": "t0k" } }],
          },
        ],
      },
    });
  });
});

describe("PermissionGate", () => {
  it("resolves with the user's answer", async () => {
    // Arrange
    const gate = new PermissionGate();
    gate.on("ask", (ask) => gate.answer(ask.id, false));

    // Act
    const decision = await gate.request("Bash", { command: "rm -rf dist" }, new AbortController().signal);

    // Assert
    expect(decision).toEqual({ allowed: false, message: deniedByUser });
    expect(hookResponse(decision)).toEqual({
      hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "deny", message: deniedByUser } },
    });
  });

  it("denies when the CLI stops waiting or the run stops", async () => {
    // Arrange
    const gate = new PermissionGate();
    const aborter = new AbortController();
    const first = gate.request("Bash", { command: "a" }, aborter.signal);
    const second = gate.request("Bash", { command: "b" }, new AbortController().signal);

    // Act
    aborter.abort();
    gate.denyAll("Dihentikan.");

    // Assert
    expect((await first).allowed).toBe(false);
    expect(await second).toEqual({ allowed: false, message: "Dihentikan." });
    expect(gate.open()).toEqual([]);
  });
});

describe("ChatLog", () => {
  it("joins streamed text into one reply and starts a new one after a tool call", () => {
    // Arrange
    const log = new ChatLog();
    const events: ChatEvent[] = [
      { kind: "user", text: "cek tes" },
      { kind: "text", text: "Oke, " },
      { kind: "text", text: "aku cek." },
      { kind: "tool", toolName: "Bash", summary: "npm test" },
      { kind: "text", text: "Lulus." },
    ];

    // Act
    for (const event of events) {
      log.apply(event);
    }

    // Assert
    expect(log.entries).toEqual([
      { type: "user", text: "cek tes" },
      { type: "reply", text: "Oke, aku cek." },
      { type: "note", text: "Bash: npm test", tone: "muted" },
      { type: "reply", text: "Lulus." },
    ]);
  });

  it("marks a permission card as answered", () => {
    // Arrange
    const log = new ChatLog();
    const ask = { id: "p1", toolName: "Bash", summary: "ls", detail: "ls" };
    log.apply({ kind: "permission", ask });

    // Act
    const index = log.apply({ kind: "permission-settled", id: "p1", allowed: true });

    // Assert
    expect(index).toBe(0);
    expect(log.entries[0]).toEqual({ type: "permission", ask, state: "allowed" });
  });

  it.each([
    ["C:\\Users\\alive\\waifu", "waifu"],
    ["/home/alive/waifu/", "waifu"],
  ])("labels %s by its folder name", (path, expected) => {
    expect(folderName(path)).toBe(expected);
  });
});

describe("office chat with the CLI", () => {
  const servers: HookServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  async function setup(answer: boolean | null) {
    const gate = new PermissionGate();
    if (answer !== null) {
      gate.on("ask", (ask) => gate.answer(ask.id, answer));
    }
    const token = "test-token";
    const server = new HookServer({
      host: "127.0.0.1",
      port: 0,
      permissions: {
        token,
        handle: async (tool, input, signal) => hookResponse(await gate.request(tool, input, signal)),
      },
    });
    servers.push(server);
    const port = await server.listen();
    const dir = await mkdtemp(join(tmpdir(), "office-chat-"));
    const chat = new OfficeChat(
      {
        findCommand: () => ({ file: fakeClaude, shell: false }),
        settingsDir: dir,
        permissionUrl: `http://127.0.0.1:${port}${permissionPath}`,
        token,
        gate,
      },
      dir,
      null,
    );
    const events: ChatEvent[] = [];
    chat.on("event", (event) => events.push(event));
    const sessions: (string | null)[] = [];
    chat.on("session", (session) => sessions.push(session));
    const idle = () =>
      new Promise<void>((resolveIdle) => {
        const onStatus = (status: { state: string }) => {
          if (status.state === "idle") {
            chat.off("status", onStatus);
            resolveIdle();
          }
        };
        chat.on("status", onStatus);
      });
    return { chat, events, sessions, idle, port };
  }

  const replyOf = (events: ChatEvent[]) =>
    events
      .filter((event): event is Extract<ChatEvent, { kind: "text" }> => event.kind === "text")
      .map((event) => event.text)
      .join("");

  it("runs a turn, asks for permission over HTTP, and remembers the session", async () => {
    // Arrange
    const { chat, events, sessions, idle } = await setup(true);
    await chat.checkCli();

    // Act
    const finished = idle();
    chat.send("jalanin tes");
    await finished;

    // Assert
    expect(events.map((event) => event.kind)).toEqual(["user", "text", "tool", "text", "done"]);
    expect(replyOf(events)).toBe("Siap. Tugas: jalanin tes. Tes lulus.");
    expect(sessions).toEqual(["fake-session-1"]);
  });

  it("tells Claude the user said no", async () => {
    // Arrange
    const { chat, events, idle } = await setup(false);

    // Act
    const finished = idle();
    chat.send("hapus build");
    await finished;

    // Assert
    expect(replyOf(events)).toContain(`Nggak jadi: ${deniedByUser}`);
  });

  it("stops a run and reports it", async () => {
    // Arrange
    const { chat, events, idle } = await setup(null);
    const started = new Promise<void>((resolveStart) => chat.once("event", () => resolveStart()));

    // Act
    const finished = idle();
    chat.send("tugas lama");
    await started;
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
    chat.stop();
    await finished;

    // Assert
    expect(events.at(-1)).toEqual({ kind: "done", ok: false, message: "Dihentikan." });
  });

  it("refuses a permission request without the session token", async () => {
    // Arrange
    const { port } = await setup(true);

    // Act
    const response = await fetch(`http://127.0.0.1:${port}${permissionPath}`, {
      method: "POST",
      headers: { "content-type": "application/json", [permissionTokenHeader]: "guess" },
      body: JSON.stringify({ tool_name: "Bash", tool_input: { command: "ls" } }),
    });

    // Assert
    expect(response.status).toBe(403);
  });

  it("reports a missing login instead of running", async () => {
    // Arrange
    process.env.FAKE_CLAUDE_LOGGED_OUT = "1";
    const { chat, events } = await setup(true);

    // Act
    await chat.checkCli();
    delete process.env.FAKE_CLAUDE_LOGGED_OUT;
    chat.send("halo");

    // Assert
    expect(chat.status().state).toBe("unavailable");
    expect(events).toEqual([{ kind: "error", message: expect.stringMatching(/belum login/) }]);
  });
});

describe("cast mentions", () => {
  it.each([
    ["@Erza tolong cek ya", "@agent-erza tolong cek ya"],
    ["minta @rias sama @Asuna bantu", "minta @agent-rias sama @agent-asuna bantu"],
    ["@reviewer cek diff", "@agent-erza cek diff"],
    ["kirim ke alive@erza.dev", "kirim ke alive@erza.dev"],
    ["@2B halo", "@2B halo"],
    ["@Unknown halo", "@Unknown halo"],
  ])("sends %s to Claude as %s", (typed, sent) => {
    expect(expandCastMentions(typed)).toBe(sent);
  });

  it("lists every teammate except 2B for a bare @", () => {
    // Act
    const names = matchingTargets("").map((target) => target.displayName);

    // Assert
    expect(names).toEqual(["Chizuru", "Rias", "Asuna", "Kobayashi", "Yor", "Erza", "Ruby"]);
  });

  it.each([
    ["er", ["Erza"]],
    ["rev", ["Erza"]],
    ["data", ["Asuna"]],
    ["sre", ["Yor"]],
    ["r", ["Rias", "Ruby", "Erza"]],
  ])("filters by name or role for @%s", (query, expected) => {
    expect(
      matchingTargets(query)
        .map((target) => target.displayName)
        .sort(),
    ).toEqual([...expected].sort());
  });

  it("finds the @word being typed and replaces it with the picked name", () => {
    // Arrange
    const text = "tolong @er cek";
    const caret = "tolong @er".length;

    // Act
    const query = mentionQuery(text, caret);
    const erza = matchingTargets("er")[0];
    const result = query === null || erza === undefined ? null : insertMention(text, query, caret, erza);

    // Assert
    expect(query).toEqual({ start: 7, query: "er" });
    expect(result).toEqual({ text: "tolong @Erza cek", caret: "tolong @Erza ".length });
    expect(mentionQuery("mail alive@er", 13)).toBeNull();
  });
});
