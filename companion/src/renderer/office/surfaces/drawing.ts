/** Board coordinates are normalized: x 0..1 left to right, y 0..1 top to bottom, within one region. */
export type Vec2 = readonly [number, number];

export type Stroke = { kind: "line"; points: readonly Vec2[] } | { kind: "text"; at: Vec2; text: string; size: number };

export type Diagram = readonly Stroke[];

/** Ink length of one text character, so writing takes about as long as a short line. */
export const charInk = 0.025;
/** How far one handwritten character advances the pen across a region, at size 1. */
export const charAdvance = 0.0143;

export function rect(x: number, y: number, w: number, h: number): Stroke {
  return {
    kind: "line",
    points: [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
      [x, y],
    ],
  };
}

export function line(from: Vec2, to: Vec2): Stroke {
  return { kind: "line", points: [from, to] };
}

/** Shaft plus a two-stroke head, drawn as one continuous path. */
export function arrow(from: Vec2, to: Vec2): Stroke {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const head = 0.03;
  const left: Vec2 = [to[0] - head * Math.cos(angle - 0.5), to[1] - head * Math.sin(angle - 0.5)];
  const right: Vec2 = [to[0] - head * Math.cos(angle + 0.5), to[1] - head * Math.sin(angle + 0.5)];
  return { kind: "line", points: [from, to, left, to, right] };
}

export function text(at: Vec2, value: string, size = 1): Stroke {
  return { kind: "text", at, text: value, size };
}

function segmentLength(a: Vec2, b: Vec2): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function strokeInk(stroke: Stroke): number {
  if (stroke.kind === "text") {
    return stroke.text.length * charInk;
  }
  let total = 0;
  for (let index = 1; index < stroke.points.length; index++) {
    total += segmentLength(stroke.points[index - 1] as Vec2, stroke.points[index] as Vec2);
  }
  return total;
}

export function diagramInk(diagram: Diagram): number {
  return diagram.reduce((sum, stroke) => sum + strokeInk(stroke), 0);
}

export interface PartialStroke {
  stroke: Stroke;
  /** 0..1 of this stroke's ink already on the board. */
  fraction: number;
}

/** Which strokes are (partly) drawn after `ink` units, and where the pen tip is. */
export function inkProgress(diagram: Diagram, ink: number): { strokes: PartialStroke[]; pen: Vec2 | null } {
  const strokes: PartialStroke[] = [];
  let remaining = ink;
  let pen: Vec2 | null = null;
  for (const stroke of diagram) {
    if (remaining <= 0) {
      break;
    }
    const length = strokeInk(stroke);
    const fraction = length === 0 ? 1 : Math.min(1, remaining / length);
    strokes.push({ stroke, fraction });
    pen = penPosition(stroke, fraction);
    remaining -= length;
  }
  return { strokes, pen };
}

export function penPosition(stroke: Stroke, fraction: number): Vec2 {
  if (stroke.kind === "text") {
    const characters = Math.floor(stroke.text.length * fraction);
    return [stroke.at[0] + characters * charAdvance * stroke.size, stroke.at[1]];
  }
  let target = strokeInk(stroke) * fraction;
  for (let index = 1; index < stroke.points.length; index++) {
    const a = stroke.points[index - 1] as Vec2;
    const b = stroke.points[index] as Vec2;
    const length = segmentLength(a, b);
    if (target <= length) {
      const t = length === 0 ? 0 : target / length;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    target -= length;
  }
  return stroke.points[stroke.points.length - 1] as Vec2;
}
