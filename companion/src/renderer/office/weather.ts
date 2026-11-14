/**
 * Whether it rains on an office day. Picked from the date itself, so every window open on the same
 * day agrees and a reload does not change the weather. About one day in four is wet.
 */
export type Weather = "clear" | "rain";

/** One in this many days rains. */
const rainEvery = 4;

/**
 * FNV-1a over the text, then MurmurHash3's finalizer: FNV alone keeps its low bits nearly in step
 * for dates a day apart, which made the rain come back every third or fourth day like clockwork.
 */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35) >>> 0;
  value ^= value >>> 16;
  return value >>> 0;
}

/** The weather for an office day, as officeDay writes it ("2026-11-14"). */
export function weatherFor(day: string): Weather {
  return hash(`weather:${day}`) % rainEvery === 0 ? "rain" : "clear";
}

/** `?weather=rain` or `?weather=clear` on the office page, to check either without waiting for one. */
export function weatherOverride(search: string): Weather | null {
  const value = new URLSearchParams(search).get("weather");
  return value === "rain" || value === "clear" ? value : null;
}
