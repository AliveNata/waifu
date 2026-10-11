import { mkdir, mkdtemp, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  claudeConfigDir,
  isSessionId,
  listSessions,
  projectSessionsDir,
  promptText,
  sessionTranscript,
} from "../src/main/chat/session-store.js";
import { relativeTimeLabel } from "../src/renderer/office/chat-log.js";

const idA = "11111111-2222-4333-8444-555555555555";
const idB = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const idEmpty = "99999999-8888-4777-8666-555555555555";

function jsonl(entries: unknown[]): string {
  return entries.map((entry) => JSON.stringify(entry)).join("\n");
}

const user = (content: unknown, extra: Record<string, unknown> = {}) => ({
  type: "user",
  message: { role: "user", content },
  ...extra,
});

describe("projectSessionsDir", () => {
  it("names the folder the way Claude Code does, every non-alphanumeric character as a dash", () => {
    // Act
    const posix = projectSessionsDir("/home/me/.claude", "/home/me/waifu");
    const windows = projectSessionsDir("C:\\Users\\me\\.claude", "C:\\Users\\RATAMATE\\waifu");

    // Assert
    expect(posix).toBe(join("/home/me/.claude", "projects", "-home-me-waifu"));
    expect(windows.endsWith("C--Users-RATAMATE-waifu")).toBe(true);
  });

  it("honors CLAUDE_CONFIG_DIR", () => {
    // Act + Assert
    expect(claudeConfigDir({ CLAUDE_CONFIG_DIR: "/custom" }, "/home/me")).toBe("/custom");
    expect(claudeConfigDir({}, "/home/me")).toBe(join("/home/me", ".claude"));
  });
});

describe("promptText", () => {
  it.each([
    [user("rapihin README"), "rapihin README"],
    [user([{ type: "text", text: "cek ini" }]), "cek ini"],
    [user([{ type: "tool_result", tool_use_id: "t", content: "ok" }]), null],
    [user("<command-name>/clear</command-name>"), null],
    [user("catatan sistem", { isMeta: true }), null],
    [user("prompt subagent", { isSidechain: true }), null],
    [{ type: "assistant", message: { content: [] } }, null],
  ])("reads %j as %j", (entry, expected) => {
    // Act + Assert
    expect(promptText(entry)).toBe(expected);
  });
});

describe("listSessions", () => {
  it("lists sessions newest first, titled by their first typed prompt, skipping ones without a prompt", async () => {
    // Arrange
    const dir = await mkdtemp(join(tmpdir(), "sessions-"));
    await writeFile(
      join(dir, `${idA}.jsonl`),
      jsonl([user("<command-name>/init</command-name>"), user("rapihin README")]),
    );
    await writeFile(join(dir, `${idB}.jsonl`), jsonl([user("bikin  test\nbuat parser")]));
    await writeFile(join(dir, `${idEmpty}.jsonl`), jsonl([{ type: "summary", summary: "x" }]));
    await writeFile(join(dir, "not-a-session.jsonl"), jsonl([user("abaikan")]));
    await mkdir(join(dir, idA));
    await utimes(join(dir, `${idA}.jsonl`), new Date(1_000_000), new Date(1_000_000));
    await utimes(join(dir, `${idB}.jsonl`), new Date(2_000_000), new Date(2_000_000));

    // Act
    const sessions = await listSessions(dir);

    // Assert
    expect(sessions.map((session) => [session.id, session.title])).toEqual([
      [idB, "bikin test buat parser"],
      [idA, "rapihin README"],
    ]);
  });

  it("returns an empty list when the folder has no sessions yet", async () => {
    // Act
    const sessions = await listSessions(join(tmpdir(), "no-such-sessions-folder"));

    // Assert
    expect(sessions).toEqual([]);
  });
});

describe("sessionTranscript", () => {
  it("turns the stored conversation into chat events, leaving subagent turns out", async () => {
    // Arrange
    const dir = await mkdtemp(join(tmpdir(), "transcript-"));
    const file = join(dir, `${idA}.jsonl`);
    await writeFile(
      file,
      jsonl([
        user("rapihin README"),
        { type: "assistant", message: { content: [{ type: "text", text: "Oke." }] } },
        {
          type: "assistant",
          message: { content: [{ type: "tool_use", name: "Edit", input: { file_path: "README.md" } }] },
        },
        user([{ type: "tool_result", tool_use_id: "t", content: "ok" }]),
        { type: "assistant", isSidechain: true, message: { content: [{ type: "text", text: "subagent" }] } },
        { type: "assistant", message: { content: [{ type: "text", text: "Udah." }] } },
        { type: "assistant", message: { content: [{ type: "text", text: "Ada lagi?" }] } },
        "not json",
      ]),
    );

    // Act
    const events = await sessionTranscript(file);

    // Assert
    expect(events).toEqual([
      { kind: "user", text: "rapihin README" },
      { kind: "text", text: "Oke." },
      { kind: "tool", toolName: "Edit", summary: "README.md" },
      { kind: "text", text: "Udah." },
      { kind: "text", text: "\n\nAda lagi?" },
    ]);
  });
});

describe("isSessionId", () => {
  it("accepts only UUID-shaped ids, never paths", () => {
    // Act + Assert
    expect(isSessionId(idA)).toBe(true);
    expect(isSessionId("../../etc/passwd")).toBe(false);
    expect(isSessionId(`${idA}/../x`)).toBe(false);
  });
});

describe("relativeTimeLabel", () => {
  it.each([
    [30_000, "baru aja"],
    [5 * 60_000, "5 menit lalu"],
    [3 * 3_600_000, "3 jam lalu"],
    [30 * 3_600_000, "kemarin"],
    [4 * 86_400_000, "4 hari lalu"],
  ])("labels %d ms ago as %s", (ago, label) => {
    // Arrange
    const now = Date.UTC(2026, 9, 11, 12);

    // Act + Assert
    expect(relativeTimeLabel(now - ago, now)).toBe(label);
  });

  it("falls back to a short date after a week", () => {
    // Arrange
    const then = new Date(2026, 8, 3, 12).getTime();

    // Act + Assert
    expect(relativeTimeLabel(then, then + 20 * 86_400_000)).toBe("3 Sep");
  });
});
