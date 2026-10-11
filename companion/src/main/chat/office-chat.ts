import { type ChildProcess, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { ChatEvent, ChatStatus } from "../../shared/office-chat.js";
import {
  type ClaudeCommand,
  chatArgs,
  chatEnv,
  permissionHookSettings,
  shellCommandLine,
  userMessageLine,
} from "./claude-command.js";
import type { PermissionGate } from "./permission-gate.js";
import { parseStreamLine } from "./stream-events.js";

/** How long the CLI waits on one permission card before it gives up and denies. */
export const permissionTimeoutSeconds = 600;
/** After SIGINT the CLI ends its turn; this is how long it gets before a hard stop. */
const stopGraceMs = 3000;
const stderrTailChars = 2000;

export interface OfficeChatOptions {
  /** Looked up on each run, so installing Claude Code while the app runs just works. */
  findCommand(): ClaudeCommand | null;
  /** Folder for the session-only hook settings file (the app's user data folder). */
  settingsDir: string;
  /** The office's permission endpoint, or null when the local server could not start. */
  permissionUrl: string | null;
  token: string;
  gate: PermissionGate;
  platform?: NodeJS.Platform;
}

interface OfficeChatEvents {
  event: [ChatEvent];
  status: [ChatStatus];
  /** The conversation to resume next time, or null after "new chat". */
  session: [string | null];
}

/**
 * One office conversation. Each message runs `claude -p` once and resumes the
 * same session, so the conversation carries on while every run stays short-lived
 * and easy to stop.
 */
export class OfficeChat extends EventEmitter<OfficeChatEvents> {
  private child: ChildProcess | null = null;
  private stopping = false;
  private problem: string | null = null;
  private settingsPath: string | null = null;

  constructor(
    private readonly options: OfficeChatOptions,
    private projectDir: string | null,
    private sessionId: string | null,
  ) {
    super();
    if (options.permissionUrl === null) {
      this.problem = "Server lokal companion nggak jalan, jadi kartu izin nggak bisa sampai ke kantor.";
    }
  }

  status(): ChatStatus {
    const state = this.problem !== null ? "unavailable" : this.child !== null ? "working" : "idle";
    return { state, projectDir: this.projectDir, problem: this.problem };
  }

  /** Asks the CLI whether it is installed and logged in, and reports that as the chat status. */
  async checkCli(): Promise<void> {
    if (this.options.permissionUrl === null) {
      this.emitStatus();
      return;
    }
    const command = this.options.findCommand();
    if (command === null) {
      this.problem = "Claude Code nggak ketemu. Install dulu, pastiin perintah claude jalan di terminal.";
      this.emitStatus();
      return;
    }
    const output = await this.capture(command, ["auth", "status"]);
    let loggedIn = false;
    try {
      loggedIn = (JSON.parse(output.stdout) as { loggedIn?: unknown }).loggedIn === true;
    } catch (error) {
      console.error("[chat] could not read `claude auth status`", error, output.stderr);
    }
    this.problem = loggedIn ? null : "Claude Code belum login. Jalanin claude di terminal sekali buat login.";
    this.emitStatus();
  }

  setProjectDir(projectDir: string): void {
    if (this.child !== null) {
      throw new Error("cannot switch folders while Claude is working");
    }
    if (projectDir !== this.projectDir) {
      this.projectDir = projectDir;
      this.newConversation();
    }
    this.emitStatus();
  }

  newConversation(): void {
    this.sessionId = null;
    this.emit("session", null);
  }

  send(text: string): void {
    const trimmed = text.trim();
    if (trimmed === "") {
      return;
    }
    if (this.child !== null) {
      this.emit("event", { kind: "error", message: "Claude masih ngerjain pesan sebelumnya. Tunggu atau stop dulu." });
      return;
    }
    if (this.problem !== null) {
      this.emit("event", { kind: "error", message: this.problem });
      return;
    }
    if (this.projectDir === null) {
      this.emit("event", { kind: "error", message: "Pilih folder project dulu." });
      return;
    }
    const command = this.options.findCommand();
    if (command === null) {
      this.problem = "Claude Code nggak ketemu. Install dulu, pastiin perintah claude jalan di terminal.";
      this.emitStatus();
      this.emit("event", { kind: "error", message: this.problem });
      return;
    }
    this.emit("event", { kind: "user", text: trimmed });
    this.run(command, this.projectDir, trimmed).catch((error: unknown) => {
      console.error("[chat] run failed to start", error);
      this.emit("event", { kind: "error", message: `Gagal jalanin Claude: ${(error as Error).message}` });
      this.child = null;
      this.emitStatus();
    });
  }

  /** Ends the current turn. Open permission cards turn into denies. */
  stop(): void {
    const child = this.child;
    if (child === null) {
      return;
    }
    this.stopping = true;
    this.options.gate.denyAll("Dihentikan dari kantor.");
    if ((this.options.platform ?? process.platform) === "win32" && child.pid !== undefined) {
      // A .cmd shim runs claude under cmd.exe, so only a tree kill reaches the CLI itself.
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true }).on("error", (error) =>
        console.error("[chat] taskkill failed", error),
      );
      return;
    }
    child.kill("SIGINT");
    setTimeout(() => {
      if (this.child === child) {
        child.kill("SIGTERM");
      }
    }, stopGraceMs).unref();
  }

  private async ensureSettingsFile(): Promise<string> {
    if (this.settingsPath !== null) {
      return this.settingsPath;
    }
    const url = this.options.permissionUrl;
    if (url === null) {
      throw new Error("permission endpoint is not available");
    }
    await mkdir(this.options.settingsDir, { recursive: true });
    const path = join(this.options.settingsDir, "office-chat-hooks.json");
    const settings = permissionHookSettings(url, this.options.token, permissionTimeoutSeconds);
    // The file holds this run's token, so only the user can read it.
    await writeFile(path, JSON.stringify(settings, null, 2), { encoding: "utf8", mode: 0o600 });
    await chmod(path, 0o600);
    this.settingsPath = path;
    return path;
  }

  private spawnCli(command: ClaudeCommand, args: string[], cwd: string | undefined): ChildProcess {
    const options = { cwd, windowsHide: true, env: chatEnv(process.env) };
    if (command.shell) {
      // One pre-quoted line: Node warns (DEP0190) when an args array goes through a shell,
      // because it only joins them. Only paths and fixed flags reach here, never chat text.
      return spawn(shellCommandLine(command.file, args), { ...options, shell: true });
    }
    return spawn(command.file, args, options);
  }

  private async run(command: ClaudeCommand, projectDir: string, text: string): Promise<void> {
    const settingsPath = await this.ensureSettingsFile();
    const child = this.spawnCli(command, chatArgs(settingsPath, this.sessionId), projectDir);
    this.child = child;
    this.stopping = false;
    this.emitStatus();

    let finished = false;
    let stderrTail = "";
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderrTail = (stderrTail + chunk).slice(-stderrTailChars);
    });
    const lines = createInterface({ input: child.stdout as NodeJS.ReadableStream });
    lines.on("line", (line) => {
      if (line.trim() === "") {
        return;
      }
      const parsed = parseStreamLine(line);
      if (parsed === null) {
        console.warn(`[chat] skipping a non-JSON line from claude: ${line.slice(0, 200)}`);
        return;
      }
      if (parsed.sessionId !== null && parsed.sessionId !== this.sessionId) {
        this.sessionId = parsed.sessionId;
        this.emit("session", parsed.sessionId);
      }
      for (const event of parsed.events) {
        if (event.kind === "done") {
          finished = true;
        }
        this.emit("event", event);
      }
    });
    child.on("error", (error) => {
      console.error("[chat] claude process error", error);
      this.emit("event", { kind: "error", message: `Claude Code nggak bisa dijalanin: ${error.message}` });
    });
    child.on("close", (code, signal) => {
      this.options.gate.denyAll("Run Claude sudah selesai.");
      if (!finished) {
        if (this.stopping) {
          this.emit("event", { kind: "done", ok: false, message: "Dihentikan." });
        } else {
          const reason = stderrTail.trim() === "" ? `kode ${String(code ?? signal)}` : stderrTail.trim();
          this.emit("event", { kind: "error", message: `Claude berhenti tanpa hasil: ${reason}` });
        }
      }
      this.child = null;
      this.stopping = false;
      this.emitStatus();
    });
    child.stdin?.on("error", (error) => console.error("[chat] could not write the prompt to claude", error));
    child.stdin?.end(userMessageLine(text));
  }

  private capture(command: ClaudeCommand, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const child = this.spawnCli(command, args, undefined);
      let stdout = "";
      let stderr = "";
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (chunk: string) => {
        stdout += chunk;
      });
      child.stderr?.on("data", (chunk: string) => {
        stderr += chunk;
      });
      child.on("error", (error) => {
        console.error("[chat] could not start claude", error);
        resolve({ stdout: "", stderr: error.message });
      });
      child.on("close", () => resolve({ stdout, stderr }));
    });
  }

  private emitStatus(): void {
    this.emit("status", this.status());
  }
}
