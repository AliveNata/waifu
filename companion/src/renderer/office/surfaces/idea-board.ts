import { CanvasTexture, SRGBColorSpace } from "three";
import type { Vec2 } from "./drawing.js";

/** Simulated ideas. They are examples of what a brainstorm looks like, not the user's real backlog. */
export const ideaPool: readonly string[] = [
  "cache hasil query mahal",
  "alert ke Telegram",
  "dashboard biaya GCP",
  "autoscale worker Kafka",
  "data contract per topic",
  "retry pakai backoff",
  "export CSV sekali klik",
  "replay event dari Kafka",
  "dry-run tiap deploy",
  "SLO buat pipeline",
  "tag biaya per tim",
  "staging dari snapshot prod",
  "runbook insiden",
  "lineage dbt di docs",
];

const canvasWidth = 800;
const canvasHeight = 480;
const columns = 4;
const rowsCount = 3;
const noteColors = ["#f7e27a", "#f5a8c2", "#9fe0c0", "#a9cdf5"];
const placeSeconds = 1.1;
const holdSeconds = 3;

/** Corkboard where sticky notes appear one by one while Chizuru brainstorms. */
export class IdeaBoard {
  readonly canvas: HTMLCanvasElement;
  readonly texture: CanvasTexture;
  private readonly context: CanvasRenderingContext2D;
  private placed = 0;
  private timer = 0;
  private batch = 0;
  private holding = 0;

  constructor() {
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
    this.draw(0);
  }

  /** Returns the board UV the hand should reach for while a note is being placed, else null. */
  update(deltaSeconds: number, working: boolean): Vec2 | null {
    if (!working) {
      return null;
    }
    const capacity = columns * rowsCount;
    if (this.placed >= capacity) {
      this.holding += deltaSeconds;
      if (this.holding >= holdSeconds) {
        this.placed = 0;
        this.holding = 0;
        this.batch += 1;
        this.draw(0);
      }
      return null;
    }
    this.timer += deltaSeconds;
    const appear = Math.min(1, this.timer / placeSeconds);
    if (this.timer >= placeSeconds) {
      this.placed += 1;
      this.timer = 0;
    }
    this.draw(appear);
    return this.noteCenter(this.placed);
  }

  private noteCenter(index: number): Vec2 {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return [(column + 0.5) / columns, (row + 0.5) / rowsCount];
  }

  private draw(nextNoteOpacity: number): void {
    const ctx = this.context;
    ctx.fillStyle = "#b98a5a";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    const total = Math.min(columns * rowsCount, this.placed + (nextNoteOpacity > 0 ? 1 : 0));
    for (let index = 0; index < total; index++) {
      const opacity = index < this.placed ? 1 : nextNoteOpacity;
      this.drawNote(index, opacity);
    }
    this.texture.needsUpdate = true;
  }

  private drawNote(index: number, opacity: number): void {
    const ctx = this.context;
    const [u, v] = this.noteCenter(index);
    const noteWidth = 170;
    const noteHeight = 120;
    const x = u * canvasWidth - noteWidth / 2;
    const y = v * canvasHeight - noteHeight / 2;
    // Stable tilt per slot so the wall looks hand-placed.
    const tilt = (((index * 37) % 9) - 4) * 0.012;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(x + noteWidth / 2, y + noteHeight / 2);
    ctx.rotate(tilt);
    ctx.fillStyle = noteColors[(index + this.batch) % noteColors.length] as string;
    ctx.fillRect(-noteWidth / 2, -noteHeight / 2, noteWidth, noteHeight);
    ctx.fillStyle = "#2b2b2b";
    ctx.font = "22px 'Segoe Print', 'Comic Sans MS', cursive";
    ctx.textBaseline = "top";
    const idea = ideaPool[(index + this.batch * 5) % ideaPool.length] as string;
    wrap(idea, noteWidth - 20).forEach((lineText, lineIndex) => {
      ctx.fillText(lineText, -noteWidth / 2 + 10, -noteHeight / 2 + 12 + lineIndex * 28);
    });
    ctx.restore();
  }
}

function wrap(textValue: string, maxWidthPx: number): string[] {
  // Rough wrap by character count: the handwriting font is close to monospace at this size.
  const maxChars = Math.floor(maxWidthPx / 12);
  const lines: string[] = [];
  let current = "";
  for (const word of textValue.split(" ")) {
    if ((current + word).length > maxChars && current !== "") {
      lines.push(current.trim());
      current = "";
    }
    current += `${word} `;
  }
  lines.push(current.trim());
  return lines;
}
