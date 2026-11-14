import { CanvasTexture, Group, type Mesh, PlaneGeometry, SRGBColorSpace } from "three";
import { roster } from "../../../shared/team.js";
import { speakerColors } from "../../common/dialog-box.js";
import { type DayTally, type MemberTally, summarize, workLabel } from "../daily-recap.js";
import type { Furniture } from "../office-plan.js";
import {
  type BoardStatus,
  presenceLabels,
  rowDetail,
  type StatusRow,
  statusLabels,
  statusSummary,
} from "../status-board.js";
import { box, glow, mesh, palette, standard, unlit } from "./palette.js";

const faceWidth = 2048;
const faceHeight = 624;
const uiFont = "'Segoe UI', system-ui, sans-serif";
/** The same face color as the wall clock, so the two read as one set of office displays. */
const faceColor = "#120f1a";
const mutedText = "#a79fb8";

/**
 * Status colors: green for running, amber for "needs you", the brand violet for finished, and
 * the clock's grey for idle. Each is above 7:1 on the face, so it reads from across the room.
 */
const statusColors: Record<BoardStatus, string> = {
  working: "#8fe3a8",
  waiting: "#f2c46d",
  done: palette.accentSoft,
  idle: "#8f86a3",
};

const header = 120;
const rowsPerColumn = 6;
const rowHeight = (faceHeight - header - 10) / rowsPerColumn;

/**
 * The team status board on the back wall: who is working, waiting, finished or idle, with the
 * tool name and how long, from the same hook events that move the people. Redrawn only when what
 * it shows changes, which is at most once a second while someone is working.
 */
export class StatusBoard {
  readonly root: Group;
  /** The lit screen, for telling when the pointer is over the board. */
  readonly face: Mesh;
  private readonly texture: CanvasTexture;
  private readonly context: CanvasRenderingContext2D;
  private shown = "";

  constructor(piece: Furniture) {
    const element = document.createElement("canvas");
    element.width = faceWidth;
    element.height = faceHeight;
    const context = element.getContext("2d");
    if (context === null) {
      throw new Error("2D canvas is not available");
    }
    this.context = context;
    this.texture = new CanvasTexture(element);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.root = new Group();
    this.root.position.set(piece.x, 0, piece.z);
    this.root.rotation.y = piece.yaw;
    const height = piece.width * (faceHeight / faceWidth) + 0.04;
    // Above the arcades (about 1.32 m) and below the neon under the ceiling.
    const centerY = 1.72;
    this.root.add(
      box(piece.width, height, 0.03, standard(palette.inkDeep, 0.4), 0, centerY - height / 2, 0),
      box(piece.width - 0.04, 0.008, 0.032, glow(palette.accent, 1.4), 0, centerY - height / 2 + 0.01, 0),
    );
    this.face = mesh(new PlaneGeometry(piece.width - 0.04, height - 0.03), unlit(this.texture), false);
    this.face.position.set(0, centerY, 0.017);
    this.root.add(this.face);
  }

  /** The day's recap in place of the rows, redrawn only when the tally changes. */
  showRecap(tally: DayTally): void {
    const signature = `recap:${JSON.stringify(tally)}`;
    if (signature === this.shown) {
      return;
    }
    this.shown = signature;
    drawRecap(this.context, tally);
    this.texture.needsUpdate = true;
  }

  update(rows: readonly StatusRow[], now: number): void {
    const details = rows.map((row) => rowDetail(row, now));
    const signature = rows
      .map((row, index) => `${row.memberId}:${row.status}:${row.presence}:${details[index]}`)
      .join("|");
    if (signature === this.shown) {
      return;
    }
    this.shown = signature;
    this.draw(rows, details);
  }

  private draw(rows: readonly StatusRow[], details: readonly string[]): void {
    const ctx = this.context;
    ctx.fillStyle = faceColor;
    ctx.fillRect(0, 0, faceWidth, faceHeight);
    ctx.textBaseline = "middle";

    ctx.textAlign = "left";
    ctx.fillStyle = "#f4f1ec";
    ctx.font = `600 54px ${uiFont}`;
    ctx.fillText("Status tim", 44, header / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = mutedText;
    ctx.font = `500 34px ${uiFont}`;
    ctx.fillText(statusSummary(rows), faceWidth - 44, header / 2);
    ctx.fillStyle = "#2a2338";
    ctx.fillRect(44, header - 4, faceWidth - 88, 2);

    rows.forEach((row, index) => {
      const column = Math.floor(index / rowsPerColumn);
      const left = 44 + column * (faceWidth / 2);
      const right = left + faceWidth / 2 - 88;
      const middle = header + 6 + (index % rowsPerColumn) * rowHeight + rowHeight / 2;
      const color = statusColors[row.status];
      // Someone out of the room is dimmed, so the people who are here stand out at a glance.
      const away = row.presence !== "in";
      ctx.globalAlpha = away ? 0.45 : 1;

      ctx.beginPath();
      ctx.arc(left + 14, middle, 12, 0, Math.PI * 2);
      if (row.status === "idle") {
        // Hollow for idle, so the eye skips straight to the filled dots.
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.fill();
      }

      ctx.textAlign = "left";
      ctx.fillStyle = speakerColors[row.memberId];
      ctx.font = `600 40px ${uiFont}`;
      ctx.fillText(row.name, left + 44, middle - 14);
      ctx.fillStyle = mutedText;
      ctx.font = `400 26px ${uiFont}`;
      ctx.fillText(row.role, left + 44, middle + 22);

      ctx.textAlign = "right";
      ctx.fillStyle = color;
      ctx.font = `600 36px ${uiFont}`;
      const label = statusLabels[row.status];
      ctx.fillText(label, right, middle - 14);
      const labelWidth = ctx.measureText(label).width;
      // Where they are, beside the status: full strength even on a dimmed row, since it says why.
      ctx.globalAlpha = 1;
      ctx.fillStyle = away ? "#f4f1ec" : mutedText;
      ctx.font = `500 28px ${uiFont}`;
      ctx.fillText(presenceLabels[row.presence], right - labelWidth - 30, middle - 13);
      ctx.globalAlpha = away ? 0.45 : 1;
      const detail = details[index] ?? "";
      if (detail !== "") {
        ctx.fillStyle = mutedText;
        ctx.font = `400 26px ${uiFont}`;
        ctx.fillText(fitText(ctx, detail, 420), right, middle + 22);
      }
      ctx.globalAlpha = 1;
    });
    this.texture.needsUpdate = true;
  }
}

/** The recap view: the day's totals on the left, who finished what on the right. */
function drawRecap(ctx: CanvasRenderingContext2D, tally: DayTally): void {
  const summary = summarize(tally);
  ctx.fillStyle = faceColor;
  ctx.fillRect(0, 0, faceWidth, faceHeight);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = "#f4f1ec";
  ctx.font = `600 54px ${uiFont}`;
  ctx.fillText("Rekap hari ini", 44, header / 2);
  ctx.textAlign = "right";
  ctx.fillStyle = mutedText;
  ctx.font = `500 34px ${uiFont}`;
  ctx.fillText("jumlah dan nama tool saja", faceWidth - 44, header / 2);
  ctx.fillStyle = "#2a2338";
  ctx.fillRect(44, header - 4, faceWidth - 88, 2);

  const tools = summary.topTools.map(([tool, count]) => `${tool} ${count}x`).join(", ");
  const stats: [string, string][] = [
    ["tugas selesai", String(summary.done)],
    ["total kerja", summary.done === 0 ? "-" : workLabel(summary.workMs)],
    ["tool terbanyak", tools === "" ? "-" : tools],
  ];
  stats.forEach(([label, value], index) => {
    const middle = header + 40 + index * 150;
    ctx.textAlign = "left";
    ctx.fillStyle = mutedText;
    ctx.font = `500 30px ${uiFont}`;
    ctx.fillText(label, 60, middle);
    ctx.fillStyle = index === 0 ? palette.accentSoft : "#f4f1ec";
    ctx.font = index === 2 ? `600 40px ${uiFont}` : `700 64px ${uiFont}`;
    ctx.fillText(fitText(ctx, value, faceWidth / 2 - 140), 60, middle + 60);
  });

  const left = faceWidth / 2 + 20;
  const right = faceWidth - 60;
  const members = (Object.entries(tally.members) as [keyof typeof roster, MemberTally][])
    .filter(([, member]) => member.done > 0)
    .sort((a, b) => b[1].done - a[1].done || b[1].workMs - a[1].workMs);
  if (members.length === 0) {
    ctx.textAlign = "left";
    ctx.fillStyle = mutedText;
    ctx.font = `500 36px ${uiFont}`;
    ctx.fillText("Belum ada tugas yang selesai hari ini.", left, header + 120);
  }
  const rowGap = (faceHeight - header - 20) / 7;
  members.slice(0, 7).forEach(([memberId, member], index) => {
    const middle = header + 10 + rowGap * (index + 0.5);
    ctx.textAlign = "left";
    ctx.fillStyle = speakerColors[memberId];
    ctx.font = `600 38px ${uiFont}`;
    ctx.fillText(roster[memberId].displayName, left, middle);
    ctx.textAlign = "right";
    ctx.fillStyle = "#f4f1ec";
    ctx.font = `600 34px ${uiFont}`;
    ctx.fillText(`${member.done} tugas`, right - 230, middle);
    ctx.fillStyle = mutedText;
    ctx.font = `400 30px ${uiFont}`;
    ctx.fillText(workLabel(member.workMs), right, middle);
  });
}

/** Cuts a long tool name (MCP tools can be long) so it never runs into the name column. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}
