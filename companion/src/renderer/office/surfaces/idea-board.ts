import { CanvasTexture, SRGBColorSpace } from "three";
import type { Vec2 } from "./drawing.js";
import { drawMading, type MadingPhoto } from "./mading.js";

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
  "partisi tabel per tanggal",
  "test dbt di tiap PR",
  "rotasi secret otomatis",
  "on-call yang lebih adil",
  "dark mode buat dashboard",
  "backfill pakai Airflow",
  "monitor lag consumer",
  "template PR yang singkat",
  "demo jumat sore",
  "hapus job yang nggak kepake",
];

/** Weeks start on Monday in Jakarta (UTC+7); the board changes as the week turns there. */
const jakartaOffsetMs = 7 * 3_600_000;
const weekMs = 7 * 86_400_000;
/** 1 January 1970 was a Thursday; the first Monday is four days on. */
const firstMondayMs = 4 * 86_400_000;

/** Which office week `nowMs` falls in, counted from the first Monday of 1970. */
export function officeWeek(nowMs: number): number {
  return Math.floor((nowMs + jakartaOffsetMs - firstMondayMs) / weekMs);
}

/** A small seeded generator, so a week always draws the same ideas. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * The week's ideas: four to six chalked up on the board, and a few more held back for Chizuru to
 * add while she brainstorms. Different every week, the same all week long.
 */
export function weeklyIdeas(week: number, pool: readonly string[] = ideaPool): { board: string[]; extra: string[] } {
  const random = seeded(week * 2_654_435_761);
  const shuffled = [...pool];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other] as string, shuffled[index] as string];
  }
  const count = 4 + Math.floor(random() * 3);
  return { board: shuffled.slice(0, count), extra: shuffled.slice(count, count + 3) };
}

/**
 * Same aspect as the board on the wall, 1.3 by 0.85 m, at twice the detail so the mading reads.
 * The left is the team's wall magazine; on the right a small chalkboard holds the week's ideas,
 * and Chizuru chalks up more while she brainstorms.
 */
const canvasWidth = 1600;
const canvasHeight = 1040;
/** Where the chalkboard starts across the board, as a share of its width. */
const panelFrom = 0.64;
const slate = {
  left: Math.round(panelFrom * canvasWidth - 20),
  top: 24,
  right: canvasWidth - 16,
  bottom: canvasHeight - 24,
};
const chalkFont = "'Segoe Print', 'Comic Sans MS', 'Chalkboard SE', cursive";
/** Chalk colors: mostly white, now and then a yellow or pink stick. */
const chalkColors = ["#f4f1e8", "#f4f1e8", "#f4f1e8", "#f6e27a", "#f5b3c8"];
const writeSeconds = 1.6;
const holdSeconds = 4;
const itemFont = 32;
const lineHeight = 40;
const itemGap = 18;
const textLeft = slate.left + 70;
const textWidth = slate.right - textLeft - 40;
const firstLine = slate.top + 170;

/** Corkboard: the team's mading, and the week's ideas chalked on the slate beside it. */
export class IdeaBoard {
  readonly canvas: HTMLCanvasElement;
  readonly texture: CanvasTexture;
  private readonly context: CanvasRenderingContext2D;
  /** The cork and the mading, drawn once and again when the members' photos arrive. */
  private readonly background: HTMLCanvasElement;
  /** The chalk on the slate, roughened before it goes onto the board. */
  private readonly chalk: HTMLCanvasElement;
  private week: number;
  private ideas: { board: string[]; extra: string[] };
  /** Ideas Chizuru has added this session, and how far into writing the next one she is. */
  private written = 0;
  private timer = 0;
  private holding = 0;

  constructor(private readonly now: () => number = Date.now) {
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
    this.chalk = document.createElement("canvas");
    this.chalk.width = slate.right - slate.left;
    this.chalk.height = slate.bottom - slate.top;
    this.week = officeWeek(now());
    this.ideas = weeklyIdeas(this.week);
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
    drawSlate(ctx);
    this.draw(0);
  }

  /** Returns the board UV the hand should reach for while an idea is being chalked up, else null. */
  update(deltaSeconds: number, working: boolean): Vec2 | null {
    const week = officeWeek(this.now());
    if (week !== this.week) {
      // A new week: the slate is wiped and the new week's ideas go up.
      this.week = week;
      this.ideas = weeklyIdeas(week);
      this.written = 0;
      this.timer = 0;
      this.draw(0);
    }
    if (!working) {
      return null;
    }
    if (this.written >= this.ideas.extra.length) {
      this.holding += deltaSeconds;
      if (this.holding >= holdSeconds) {
        // Wiped back to the week's list, ready for the next round of ideas.
        this.written = 0;
        this.holding = 0;
        this.draw(0);
      }
      return null;
    }
    this.timer += deltaSeconds;
    const progress = Math.min(1, this.timer / writeSeconds);
    const line = this.layout()[this.ideas.board.length + this.written];
    if (this.timer >= writeSeconds) {
      this.written += 1;
      this.timer = 0;
    }
    this.draw(progress);
    if (line === undefined) {
      return null;
    }
    // The hand follows the chalk across the line being written.
    const x = textLeft + Math.min(line.width, textWidth) * progress;
    return [x / canvasWidth, (line.y + lineHeight / 2) / canvasHeight];
  }

  /** Where each idea's text sits on the board: its lines, top and widest line. */
  private layout(): { lines: string[]; y: number; width: number }[] {
    const ctx = this.context;
    ctx.font = `${itemFont}px ${chalkFont}`;
    let y = firstLine;
    return [...this.ideas.board, ...this.ideas.extra].map((idea) => {
      const lines = wrapToWidth(ctx, idea, textWidth);
      const width = Math.max(...lines.map((text) => ctx.measureText(text).width));
      const placed = { lines, y, width };
      y += lines.length * lineHeight + itemGap;
      return placed;
    });
  }

  private draw(progress: number): void {
    const ctx = this.context;
    ctx.drawImage(this.background, 0, 0);
    const layer = this.chalk.getContext("2d");
    if (layer === null) {
      console.error("[office] no 2D canvas for the chalk");
      this.texture.needsUpdate = true;
      return;
    }
    layer.clearRect(0, 0, this.chalk.width, this.chalk.height);
    layer.save();
    layer.translate(-slate.left, -slate.top);
    // The heading, underlined with a wobbly stroke.
    layer.fillStyle = "#f4f1e8";
    layer.strokeStyle = "#f4f1e8";
    layer.font = `52px ${chalkFont}`;
    layer.textAlign = "center";
    layer.textBaseline = "middle";
    const middle = (slate.left + slate.right) / 2;
    layer.save();
    layer.translate(middle, slate.top + 78);
    layer.rotate(-0.025);
    layer.fillText("Ide minggu ini", 0, 0);
    layer.restore();
    layer.lineWidth = 4;
    layer.lineCap = "round";
    layer.beginPath();
    layer.moveTo(middle - 190, slate.top + 122);
    layer.quadraticCurveTo(middle, slate.top + 112, middle + 190, slate.top + 120);
    layer.stroke();
    // The ideas, each with a chalk dot and the odd tilt of a hand that is not ruling lines.
    layer.textAlign = "left";
    layer.textBaseline = "top";
    layer.font = `${itemFont}px ${chalkFont}`;
    const shown = this.ideas.board.length + this.written + (progress > 0 ? 1 : 0);
    this.layout()
      .slice(0, shown)
      .forEach((item, index) => {
        if (item.y + item.lines.length * lineHeight > slate.bottom - 70) {
          return;
        }
        const color = chalkColors[(index * 3 + this.week) % chalkColors.length] as string;
        layer.fillStyle = color;
        layer.strokeStyle = color;
        const writing = index === this.ideas.board.length + this.written && progress > 0;
        layer.save();
        if (writing) {
          // Only as much of the line as the chalk has reached so far.
          layer.beginPath();
          layer.rect(
            slate.left,
            item.y - 10,
            textLeft - slate.left + item.width * progress,
            item.lines.length * lineHeight + 20,
          );
          layer.clip();
        }
        layer.beginPath();
        layer.arc(textLeft - 26, item.y + lineHeight / 2 - 2, 6, 0, Math.PI * 2);
        layer.fill();
        item.lines.forEach((text, lineIndex) => {
          layer.save();
          layer.translate(textLeft, item.y + lineIndex * lineHeight);
          layer.rotate((((index * 7 + lineIndex) % 5) - 2) * 0.006);
          layer.fillText(text, 0, 0);
          layer.restore();
        });
        layer.restore();
      });
    layer.restore();
    roughen(layer, this.chalk.width, this.chalk.height);
    ctx.save();
    // A faint halo of dust around every stroke, the way chalk spreads on a slate.
    ctx.shadowColor = "rgba(244, 241, 232, 0.35)";
    ctx.shadowBlur = 3;
    ctx.globalAlpha = 0.92;
    ctx.drawImage(this.chalk, slate.left, slate.top);
    ctx.restore();
    this.texture.needsUpdate = true;
  }
}

/** The slate: dark green-grey with smudges of old chalk, a wooden frame and a tray with sticks. */
function drawSlate(ctx: CanvasRenderingContext2D): void {
  const { left, top, right, bottom } = slate;
  ctx.fillStyle = "#7a5233";
  ctx.fillRect(left - 6, top - 6, right - left + 12, bottom - top + 12);
  ctx.fillStyle = "#26302b";
  ctx.fillRect(left + 10, top + 10, right - left - 20, bottom - top - 20);
  // Wiped-off chalk leaves a haze; a few soft patches, the same every time.
  const smudges: readonly [number, number, number][] = [
    [0.3, 0.35, 160],
    [0.7, 0.6, 200],
    [0.45, 0.82, 140],
    [0.8, 0.2, 120],
  ];
  for (const [u, v, radius] of smudges) {
    const x = left + (right - left) * u;
    const y = top + (bottom - top) * v;
    const haze = ctx.createRadialGradient(x, y, 0, x, y, radius);
    haze.addColorStop(0, "rgba(220, 225, 215, 0.07)");
    haze.addColorStop(1, "rgba(220, 225, 215, 0)");
    ctx.fillStyle = haze;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  // The tray along the bottom with two sticks of chalk and an eraser.
  ctx.fillStyle = "#6a4529";
  ctx.fillRect(left + 10, bottom - 34, right - left - 20, 22);
  ctx.fillStyle = "#f4f1e8";
  ctx.fillRect(left + 60, bottom - 46, 60, 12);
  ctx.fillStyle = "#f5b3c8";
  ctx.fillRect(left + 140, bottom - 44, 46, 10);
  ctx.fillStyle = "#3b3346";
  ctx.fillRect(right - 170, bottom - 56, 110, 24);
  ctx.fillStyle = "#c9c3b5";
  ctx.fillRect(right - 170, bottom - 38, 110, 6);
}

/** Knocks tiny holes in the chalk so strokes look dry and grainy instead of printed. */
function roughen(layer: CanvasRenderingContext2D, width: number, height: number): void {
  layer.save();
  layer.globalCompositeOperation = "destination-out";
  layer.fillStyle = "rgba(0, 0, 0, 0.55)";
  let seed = 23;
  for (let speck = 0; speck < 9000; speck++) {
    seed = (seed * 9301 + 49297) % 233280;
    const x = (seed / 233280) * width;
    seed = (seed * 9301 + 49297) % 233280;
    const y = (seed / 233280) * height;
    layer.fillRect(x, y, 2, 1.5);
  }
  layer.restore();
}

/** Words onto lines no wider than `width` in the context's current font. */
function wrapToWidth(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(" ")) {
    const next = current === "" ? word : `${current} ${word}`;
    if (ctx.measureText(next).width > width && current !== "") {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  lines.push(current);
  return lines;
}
