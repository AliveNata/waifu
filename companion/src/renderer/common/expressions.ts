import type { Mood } from "../../shared/reaction.js";

export type ExpressionWeights = Readonly<Record<string, number>>;

/** VRM 1.0 preset names. three-vrm maps VRM 0.x presets (joy, fun, ...) onto these. */
const moodExpressions: Record<Mood, ExpressionWeights> = {
  idle: {},
  greeting: { happy: 0.8 },
  thinking: { relaxed: 0.35 },
  working: {},
  waiting: { surprised: 0.45 },
  done: { happy: 1 },
};

export function expressionTargetsForMood(mood: Mood): ExpressionWeights {
  return moodExpressions[mood];
}

/**
 * Moves every weight toward its target at a fixed rate so expressions ease in
 * and out instead of snapping between moods.
 */
export function stepExpressionWeights(
  current: ExpressionWeights,
  target: ExpressionWeights,
  deltaSeconds: number,
  ratePerSecond = 4,
): Record<string, number> {
  const next: Record<string, number> = {};
  const maxStep = ratePerSecond * deltaSeconds;
  const names = new Set([...Object.keys(current), ...Object.keys(target)]);
  for (const name of names) {
    const from = current[name] ?? 0;
    const to = target[name] ?? 0;
    const difference = to - from;
    const value = Math.abs(difference) <= maxStep ? to : from + Math.sign(difference) * maxStep;
    if (value !== 0 || to !== 0) {
      next[name] = value;
    }
  }
  return next;
}

const blinkDurationSeconds = 0.16;
const minBlinkGapSeconds = 2.2;
const blinkGapRangeSeconds = 3.6;

/** Random blinking. `random` is injectable so tests are deterministic. */
export class BlinkScheduler {
  private nextBlinkAt: number;

  constructor(private readonly random: () => number = Math.random) {
    this.nextBlinkAt = this.gap();
  }

  weightAt(timeSeconds: number): number {
    const sinceStart = timeSeconds - this.nextBlinkAt;
    if (sinceStart < 0) {
      return 0;
    }
    if (sinceStart >= blinkDurationSeconds) {
      this.nextBlinkAt = timeSeconds + this.gap();
      return 0;
    }
    const half = blinkDurationSeconds / 2;
    return sinceStart < half ? sinceStart / half : (blinkDurationSeconds - sinceStart) / half;
  }

  private gap(): number {
    return minBlinkGapSeconds + this.random() * blinkGapRangeSeconds;
  }
}
