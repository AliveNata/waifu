import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

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

export type FileAction = "create" | "update" | "unchanged";

export interface PlannedChange {
  target: string;
  action: FileAction;
  content: string;
}

async function readOptional(path: string): Promise<string | null> {
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

  const memoryPath = join(configDir, "CLAUDE.md");
  const currentMemory = await readOptional(memoryPath);
  const xenoviaBlock = await readFile(join(teamDir, "xenovia.md"), "utf8");
  const nextMemory = upsertMarkedBlock(currentMemory ?? "", xenoviaBlock);
  changes.push({ target: memoryPath, action: actionFor(currentMemory, nextMemory), content: nextMemory });

  return changes;
}

/**
 * Applies planned changes. Files that already exist with different content are
 * copied to `<file>.bak-<timestamp>` first, so a hand-edited agent is never lost.
 */
export async function applyInstall(changes: PlannedChange[], timestamp: string): Promise<string[]> {
  const backups: string[] = [];
  for (const change of changes) {
    if (change.action === "unchanged") {
      continue;
    }
    await mkdir(join(change.target, ".."), { recursive: true });
    if (change.action === "update") {
      const backupPath = `${change.target}.bak-${timestamp}`;
      await copyFile(change.target, backupPath);
      backups.push(backupPath);
    }
    await writeFile(change.target, change.content, "utf8");
  }
  return backups;
}
