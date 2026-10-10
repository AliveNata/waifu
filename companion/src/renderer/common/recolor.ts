export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** How dark the darkest detail and how bright the brightest detail end up, as multiples of the target color. */
export interface ShadeRange {
  low: number;
  high: number;
}

/** Pixels this dark are UV padding or pure black areas; they are ignored when measuring the texture's range. */
const paddingLuminance = 3;

function percentile(sorted: readonly number[], fraction: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

/**
 * Repaints RGBA pixels in place with `target`, keeping each pixel's relative
 * brightness as shading. Brightness is normalized between the texture's 5th
 * and 95th percentile, so mostly-black textures (irises on a black atlas,
 * black shorts) still pick up the color, and highlights never blow out to white.
 */
export function remapToColor(pixels: Uint8ClampedArray, target: Rgb, range: ShadeRange): void {
  const all: number[] = [];
  const lit: number[] = [];
  for (let index = 0; index < pixels.length; index += 4) {
    if ((pixels[index + 3] ?? 0) < 8) {
      continue;
    }
    const value = luminance(pixels[index] ?? 0, pixels[index + 1] ?? 0, pixels[index + 2] ?? 0);
    all.push(value);
    if (value > paddingLuminance) {
      lit.push(value);
    }
  }
  if (all.length === 0) {
    return;
  }
  // Use lit pixels unless the texture is essentially all black (a plain black garment).
  const sample = lit.length >= all.length * 0.05 ? lit : all;
  sample.sort((a, b) => a - b);
  const low = percentile(sample, 0.05);
  const high = Math.max(low + 1, percentile(sample, 0.95));

  for (let index = 0; index < pixels.length; index += 4) {
    if ((pixels[index + 3] ?? 0) < 8) {
      continue;
    }
    const value = luminance(pixels[index] ?? 0, pixels[index + 1] ?? 0, pixels[index + 2] ?? 0);
    const normalized = Math.min(1, Math.max(0, (value - low) / (high - low)));
    const factor = range.low + (range.high - range.low) * normalized;
    pixels[index] = target[0] * factor;
    pixels[index + 1] = target[1] * factor;
    pixels[index + 2] = target[2] * factor;
  }
}
