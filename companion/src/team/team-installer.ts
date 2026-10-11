import { constants } from "node:fs";
import { copyFile, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { roster } from "../shared/team.js";

export const blockStart = "<!-- waifu-team:start -->";
export const blockEnd = "<!-- waifu-team:end -->";

/** Claude Code honors CLAUDE_CONFIG_DIR, so the installer does too. */
export function claudeConfigDir(env: Record<string, string | undefined>): string {
  return env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
}

/** Replaces the marked block if present, otherwise appends it. Text outside the markers is never touched. */
export function upsertMarkedBlock(existing: string, body: string): string {
  const block = `${blockStart}\n${body.trim()}\n${blockEnd}`;
  const start = existing.indexOf(blockStart);
  const end = existing.indexOf(blockEnd);
  if (start !== -1 && end > start) {
    return existing.slice(0, start) + block + existing.slice(end + blockEnd.length);
  }
  if (existing.trim() === "") {
    return `${block}\n`;
  }
  return `${existing.trimEnd()}\n\n${block}\n`;
}

/**
 * "retire" moves an agent this installer put in place under its old role-based name
 * (reviewer.md, architect.md, ...) to a backup, so Claude Code stops listing it next to the
 * renamed one. The file is renamed, never deleted.
 */
export type FileAction = "create" | "update" | "unchanged" | "retire";

/** Every agent file this project ever shipped says this; a user's own agent with the same name does not. */
const teamSignature = "in 2B's team";

export interface PlannedChange {
  target: string;
  action: FileAction;
  content: string;
}

export async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function actionFor(current: string | null, next: string): FileAction {
  if (current === null) {
    return "create";
  }
  return current === next ? "unchanged" : "update";
}

export async function planInstall(teamDir: string, configDir: string): Promise<PlannedChange[]> {
  const agentsSource = join(teamDir, "agents");
  const agentFiles = (await readdir(agentsSource)).filter((name) => name.endsWith(".md")).sort();
  const changes: PlannedChange[] = [];

  for (const fileName of agentFiles) {
    const content = await readFile(join(agentsSource, fileName), "utf8");
    const target = join(configDir, "agents", fileName);
    changes.push({ target, action: actionFor(await readOptional(target), content), content });
  }

  for (const profile of Object.values(roster)) {
    if (profile.legacyAgentType === null) {
      continue;
    }
    const target = join(configDir, "agents", `${profile.legacyAgentType}.md`);
    const current = await readOptional(target);
    if (current?.includes(teamSignature)) {
      changes.push({ target, action: "retire", content: current });
    }
  }

  const memoryPath = join(configDir, "CLAUDE.md");
  const currentMemory = await readOptional(memoryPath);
  const twobBlock = await readFile(join(teamDir, "2b.md"), "utf8");
  const nextMemory = upsertMarkedBlock(currentMemory ?? "", twobBlock);
  changes.push({ target: memoryPath, action: actionFor(currentMemory, nextMemory), content: nextMemory });

  return changes;
}

/**
 * Copies `path` to `<path>.bak-<timestamp>`, adding -2, -3, ... when that name is
 * taken, so two runs in the same second never overwrite the older backup.
 */
async function backupFile(path: string, timestamp: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const backupPath = `${path}.bak-${timestamp}${attempt === 1 ? "" : `-${attempt}`}`;
    try {
      await copyFile(path, backupPath, constants.COPYFILE_EXCL);
      return backupPath;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
  }
}

/**
 * Applies planned changes. Files that already exist with different content are
 * copied to `<file>.bak-<timestamp>` first, so a hand-edited agent is never lost,
 * and retired agents are backed up the same way before their old file goes.
 */
export async function applyInstall(changes: PlannedChange[], timestamp: string): Promise<string[]> {
  const backups: string[] = [];
  for (const change of changes) {
    if (change.action === "unchanged") {
      continue;
    }
    if (change.action === "retire") {
      // The backup holds the full content before the old name is taken out of Claude Code's list.
      backups.push(await backupFile(change.target, timestamp));
      await unlink(change.target);
      continue;
    }
    await mkdir(join(change.target, ".."), { recursive: true });
    if (change.action === "update") {
      backups.push(await backupFile(change.target, timestamp));
    }
    await writeFile(change.target, change.content, "utf8");
  }
  return backups;
}
