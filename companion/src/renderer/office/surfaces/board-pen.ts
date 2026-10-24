import { charAdvance, type Diagram, diagramInk, penPosition, type Stroke, strokeInk, type Vec2 } from "./drawing.js";

/** Where the pen is and what the hand holding it is doing. */
export interface PenState {
  /** Pen tip in the drawing's own UV (0..1). */
  at: Vec2;
  /** On the board leaving ink. False while the hand lifts between strokes or pauses to think. */
  touching: boolean;
  /** Stepping back to look the drawing over. */
  reviewing: boolean;
}

const inkPerSecond = 0.45;
/** Lifting the pen off and placing it again, plus the time to cross the board. */
const travelBaseSeconds = 0.22;
const travelSecondsPerUnit = 0.9;
/** After a stroke: how often someone stops to think, and how often they step back to look. */
const pauseChance = 0.3;
const reviewChance = 0.12;

type Step =
  | { kind: "stroke" }
  | { kind: "hold"; at: Vec2; seconds: number; reviewing: boolean }
  | { kind: "travel"; from: Vec2; to: Vec2; seconds: number; elapsed: number };

/**
 * Handwriting drifts up and down a little as the letters go by; the drawn text only appears a
 * whole character at a time, so the pen glides continuously instead of hopping per character.
 */
function tipOf(stroke: Stroke, fraction: number): Vec2 {
  if (stroke.kind !== "text") {
    return penPosition(stroke, fraction);
  }
  const characters = stroke.text.length * fraction;
  const wobble = 0.012 * stroke.size * Math.sin(characters * Math.PI * 2);
  return [stroke.at[0] + characters * charAdvance * stroke.size, stroke.at[1] + wobble];
}

function smoothstep(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Draws one diagram the way a person does: a stroke with the pen down, then the pen lifted and
 * carried to where the next stroke starts, now and then a pause to think or a step back to look.
 * `random` is injectable so tests can pin those choices.
 */
export class BoardPen {
  /** Ink laid down so far, in the diagram's units. */
  ink = 0;
  private strokeIndex = 0;
  private step: Step = { kind: "stroke" };
  private readonly strokeEnds: number[];

  constructor(
    private readonly diagram: Diagram,
    private readonly random: () => number = Math.random,
  ) {
    let total = 0;
    this.strokeEnds = diagram.map((stroke) => {
      total += strokeInk(stroke);
      return total;
    });
  }

  get finished(): boolean {
    return this.ink >= diagramInk(this.diagram);
  }

  advance(deltaSeconds: number): PenState {
    const step = this.step;
    switch (step.kind) {
      case "hold": {
        step.seconds -= deltaSeconds;
        if (step.seconds <= 0) {
          this.startTravel(step.at);
        }
        return { at: step.at, touching: false, reviewing: step.reviewing };
      }
      case "travel": {
        step.elapsed += deltaSeconds;
        const t = smoothstep(step.elapsed / step.seconds);
        const at: Vec2 = [
          step.from[0] + (step.to[0] - step.from[0]) * t,
          step.from[1] + (step.to[1] - step.from[1]) * t,
        ];
        if (step.elapsed >= step.seconds) {
          this.strokeIndex += 1;
          this.step = { kind: "stroke" };
        }
        return { at, touching: false, reviewing: false };
      }
      case "stroke":
        return this.drawStroke(deltaSeconds);
    }
  }

  private drawStroke(deltaSeconds: number): PenState {
    const stroke = this.diagram[this.strokeIndex];
    const end = this.strokeEnds[this.strokeIndex];
    if (stroke === undefined || end === undefined) {
      return { at: [0.5, 0.5], touching: false, reviewing: false };
    }
    const start = end - strokeInk(stroke);
    this.ink = Math.min(end, this.ink + deltaSeconds * inkPerSecond);
    const length = end - start;
    const at = tipOf(stroke, length === 0 ? 1 : (this.ink - start) / length);
    const isLast = this.strokeIndex === this.diagram.length - 1;
    if (this.ink >= end && !isLast) {
      const roll = this.random();
      if (roll < reviewChance) {
        this.step = { kind: "hold", at, seconds: 1.6 + this.random(), reviewing: true };
      } else if (roll < reviewChance + pauseChance) {
        this.step = { kind: "hold", at, seconds: 0.4 + this.random() * 0.8, reviewing: false };
      } else {
        this.startTravel(at);
      }
    }
    return { at, touching: true, reviewing: false };
  }

  private startTravel(from: Vec2): void {
    const next = this.diagram[this.strokeIndex + 1];
    if (next === undefined) {
      this.step = { kind: "stroke" };
      return;
    }
    const to = tipOf(next, 0);
    const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
    this.step = { kind: "travel", from, to, seconds: travelBaseSeconds + distance * travelSecondsPerUnit, elapsed: 0 };
  }
}
