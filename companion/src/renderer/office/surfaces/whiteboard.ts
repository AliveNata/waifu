import { CanvasTexture, SRGBColorSpace } from "three";
import { arrow, type Diagram, diagramInk, inkProgress, rect, strokeInk, text, type Vec2 } from "./drawing.js";

/** Simulated sketches. Rias compares architecture options, 2B plans the sprint. */
export const riasDiagrams: readonly Diagram[] = [
  [
    text([0.05, 0.12], "Opsi A: batch", 1.1),
    rect(0.05, 0.22, 0.2, 0.14),
    text([0.08, 0.3], "Kafka", 0.8),
    arrow([0.26, 0.29], [0.36, 0.29]),
    rect(0.37, 0.22, 0.2, 0.14),
    text([0.41, 0.3], "GCS", 0.8),
    arrow([0.58, 0.29], [0.68, 0.29]),
    rect(0.69, 0.22, 0.26, 0.14),
    text([0.71, 0.3], "BigQuery", 0.8),
    text([0.05, 0.5], "Opsi B: streaming", 1.1),
    rect(0.05, 0.6, 0.2, 0.14),
    text([0.08, 0.68], "Kafka", 0.8),
    arrow([0.26, 0.67], [0.36, 0.67]),
    rect(0.37, 0.6, 0.2, 0.14),
    text([0.4, 0.68], "Spark", 0.8),
    arrow([0.58, 0.67], [0.68, 0.67]),
    rect(0.69, 0.6, 0.26, 0.14),
    text([0.71, 0.68], "BigQuery", 0.8),
    text([0.05, 0.9], "tradeoff: biaya vs latency", 0.9),
  ],
  [
    text([0.05, 0.12], "Risiko", 1.2),
    text([0.08, 0.3], "- skema berubah", 0.9),
    text([0.08, 0.45], "- biaya scan", 0.9),
    text([0.08, 0.6], "- beban on-call", 0.9),
    arrow([0.5, 0.45], [0.66, 0.45]),
    rect(0.67, 0.36, 0.3, 0.18),
    text([0.69, 0.46], "data contract", 0.8),
  ],
];

export const twobDiagrams: readonly Diagram[] = [
  [
    text([0.06, 0.12], "Sprint", 1.2),
    rect(0.06, 0.25, 0.05, 0.08),
    text([0.14, 0.31], "spec", 0.9),
    rect(0.06, 0.42, 0.05, 0.08),
    text([0.14, 0.48], "delegasi", 0.9),
    rect(0.06, 0.59, 0.05, 0.08),
    text([0.14, 0.65], "review", 0.9),
    arrow([0.45, 0.48], [0.62, 0.48]),
    rect(0.63, 0.38, 0.28, 0.2),
    text([0.66, 0.5], "deploy", 0.9),
  ],
  [
    text([0.06, 0.12], "Minggu ini", 1.2),
    arrow([0.06, 0.55], [0.94, 0.55]),
    rect(0.14, 0.5, 0.01, 0.1),
    text([0.1, 0.72], "Sen", 0.9),
    rect(0.48, 0.5, 0.01, 0.1),
    text([0.44, 0.72], "Rab", 0.9),
    rect(0.82, 0.5, 0.01, 0.1),
    text([0.79, 0.72], "Jum", 0.9),
  ],
];

const canvasWidth = 1040;
const canvasHeight = 400;
const inkPerSecond = 0.45;
const holdSeconds = 3;
const eraseSeconds = 0.8;
const handwriting = "'Segoe Print', 'Comic Sans MS', cursive";

interface Region {
  /** Horizontal slice of the canvas, 0..1. */
  u0: number;
  u1: number;
  color: string;
  diagrams: readonly Diagram[];
  diagramIndex: number;
  ink: number;
  phase: "drawing" | "holding" | "erasing";
  timer: number;
  dirty: boolean;
}

/** One whiteboard split into regions, each drawn progressively by a different character. */
export class Whiteboard {
  readonly canvas: HTMLCanvasElement;
  readonly texture: CanvasTexture;
  private readonly context: CanvasRenderingContext2D;
  private readonly regions: Region[];

  constructor(regions: readonly { u0: number; u1: number; color: string; diagrams: readonly Diagram[] }[]) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;
    const context = this.canvas.getContext("2d");
    if (context === null) {
      throw new Error("2D canvas is not available");
    }
    this.context = context;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.regions = regions.map((region) => ({
      ...region,
      diagramIndex: 0,
      ink: 0,
      phase: "drawing",
      timer: 0,
      dirty: true,
    }));
    for (let index = 0; index < this.regions.length; index++) {
      this.drawRegion(index, null);
    }
  }

  /**
   * Advances the region a character is drawing in. Returns the pen tip in
   * board UV (0..1 over the whole board) while the pen is on the board, else null.
   */
  update(regionIndex: number, deltaSeconds: number, drawing: boolean): Vec2 | null {
    const region = this.regions[regionIndex];
    if (region === undefined || !drawing) {
      return null;
    }
    const diagram = region.diagrams[region.diagramIndex] as Diagram;
    let pen: Vec2 | null = null;

    switch (region.phase) {
      case "drawing": {
        region.ink += deltaSeconds * inkPerSecond;
        if (region.ink >= diagramInk(diagram)) {
          region.ink = diagramInk(diagram);
          region.phase = "holding";
          region.timer = holdSeconds;
        }
        pen = inkProgress(diagram, region.ink).pen;
        break;
      }
      case "holding":
        region.timer -= deltaSeconds;
        if (region.timer <= 0) {
          region.phase = "erasing";
          region.timer = eraseSeconds;
        }
        return null;
      case "erasing":
        region.timer -= deltaSeconds;
        if (region.timer <= 0) {
          region.diagramIndex = (region.diagramIndex + 1) % region.diagrams.length;
          region.ink = 0;
          region.phase = "drawing";
        }
        break;
    }

    const eraseFraction = region.phase === "erasing" ? 1 - region.timer / eraseSeconds : null;
    this.drawRegion(regionIndex, eraseFraction);
    if (pen === null) {
      return null;
    }
    return [region.u0 + pen[0] * (region.u1 - region.u0), pen[1]];
  }

  private drawRegion(regionIndex: number, eraseFraction: number | null): void {
    const region = this.regions[regionIndex] as Region;
    const ctx = this.context;
    const x0 = region.u0 * canvasWidth;
    const regionWidth = (region.u1 - region.u0) * canvasWidth;
    const toCanvas = (point: Vec2): [number, number] => [x0 + point[0] * regionWidth, point[1] * canvasHeight];

    ctx.fillStyle = "#f6f5ef";
    ctx.fillRect(x0, 0, regionWidth, canvasHeight);
    const diagram = region.diagrams[region.diagramIndex] as Diagram;
    const { strokes } = inkProgress(diagram, region.ink);
    ctx.strokeStyle = region.color;
    ctx.fillStyle = region.color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const { stroke, fraction } of strokes) {
      if (stroke.kind === "text") {
        ctx.font = `${Math.round(30 * stroke.size)}px ${handwriting}`;
        ctx.textBaseline = "middle";
        const [x, y] = toCanvas(stroke.at);
        ctx.fillText(stroke.text.slice(0, Math.floor(stroke.text.length * fraction)), x, y);
        continue;
      }
      // Draw the polyline up to the fraction of its length.
      let remaining = fraction * strokeInk(stroke);
      ctx.beginPath();
      const [startX, startY] = toCanvas(stroke.points[0] as Vec2);
      ctx.moveTo(startX, startY);
      for (let index = 1; index < stroke.points.length && remaining > 0; index++) {
        const a = stroke.points[index - 1] as Vec2;
        const b = stroke.points[index] as Vec2;
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const t = length === 0 ? 1 : Math.min(1, remaining / length);
        const [x, y] = toCanvas([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        ctx.lineTo(x, y);
        remaining -= length;
      }
      ctx.stroke();
    }

    if (eraseFraction !== null) {
      ctx.fillStyle = "#f6f5ef";
      ctx.fillRect(x0, 0, regionWidth * eraseFraction, canvasHeight);
    }
    this.texture.needsUpdate = true;
  }
}
