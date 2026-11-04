import { CanvasTexture, SRGBColorSpace } from "three";
import type { Vec2 } from "./drawing.js";
import { drawMading, type MadingPhoto } from "./mading.js";
import { writingBand } from "./whiteboard.js";

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

/**
 * Same aspect as the board on the wall, 1.3 by 0.85 m, at twice the detail so the mading reads.
 * The left is the team's wall magazine; the brainstorm's notes go up on the right, two across and
 * three down, kept in reach.
 */
const canvasWidth = 1600;
const canvasHeight = 1040;
const columns = 2;
const rowsCount = 3;
/** Where the notes' panel starts and ends across the board, as a share of its width. */
const panelFrom = 0.64;
const panelTo = 0.985;
const noteColors = ["#f7e27a", "#f5a8c2", "#9fe0c0", "#a9cdf5"];
const placeSeconds = 1.1;
const holdSeconds = 3;

/** Corkboard: the team's mading, and sticky notes appearing one by one while Chizuru brainstorms. */
export class IdeaBoard {
  readonly canvas: HTMLCanvasElement;
  readonly texture: CanvasTexture;
  private readonly context: CanvasRenderingContext2D;
  private placed = 0;
  private timer = 0;
  private batch = 0;
  private holding = 0;
  /** The cork and the mading, drawn once and again when the members' photos arrive. */
  private readonly background: HTMLCanvasElement;

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
    this.texture.anisotropy = 4;
    this.background = document.createElement("canvas");
    this.background.width = canvasWidth;
    this.background.height = canvasHeight;
    this.setPhotos([]);
  }

  /** The members' faces for the mading's polaroids; redraws the board with them. */
  setPhotos(faces: readonly MadingPhoto[]): void {
    const ctx = this.background.getContext("2d");
    if (ctx === null) {
      console.error("[office] no 2D canvas for the mading");
      return;
    }
    ctx.fillStyle = "#b98a5a";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    // Cork grain: a scatter of darker flecks, the same every time.
    let seed = 11;
    ctx.fillStyle = "rgba(90, 55, 25, 0.18)";
    for (let fleck = 0; fleck < 1400; fleck++) {
      seed = (seed * 9301 + 49297) % 233280;
      const x = (seed / 233280) * canvasWidth;
      seed = (seed * 9301 + 49297) % 233280;
      const y = (seed / 233280) * canvasHeight;
      ctx.fillRect(x, y, 3, 2);
    }
    drawMading(ctx, faces);
    // The notes' panel on the right: a sheet of dark card with its heading.
    const left = panelFrom * canvasWidth - 20;
    ctx.fillStyle = "#2a1a4a";
    ctx.fillRect(left, 24, canvasWidth - left - 16, canvasHeight - 48);
    ctx.fillStyle = "#f4f1ec";
    ctx.font = "800 40px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("IDE MINGGU INI", (left + canvasWidth - 16) / 2, 74);
    ctx.textAlign = "left";
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
    const v = (row + 0.5) / rowsCount;
    const u = panelFrom + ((column + 0.5) / columns) * (panelTo - panelFrom);
    return [u, writingBand.top + v * (writingBand.bottom - writingBand.top)];
  }

  private draw(nextNoteOpacity: number): void {
    const ctx = this.context;
    ctx.drawImage(this.background, 0, 0);
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
    const noteWidth = 230;
    const noteHeight = 200;
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
    ctx.font = "30px 'Segoe Print', 'Comic Sans MS', cursive";
    ctx.textBaseline = "top";
    const idea = ideaPool[(index + this.batch * 5) % ideaPool.length] as string;
    wrap(idea, noteWidth - 20).forEach((lineText, lineIndex) => {
      ctx.fillText(lineText, -noteWidth / 2 + 14, -noteHeight / 2 + 16 + lineIndex * 38);
    });
    ctx.restore();
  }
}

function wrap(textValue: string, maxWidthPx: number): string[] {
  // Rough wrap by character count: the handwriting font is close to monospace at this size.
  const maxChars = Math.floor(maxWidthPx / 16);
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
