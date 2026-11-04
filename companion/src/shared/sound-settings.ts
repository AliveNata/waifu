/** The office's sound effects setting: on or off, and a volume from 0 to 100. */
export interface OfficeSoundSettings {
  enabled: boolean;
  volume: number;
}

/** Low enough to sit under the music, until the person moves the slider. */
export const defaultSoundVolume = 50;

/** Off until switched on: a desktop app should not start making noise after an update. */
export const defaultSoundSettings: OfficeSoundSettings = { enabled: false, volume: defaultSoundVolume };

/** A volume the slider accepts: a whole number from 0 to 100. */
export function clampSoundVolume(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(Math.min(100, Math.max(0, value)))
    : defaultSoundVolume;
}

/** Settings from storage or IPC, with anything missing or wrongly typed back at its default. */
export function normalizeSoundSettings(input: unknown): OfficeSoundSettings {
  if (typeof input !== "object" || input === null) {
    return { ...defaultSoundSettings };
  }
  const record = input as Record<string, unknown>;
  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : defaultSoundSettings.enabled,
    volume: clampSoundVolume(record.volume),
  };
}
