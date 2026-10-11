import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { describeToolInput, type PermissionAsk, summarizeToolInput } from "../../shared/office-chat.js";

export interface PermissionDecision {
  allowed: boolean;
  /** Told to Claude on a deny, so it explains instead of retrying blindly. */
  message: string;
}

interface PermissionGateEvents {
  ask: [PermissionAsk];
  settled: [string, boolean];
}

interface Pending {
  ask: PermissionAsk;
  resolve: (decision: PermissionDecision) => void;
}

export const deniedByUser = "Ditolak dari kantor AlyxLabs.";

/**
 * Holds tool calls that wait for the user. Every request ends in exactly one
 * decision: the user's answer, a deny when the run stops, or a deny when the
 * CLI gives up waiting (the HTTP request closes).
 */
export class PermissionGate extends EventEmitter<PermissionGateEvents> {
  private readonly pending = new Map<string, Pending>();

  request(toolName: string, input: unknown, signal: AbortSignal): Promise<PermissionDecision> {
    const ask: PermissionAsk = {
      id: randomUUID(),
      toolName,
      summary: summarizeToolInput(toolName, input),
      detail: describeToolInput(input),
    };
    return new Promise((resolve) => {
      this.pending.set(ask.id, { ask, resolve });
      signal.addEventListener(
        "abort",
        () => this.settle(ask.id, { allowed: false, message: "Permintaan izin dibatalkan." }),
        {
          once: true,
        },
      );
      this.emit("ask", ask);
    });
  }

  answer(id: string, allowed: boolean): void {
    if (!this.pending.has(id)) {
      console.error(`[chat] ignoring an answer for unknown permission ${id}`);
      return;
    }
    this.settle(id, { allowed, message: allowed ? "" : deniedByUser });
  }

  /** Denies everything still open, for example when the user stops the run or closes the office. */
  denyAll(message: string): void {
    for (const id of [...this.pending.keys()]) {
      this.settle(id, { allowed: false, message });
    }
  }

  open(): PermissionAsk[] {
    return [...this.pending.values()].map((entry) => entry.ask);
  }

  private settle(id: string, decision: PermissionDecision): void {
    const entry = this.pending.get(id);
    if (entry === undefined) {
      return;
    }
    this.pending.delete(id);
    entry.resolve(decision);
    this.emit("settled", id, decision.allowed);
  }
}

/** The PermissionRequest hook response the CLI expects back. */
export function hookResponse(decision: PermissionDecision): unknown {
  return {
    hookSpecificOutput: {
      hookEventName: "PermissionRequest",
      decision: decision.allowed ? { behavior: "allow" } : { behavior: "deny", message: decision.message },
    },
  };
}
