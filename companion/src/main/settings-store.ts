import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { isMemberId, type MemberId } from "../shared/team.js";

export interface CompanionSettings {
  modelPaths: Partial<Record<MemberId, string>>;
  alwaysOnTop: boolean;
  officeOpen: boolean;
}

export const defaultSettings: CompanionSettings = {
  modelPaths: {},
  alwaysOnTop: true,
  officeOpen: false,
};

/** Unknown or wrongly typed fields fall back to defaults instead of crashing startup. */
export function normalizeSettings(input: unknown): CompanionSettings {
  if (typeof input !== "object" || input === null) {
    return { ...defaultSettings };
  }
  const record = input as Record<string, unknown>;
  const modelPaths: Partial<Record<MemberId, string>> = {};
  if (typeof record.modelPaths === "object" && record.modelPaths !== null) {
    for (const [memberId, path] of Object.entries(record.modelPaths)) {
      if (isMemberId(memberId) && typeof path === "string") {
        modelPaths[memberId] = path;
      }
    }
  }
  // Settings from before the team existed stored only Xenovia's model.
  if (modelPaths.xenovia === undefined && typeof record.modelPath === "string") {
    modelPaths.xenovia = record.modelPath;
  }
  return {
    modelPaths,
    alwaysOnTop: typeof record.alwaysOnTop === "boolean" ? record.alwaysOnTop : defaultSettings.alwaysOnTop,
    officeOpen: typeof record.officeOpen === "boolean" ? record.officeOpen : defaultSettings.officeOpen,
  };
}

export async function loadSettings(filePath: string): Promise<CompanionSettings> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...defaultSettings };
    }
    throw error;
  }
  try {
    return normalizeSettings(JSON.parse(raw));
  } catch (error) {
    console.error(`[settings] ${filePath} is not valid JSON, using defaults`, error);
    return { ...defaultSettings };
  }
}

export async function saveSettings(filePath: string, settings: CompanionSettings): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  // Write-then-rename so a crash mid-write never leaves a truncated settings file.
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(settings, null, 2), "utf8");
  await rename(temporaryPath, filePath);
}
