import { join } from "node:path";
import { type PlannedChange, readOptional } from "../team/team-installer.js";
import type { HooksConfig } from "./hooks-config.js";

/** The bridge script name identifies our entries, even ones left behind by a checkout that moved. */
export const bridgeScriptName = "send-hook-event.js";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOurHook(hook: unknown): boolean {
  return isObject(hook) && typeof hook.command === "string" && hook.command.includes(bridgeScriptName);
}

/** Drops our hooks from one event's matcher groups. Groups that only held ours disappear, others stay as they are. */
function withoutOurHooks(groups: unknown[]): unknown[] {
  const kept: unknown[] = [];
  for (const group of groups) {
    if (!isObject(group) || !Array.isArray(group.hooks) || !group.hooks.some(isOurHook)) {
      kept.push(group);
      continue;
    }
    const otherHooks = group.hooks.filter((hook) => !isOurHook(hook));
    if (otherHooks.length > 0) {
      kept.push({ ...group, hooks: otherHooks });
    }
  }
  return kept;
}

/**
 * Returns settings with our hooks removed everywhere and, unless `config` is
 * null, added back once per event at the end. Other keys and other hooks are kept.
 * Throws on a shape Claude Code would not accept either, instead of guessing.
 */
export function mergeHooks(settings: JsonObject, config: HooksConfig | null): JsonObject {
  const currentHooks = settings.hooks ?? {};
  if (!isObject(currentHooks)) {
    throw new Error('"hooks" di settings.json bukan object. Rapihin dulu manual, nggak ada yang diubah.');
  }
  const nextHooks: JsonObject = {};
  for (const [eventName, groups] of Object.entries(currentHooks)) {
    if (!Array.isArray(groups)) {
      throw new Error(`"hooks.${eventName}" di settings.json bukan array. Rapihin dulu manual, nggak ada yang diubah.`);
    }
    const kept = withoutOurHooks(groups);
    // An event that only held our hooks goes away entirely instead of lingering as [].
    if (kept.length > 0 || !groups.some((group) => isObject(group) && Array.isArray(group.hooks))) {
      nextHooks[eventName] = kept;
    }
  }
  for (const [eventName, groups] of Object.entries(config?.hooks ?? {})) {
    const existing = (nextHooks[eventName] as unknown[] | undefined) ?? [];
    nextHooks[eventName] = [...existing, ...(groups ?? [])];
  }

  const next: JsonObject = { ...settings, hooks: nextHooks };
  if (Object.keys(nextHooks).length === 0) {
    delete next.hooks;
  }
  return next;
}

/** Key order does not matter to Claude Code, so it must not turn an installed config into an "update". */
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }
  if (isObject(value)) {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export function settingsPath(configDir: string): string {
  return join(configDir, "settings.json");
}

/** Plans the settings.json change. Pass `config: null` to uninstall. */
export async function planHooksInstall(configDir: string, config: HooksConfig | null): Promise<PlannedChange> {
  const target = settingsPath(configDir);
  const currentText = await readOptional(target);
  let current: JsonObject = {};
  if (currentText !== null && currentText.trim() !== "") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(currentText);
    } catch (error) {
      throw new Error(`${target} bukan JSON valid (${(error as Error).message}). Nggak ada yang diubah.`);
    }
    if (!isObject(parsed)) {
      throw new Error(`${target} harus berisi object JSON. Nggak ada yang diubah.`);
    }
    current = parsed;
  }

  const next = mergeHooks(current, config);
  const content = `${JSON.stringify(next, null, 2)}\n`;
  if (currentText === null) {
    return { target, action: config === null ? "unchanged" : "create", content };
  }
  return { target, action: canonical(current) === canonical(next) ? "unchanged" : "update", content };
}
