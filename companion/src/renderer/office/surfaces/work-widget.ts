import type { MemberId } from "../../../shared/team.js";

/**
 * A small live panel in the corner of a member's main screen while they work, showing the kind
 * of work their role does as it moves along: bars rising for data, tests ticking over for
 * developers, a deploy walking its stages, a checklist filling in, shapes landing on a design
 * canvas, a security sweep, task cards crossing a board. Shapes only: no figures are invented.
 */

export type WorkWidget = "chart" | "tests" | "deploy" | "checklist" | "canvas" | "scan" | "tasks";

const widgets: Partial<Record<MemberId, WorkWidget>> = {
  asuna: "chart",
  kobayashi: "tests",
  komachi: "tests",
  yor: "deploy",
  erza: "checklist",
  huagua: "canvas",
  miruku: "scan",
};

/** The widget that fits a member's role; the others move cards across a board. */
export function widgetFor(memberId: MemberId): WorkWidget {
  return widgets[memberId] ?? "tasks";
}

/** Seconds for one run of a widget, from empty to done, before it starts over. */
export const widgetCycleSeconds = 7;
/** Steps per cycle: the screen is only redrawn when the step changes. */
export const widgetSteps = 28;

/** The step a widget is on after `seconds` of work, wrapping each cycle. */
export function widgetStep(seconds: number): number {
  const cycle = (((seconds / widgetCycleSeconds) % 1) + 1) % 1;
  return Math.min(widgetSteps - 1, Math.floor(cycle * widgetSteps));
}

export interface WidgetTheme {
  background: string;
  foreground: string;
  accent: string;
  muted: string;
  header: string;
}

export interface WidgetBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const done = "#5fd18a";

/** Draws `widget` at `progress` (0..1 through its run) into `box`. */
export function drawWorkWidget(
  ctx: CanvasRenderingContext2D,
  widget: WorkWidget,
  progress: number,
  theme: WidgetTheme,
  box: WidgetBox,
): void {
  const { x, y, width, height } = box;
  ctx.save();
  ctx.fillStyle = theme.header;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
  const pad = Math.round(Math.min(width, height) * 0.1);
  const inner = { x: x + pad, y: y + pad, width: width - pad * 2, height: height - pad * 2 };
  switch (widget) {
    case "chart":
      drawChart(ctx, progress, theme, inner);
      break;
    case "tests":
      drawTests(ctx, progress, theme, inner);
      break;
    case "deploy":
      drawDeploy(ctx, progress, theme, inner);
      break;
    case "checklist":
      drawChecklist(ctx, progress, theme, inner);
      break;
    case "canvas":
      drawCanvas(ctx, progress, theme, inner);
      break;
    case "scan":
      drawScan(ctx, progress, theme, inner);
      break;
    case "tasks":
      drawTasks(ctx, progress, theme, inner);
      break;
  }
  ctx.restore();
}

/** Bars rising one after another to fixed heights, a trend line over the ones already in. */
function drawChart(ctx: CanvasRenderingContext2D, progress: number, theme: WidgetTheme, box: WidgetBox): void {
  const heights = [0.35, 0.5, 0.42, 0.62, 0.58, 0.78, 0.9];
  const slot = box.width / heights.length;
  const shown = progress * heights.length;
  const tops: [number, number][] = [];
  heights.forEach((height, index) => {
    const grow = Math.max(0, Math.min(1, shown - index));
    const barHeight = box.height * height * grow;
    const left = box.x + index * slot + slot * 0.18;
    ctx.fillStyle = index === Math.floor(shown) ? theme.accent : theme.muted;
    ctx.fillRect(left, box.y + box.height - barHeight, slot * 0.64, barHeight);
    if (grow >= 1) {
      tops.push([left + slot * 0.32, box.y + box.height - barHeight]);
    }
  });
  ctx.strokeStyle = theme.foreground;
  ctx.lineWidth = 2;
  ctx.beginPath();
  tops.forEach(([px, py], index) => {
    if (index === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  });
  ctx.stroke();
}

/** Rows of test dots turning green as the run reaches them, a bar along the bottom. */
function drawTests(ctx: CanvasRenderingContext2D, progress: number, theme: WidgetTheme, box: WidgetBox): void {
  const columns = 8;
  const rows = 4;
  const total = columns * rows;
  const passed = Math.floor(progress * total);
  const cell = Math.min(box.width / columns, (box.height * 0.75) / rows);
  for (let index = 0; index < total; index++) {
    const cx = box.x + (index % columns) * cell + cell / 2;
    const cy = box.y + Math.floor(index / columns) * cell + cell / 2;
    ctx.fillStyle = index < passed ? done : index === passed ? theme.accent : theme.muted;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  const barY = box.y + box.height - cell * 0.4;
  ctx.fillStyle = theme.muted;
  ctx.fillRect(box.x, barY, box.width, cell * 0.25);
  ctx.fillStyle = done;
  ctx.fillRect(box.x, barY, box.width * progress, cell * 0.25);
}

/** Four stages joined by arrows; each lights up in turn, the running one pulsing. */
function drawDeploy(ctx: CanvasRenderingContext2D, progress: number, theme: WidgetTheme, box: WidgetBox): void {
  const stages = 4;
  const gapWidth = box.width * 0.08;
  const stageWidth = (box.width - gapWidth * (stages - 1)) / stages;
  const stageHeight = box.height * 0.42;
  const top = box.y + (box.height - stageHeight) / 2;
  const at = progress * stages;
  for (let index = 0; index < stages; index++) {
    const left = box.x + index * (stageWidth + gapWidth);
    const state = index < Math.floor(at) ? "done" : index === Math.floor(at) ? "running" : "waiting";
    ctx.fillStyle = state === "done" ? done : state === "running" ? theme.accent : theme.muted;
    ctx.globalAlpha = state === "running" ? 0.55 + 0.45 * Math.sin(at * Math.PI * 6) ** 2 : 1;
    ctx.fillRect(left, top, stageWidth, stageHeight);
    ctx.globalAlpha = 1;
    if (index < stages - 1) {
      ctx.strokeStyle = theme.foreground;
      ctx.lineWidth = 2;
      const ax = left + stageWidth + 3;
      const ay = top + stageHeight / 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + gapWidth - 6, ay);
      ctx.stroke();
    }
  }
}

/** Five lines with boxes that get ticked one after another. */
function drawChecklist(ctx: CanvasRenderingContext2D, progress: number, theme: WidgetTheme, box: WidgetBox): void {
  const lines = 5;
  const rowHeight = box.height / lines;
  const ticked = Math.floor(progress * (lines + 1));
  const lengths = [0.8, 0.6, 0.72, 0.5, 0.66];
  for (let index = 0; index < lines; index++) {
    const cy = box.y + rowHeight * index + rowHeight / 2;
    const side = rowHeight * 0.55;
    ctx.strokeStyle = theme.foreground;
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, cy - side / 2, side, side);
    if (index < ticked) {
      ctx.strokeStyle = done;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(box.x + side * 0.2, cy);
      ctx.lineTo(box.x + side * 0.45, cy + side * 0.25);
      ctx.lineTo(box.x + side * 0.85, cy - side * 0.3);
      ctx.stroke();
    }
    ctx.fillStyle = index < ticked ? theme.muted : theme.foreground;
    ctx.fillRect(box.x + side * 1.5, cy - 2, (box.width - side * 1.5) * (lengths[index] ?? 0.6), 4);
  }
}

/** An artboard where a circle, a block and a triangle land in turn, with a pointer moving between them. */
function drawCanvas(ctx: CanvasRenderingContext2D, progress: number, theme: WidgetTheme, box: WidgetBox): void {
  ctx.fillStyle = "#f4f1ec";
  ctx.fillRect(box.x, box.y, box.width, box.height);
  const shapes = 3;
  const at = progress * (shapes + 1);
  const unit = Math.min(box.width / 4, box.height / 2.2);
  const spots: [number, number][] = [
    [box.x + box.width * 0.22, box.y + box.height * 0.4],
    [box.x + box.width * 0.55, box.y + box.height * 0.62],
    [box.x + box.width * 0.8, box.y + box.height * 0.35],
  ];
  const colors = [theme.accent, "#ff8fc8", "#5ce0ff"];
  spots.forEach(([cx, cy], index) => {
    const grow = Math.max(0, Math.min(1, at - index));
    if (grow === 0) {
      return;
    }
    const r = unit * 0.45 * grow;
    ctx.fillStyle = colors[index] ?? theme.accent;
    ctx.beginPath();
    if (index === 0) {
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    } else if (index === 1) {
      ctx.rect(cx - r, cy - r * 0.7, r * 2, r * 1.4);
    } else {
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy + r * 0.8);
      ctx.lineTo(cx - r, cy + r * 0.8);
      ctx.closePath();
    }
    ctx.fill();
  });
  // The pointer heads for wherever the next shape goes.
  const target = spots[Math.min(shapes - 1, Math.floor(at))] ?? spots[0];
  if (target !== undefined) {
    const [px, py] = target;
    ctx.fillStyle = "#1b1f2a";
    ctx.beginPath();
    ctx.moveTo(px + 6, py + 6);
    ctx.lineTo(px + 6, py + 26);
    ctx.lineTo(px + 12, py + 20);
    ctx.lineTo(px + 22, py + 22);
    ctx.closePath();
    ctx.fill();
  }
}

/** A radar sweep turning, with marks lighting where it has passed. */
function drawScan(ctx: CanvasRenderingContext2D, progress: number, theme: WidgetTheme, box: WidgetBox): void {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const r = Math.min(box.width, box.height) / 2;
  ctx.strokeStyle = theme.muted;
  ctx.lineWidth = 2;
  for (const ring of [1, 0.66, 0.33]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * ring, 0, Math.PI * 2);
    ctx.stroke();
  }
  const sweep = progress * Math.PI * 4;
  ctx.strokeStyle = done;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweep) * r, cy + Math.sin(sweep) * r);
  ctx.stroke();
  const marks: [number, number][] = [
    [0.8, 0.6],
    [2.4, 0.4],
    [4.1, 0.8],
    [5.3, 0.3],
  ];
  for (const [angle, distance] of marks) {
    if (angle <= sweep % (Math.PI * 2) || progress >= 0.5) {
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * r * distance, cy + Math.sin(angle) * r * distance, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Three columns with cards; one card travels from the first column to the last. */
function drawTasks(ctx: CanvasRenderingContext2D, progress: number, theme: WidgetTheme, box: WidgetBox): void {
  const columns = 3;
  const gapWidth = box.width * 0.05;
  const columnWidth = (box.width - gapWidth * (columns - 1)) / columns;
  const cardHeight = box.height * 0.18;
  const resting = [2, 1, 2];
  for (let column = 0; column < columns; column++) {
    const left = box.x + column * (columnWidth + gapWidth);
    ctx.fillStyle = theme.background;
    ctx.fillRect(left, box.y, columnWidth, box.height);
    for (let card = 0; card < (resting[column] ?? 0); card++) {
      ctx.fillStyle = column === columns - 1 ? done : theme.muted;
      ctx.fillRect(left + 4, box.y + 6 + card * (cardHeight + 6), columnWidth - 8, cardHeight);
    }
  }
  // The moving card glides across, then settles in the last column.
  const travel = Math.min(1, progress * 1.25);
  const eased = travel * travel * (3 - 2 * travel);
  const fromX = box.x + 4;
  const toX = box.x + (columns - 1) * (columnWidth + gapWidth) + 4;
  ctx.fillStyle = theme.accent;
  ctx.fillRect(fromX + (toX - fromX) * eased, box.y + box.height - cardHeight - 8, columnWidth - 8, cardHeight);
}
