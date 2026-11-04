import { CanvasTexture, Group, Sprite, SpriteMaterial, SRGBColorSpace } from "three";
import { palette } from "./palette.js";

/**
 * A small game-style badge over a member's head while they work: what kind of tool they are on,
 * inside a ring that turns while the work runs, and a check mark once it is done. Drawn from
 * simple shapes, so it reads the same at any size and needs no icon set.
 */

export type ToolKind = "edit" | "terminal" | "search" | "read" | "web" | "delegate" | "plan" | "think";
export type BadgeKind = ToolKind | "done";

/** Which badge a tool name gets; anything unknown, or no tool yet, reads as thinking. */
export function toolKind(tool: string | null): ToolKind {
  if (tool === null) {
    return "think";
  }
  if (/^(Edit|MultiEdit|Write|NotebookEdit)$/.test(tool)) {
    return "edit";
  }
  if (/^(Bash|BashOutput|KillShell|KillBash)$/.test(tool)) {
    return "terminal";
  }
  if (/^(Grep|Glob|LS)$/.test(tool)) {
    return "search";
  }
  if (tool === "Read") {
    return "read";
  }
  if (/^Web(Fetch|Search)$/.test(tool)) {
    return "web";
  }
  if (/^(Task|Agent)$/.test(tool)) {
    return "delegate";
  }
  if (/^(TodoWrite|ExitPlanMode)$/.test(tool)) {
    return "plan";
  }
  return "think";
}

const size = 128;
const ink = "#f4efff";

function canvasTexture(draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const element = document.createElement("canvas");
  element.width = size;
  element.height = size;
  const ctx = element.getContext("2d");
  if (ctx === null) {
    throw new Error("2D canvas is not available");
  }
  draw(ctx);
  const texture = new CanvasTexture(element);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** The glyph for each kind, drawn centered on a dark disc. */
function drawGlyph(ctx: CanvasRenderingContext2D, kind: BadgeKind): void {
  const c = size / 2;
  ctx.fillStyle = kind === "done" ? "#1f6b4a" : palette.inkDeep;
  ctx.beginPath();
  ctx.arc(c, c, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const text = (value: string, px: number): void => {
    ctx.font = `800 ${px}px ui-monospace, Consolas, monospace`;
    ctx.fillText(value, c, c + 2);
  };
  const line = (points: [number, number][]): void => {
    ctx.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) {
        ctx.moveTo(c + x, c + y);
      } else {
        ctx.lineTo(c + x, c + y);
      }
    });
    ctx.stroke();
  };
  switch (kind) {
    case "edit":
      text("</>", 34);
      break;
    case "terminal":
      line([
        [-18, -12],
        [-6, 0],
        [-18, 12],
      ]);
      line([
        [0, 13],
        [18, 13],
      ]);
      break;
    case "search":
      ctx.beginPath();
      ctx.arc(c - 5, c - 5, 13, 0, Math.PI * 2);
      ctx.stroke();
      line([
        [5, 5],
        [17, 17],
      ]);
      break;
    case "read":
      ctx.strokeRect(c - 14, c - 19, 28, 38);
      for (const y of [-8, 1, 10]) {
        line([
          [-7, y],
          [7, y],
        ]);
      }
      break;
    case "web":
      ctx.beginPath();
      ctx.arc(c, c, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(c, c, 8, 18, 0, 0, Math.PI * 2);
      ctx.stroke();
      line([
        [-18, 0],
        [18, 0],
      ]);
      break;
    case "delegate":
      for (const x of [-10, 10]) {
        ctx.beginPath();
        ctx.arc(c + x, c - 8, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(c + x, c + 14, 11, Math.PI, 0);
        ctx.fill();
      }
      break;
    case "plan":
      for (const y of [-12, 0, 12]) {
        line([
          [-16, y],
          [-11, y + 4],
          [-6, y - 4],
        ]);
        line([
          [2, y],
          [17, y],
        ]);
      }
      break;
    case "think":
      for (const x of [-14, 0, 14]) {
        ctx.beginPath();
        ctx.arc(c + x, c, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "done":
      ctx.lineWidth = 9;
      line([
        [-17, 1],
        [-5, 13],
        [18, -12],
      ]);
      break;
  }
}

/** Three quarters of a ring in the brand purple; turning it reads as "in progress". */
function drawRing(ctx: CanvasRenderingContext2D): void {
  const c = size / 2;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(c, c, 55, -Math.PI / 2, Math.PI);
  ctx.stroke();
}

/** Shared textures: one per kind, made the first time a badge needs it. */
const glyphs = new Map<BadgeKind, CanvasTexture>();
let ring: CanvasTexture | null = null;

function glyphTexture(kind: BadgeKind): CanvasTexture {
  let texture = glyphs.get(kind);
  if (texture === undefined) {
    texture = canvasTexture((ctx) => drawGlyph(ctx, kind));
    glyphs.set(kind, texture);
  }
  return texture;
}

/** Meters across, at the scale of the team's heads. */
const badgeSize = 0.13;

export class StatusBadge {
  /** Placed over the head by the stage each frame. */
  readonly root = new Group();
  /** Inside the root, bobbing gently. */
  private readonly float = new Group();
  private readonly icon: Sprite;
  private readonly ringSprite: Sprite;
  private kind: BadgeKind | null = null;

  constructor() {
    ring ??= canvasTexture(drawRing);
    const iconMaterial = new SpriteMaterial({ transparent: true, depthWrite: false, toneMapped: false });
    this.icon = new Sprite(iconMaterial);
    this.icon.scale.setScalar(badgeSize);
    this.ringSprite = new Sprite(
      new SpriteMaterial({ map: ring, transparent: true, depthWrite: false, toneMapped: false }),
    );
    this.ringSprite.scale.setScalar(badgeSize);
    // Over the head, never hidden by it.
    this.icon.renderOrder = 3;
    this.ringSprite.renderOrder = 3;
    this.float.add(this.icon, this.ringSprite);
    this.root.add(this.float);
    this.root.visible = false;
  }

  /**
   * Shows `kind`, or hides the badge with null. `time` turns the ring; `pop` (0..1) swells the
   * badge for a moment when the work is done.
   */
  update(kind: BadgeKind | null, time: number, pop: number): void {
    this.root.visible = kind !== null;
    if (kind === null) {
      return;
    }
    if (kind !== this.kind) {
      this.kind = kind;
      this.icon.material.map = glyphTexture(kind);
      this.icon.material.needsUpdate = true;
    }
    this.ringSprite.visible = kind !== "done";
    this.ringSprite.material.rotation = -time * 3;
    const scale = badgeSize * (1 + 0.35 * Math.sin(Math.PI * Math.min(1, pop)));
    this.icon.scale.setScalar(scale);
    // A slow bob, so it reads as a live marker rather than a sticker.
    this.float.position.y = 0.012 * Math.sin(time * 2.2);
  }
}
