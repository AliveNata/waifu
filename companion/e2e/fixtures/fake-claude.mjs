#!/usr/bin/env node
// Stand-in for the `claude` CLI in tests: speaks the same stream-json and calls the
// PermissionRequest HTTP hook from --settings, so the office chat runs end to end
// without a login or network.
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const line = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);

if (args[0] === "auth" && args[1] === "status") {
  line({ loggedIn: process.env.FAKE_CLAUDE_LOGGED_OUT !== "1", authMethod: "claude.ai" });
  process.exit(0);
}

const settingsPath = args[args.indexOf("--settings") + 1];
const resumeIndex = args.indexOf("--resume");
const sessionId = resumeIndex === -1 ? "fake-session-1" : args[resumeIndex + 1];
const hook = JSON.parse(readFileSync(settingsPath, "utf8")).hooks.PermissionRequest[0].hooks[0];

let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
}
const prompt = JSON.parse(input.trim().split("\n")[0]).message.content;

const say = (text) =>
  line({
    type: "stream_event",
    parent_tool_use_id: null,
    session_id: sessionId,
    event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
  });

line({ type: "system", subtype: "init", session_id: sessionId, permissionMode: "default", cwd: process.cwd() });
say(`Siap. Tugas: ${prompt}.`);
if (prompt.includes("lama")) {
  // Keeps the run alive so a test can press Stop.
  await new Promise((resolve) => setTimeout(resolve, 60_000));
}
const command = "npm test";
line({
  type: "assistant",
  parent_tool_use_id: null,
  session_id: sessionId,
  message: { content: [{ type: "tool_use", id: "tool-1", name: "Bash", input: { command } }] },
});
const response = await fetch(hook.url, {
  method: "POST",
  headers: { "content-type": "application/json", ...hook.headers },
  body: JSON.stringify({ hook_event_name: "PermissionRequest", tool_name: "Bash", tool_input: { command } }),
});
const decision = (await response.json()).hookSpecificOutput.decision;
say(decision.behavior === "allow" ? " Tes lulus." : ` Nggak jadi: ${decision.message}`);
line({ type: "result", subtype: "success", is_error: false, result: "ok", session_id: sessionId });
