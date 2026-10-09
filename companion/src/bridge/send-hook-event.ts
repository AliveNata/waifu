/**
 * Claude Code hook command. Reads the hook payload from stdin and forwards a
 * trimmed version to the companion.
 *
 * Always exits 0: a non-zero exit would surface as a hook error in Claude Code,
 * and exit code 2 on PreToolUse would even block the tool call. The companion
 * being closed must never get in the way of real work, so failures are only
 * logged to stderr.
 */
import { text } from "node:stream/consumers";
import { resolveHookPort } from "../shared/protocol.js";
import { postHookPayload, toForwardedPayload } from "./forward.js";

const timeoutMs = 1500;

try {
  const payload = toForwardedPayload(await text(process.stdin));
  if (payload !== null) {
    await postHookPayload(payload, resolveHookPort(process.env), timeoutMs);
  }
} catch (error) {
  console.error(`[waifu-companion] hook not delivered: ${(error as Error).message}`);
}
process.exit(0);
