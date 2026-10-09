import type { HookEventName } from "../shared/hook-event.js";

interface CommandHook {
  type: "command";
  command: string;
  /** Runs in the background so a slow or closed companion never delays Claude Code. */
  async: true;
}

interface HookMatcherGroup {
  matcher?: string;
  hooks: CommandHook[];
}

export type HooksConfig = { hooks: Partial<Record<HookEventName, HookMatcherGroup[]>> };

const forwardedEvents: readonly HookEventName[] = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "Notification",
  "Stop",
  "PreCompact",
  "SessionEnd",
];

const toolEvents: ReadonlySet<HookEventName> = new Set(["PreToolUse", "PostToolUse"]);

export function buildHooksConfig(bridgeScriptPath: string): HooksConfig {
  // Forward slashes work for node on Windows and avoid JSON backslash escaping.
  const scriptPath = bridgeScriptPath.replaceAll("\\", "/");
  const hook: CommandHook = { type: "command", command: `node "${scriptPath}"`, async: true };

  const hooks: HooksConfig["hooks"] = {};
  for (const eventName of forwardedEvents) {
    const group: HookMatcherGroup = { hooks: [hook] };
    if (toolEvents.has(eventName)) {
      group.matcher = "*";
    }
    hooks[eventName] = [group];
  }
  return { hooks };
}
