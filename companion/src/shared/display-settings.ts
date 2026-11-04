/** How the office is drawn: at what share of the screen's resolution, and how many frames at most. */
export interface OfficeDisplaySettings {
  /** Percent of the screen's own pixel density the office renders at. */
  renderScale: RenderScale;
  /** Frames per second at most, or 0 for as many as the screen shows. */
  fpsCap: FpsCap;
}

export const renderScales = [100, 75, 50] as const;
export type RenderScale = (typeof renderScales)[number];

export const fpsCaps = [0, 30, 60] as const;
export type FpsCap = (typeof fpsCaps)[number];

export const defaultDisplaySettings: OfficeDisplaySettings = { renderScale: 100, fpsCap: 0 };

function isRenderScale(value: unknown): value is RenderScale {
  return renderScales.includes(value as RenderScale);
}

function isFpsCap(value: unknown): value is FpsCap {
  return fpsCaps.includes(value as FpsCap);
}

/** Settings from storage or IPC, with anything missing or not one of the offered steps at its default. */
export function normalizeDisplaySettings(input: unknown): OfficeDisplaySettings {
  if (typeof input !== "object" || input === null) {
    return { ...defaultDisplaySettings };
  }
  const record = input as Record<string, unknown>;
  return {
    renderScale: isRenderScale(record.renderScale) ? record.renderScale : defaultDisplaySettings.renderScale,
    fpsCap: isFpsCap(record.fpsCap) ? record.fpsCap : defaultDisplaySettings.fpsCap,
  };
}
