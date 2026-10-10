/**
 * How dark it is outside, from the PC's local clock: 0 in full daylight, 1 at night. Dusk runs
 * 17:30 to 19:00 and dawn 05:00 to 06:30, eased, so the office dims over a while instead of
 * snapping when the hour turns.
 */
export function nightFactor(date: Date): number {
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const ramp = (from: number, to: number): number => {
    const t = Math.min(1, Math.max(0, (hours - from) / (to - from)));
    return t * t * (3 - 2 * t);
  };
  if (hours >= 12) {
    return ramp(17.5, 19);
  }
  return 1 - ramp(5, 6.5);
}
