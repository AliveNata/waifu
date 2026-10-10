import { delimiter, join } from "node:path";

/** How to start the user's own Claude Code CLI on this machine. */
export interface ClaudeCommand {
  file: string;
  /** Windows .cmd shims (npm installs) only start through a shell. */
  shell: boolean;
}

/** Overrides the CLI path, for a non-standard install or the e2e fake. */
export const claudeCommandEnvVar = "WAIFU_CLAUDE_COMMAND";

/**
 * Finds `claude` on PATH. Windows has two installs: the native installer's
 * claude.exe, and npm's claude.cmd shim. Elsewhere the plain name works.
 */
export function resolveClaudeCommand(
  env: Record<string, string | undefined>,
  platform: NodeJS.Platform,
  exists: (path: string) => boolean,
): ClaudeCommand | null {
  const override = env[claudeCommandEnvVar];
  if (override !== undefined && override !== "") {
    return { file: override, shell: platform === "win32" && override.toLowerCase().endsWith(".cmd") };
  }
  const names = platform === "win32" ? ["claude.exe", "claude.cmd"] : ["claude"];
  const pathValue = env.PATH ?? env.Path ?? "";
  for (const directory of pathValue.split(platform === "win32" ? ";" : delimiter)) {
    if (directory === "") {
      continue;
    }
    for (const name of names) {
      const candidate = platform === "win32" ? `${directory.replace(/[\\/]+$/, "")}\\${name}` : join(directory, name);
      if (exists(candidate)) {
        return { file: candidate, shell: name.endsWith(".cmd") };
      }
    }
  }
  return null;
}

/**
 * Arguments for one chat turn. The prompt goes in on stdin as stream-json, so no
 * user text ever passes through a shell. Permission mode is pinned to "default":
 * newer CLIs may start in auto mode, which would let a classifier approve calls
 * the user expects to see as a card.
 */
export function chatArgs(settingsPath: string, sessionId: string | null): string[] {
  const args = [
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--permission-mode",
    "default",
    "--settings",
    settingsPath,
  ];
  if (sessionId !== null) {
    args.push("--resume", sessionId);
  }
  return args;
}

/** Quotes an argument for cmd.exe. Only paths and fixed flags reach here, never user text. */
export function quoteForCmd(arg: string): string {
  if (arg.includes('"')) {
    throw new Error(`argument cannot contain a double quote: ${arg}`);
  }
  return /[\s&|<>^()%!,;]/.test(arg) ? `"${arg}"` : arg;
}

/**
 * Variables a running Claude Code session sets for its own child processes. If the
 * companion was started from inside Claude Code, passing them on would tie the
 * office chat to that terminal session (same session ID) instead of its own.
 */
const parentSessionVars = [
  "CLAUDECODE",
  "CLAUDE_CODE_SESSION_ID",
  "CLAUDE_CODE_CHILD_SESSION",
  "CLAUDE_CODE_ENTRYPOINT",
  "CLAUDE_CODE_REMOTE_SESSION_ID",
  "CLAUDE_PID",
];

/** The environment for a chat run: the user's own, minus a parent session's identity. */
export function chatEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const result = { ...env };
  for (const name of parentSessionVars) {
    delete result[name];
  }
  return result;
}

/** One user turn in the CLI's stream-json input format. */
export function userMessageLine(text: string): string {
  return `${JSON.stringify({
    type: "user",
    message: { role: "user", content: text },
    parent_tool_use_id: null,
  })}\n`;
}

/**
 * Session-only settings that send every permission prompt to the office as an
 * HTTP hook. The token proves the request came from a run the office started,
 * so a terminal session can never ask the office (or be answered by it).
 */
export function permissionHookSettings(url: string, token: string, timeoutSeconds: number): unknown {
  return {
    hooks: {
      PermissionRequest: [
        {
          matcher: "*",
          hooks: [{ type: "http", url, timeout: timeoutSeconds, headers: { "x-office-token": token } }],
        },
      ],
    },
  };
}
