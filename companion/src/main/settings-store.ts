import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface CompanionSettings {
  modelPath: string | null;
  alwaysOnTop: boolean;
  officeOpen: boolean;
}

export const defaultSettings: CompanionSettings = {
  modelPath: null,
  alwaysOnTop: true,
  officeOpen: false,
};

/** Unknown or wrongly typed fields fall back to defaults instead of crashing startup. */
export function normalizeSettings(input: unknown): CompanionSettings {
  if (typeof input !== "object" || input === null) {
    return { ...defaultSettings };
  }
  const record = input as Record<string, unknown>;
  return {
    modelPath: typeof record.modelPath === "string" ? record.modelPath : defaultSettings.modelPath,
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
