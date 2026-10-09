import { type CompanionHookPayload, parseHookPayload } from "../shared/hook-event.js";

/**
 * Reduce the raw Claude Code hook payload to the fields the companion uses.
 * Returns null for events the companion does not handle, so the bridge can
 * skip the HTTP call entirely.
 */
export function toForwardedPayload(rawStdin: string): CompanionHookPayload | null {
  let json: unknown;
  try {
    json = JSON.parse(rawStdin);
  } catch (error) {
    throw new Error(`hook stdin is not valid JSON: ${(error as Error).message}`);
  }
  const parsed = parseHookPayload(json);
  return parsed.ok ? parsed.value : null;
}

export async function postHookPayload(payload: CompanionHookPayload, port: number, timeoutMs: number): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${port}/hook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`companion answered ${response.status}: ${await response.text()}`);
  }
}
