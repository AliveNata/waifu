import { CanvasTexture, SRGBColorSpace } from "three";
import type { ScreenScript } from "./screen-scripts.js";
import { TypingProgress, visibleText } from "./typing.js";
import { drawWorkWidget, type WorkWidget, widgetStep, widgetSteps } from "./work-widget.js";

const headerHeight = 36;
const lineHeight = 24;
const gutterWidth = 44;
const font = "19px Consolas, 'DejaVu Sans Mono', 'Courier New', monospace";

/** Canvas size in pixels. Ultrawide and portrait monitors get their own shape, so text never stretches. */
export interface ScreenSize {
  width: number;
  height: number;
}

export const landscapeScreen: ScreenSize = { width: 640, height: 400 };

/**
 * The sign-in screen a desk shows while its owner is away: the time, their photo and name, and
 * the password dots filling in as they sign back in (`typed` 0 to 1), or null while just locked.
 */
export interface LockScreen {
  name: string;
  photo: CanvasImageSource | null;
  clock: string;
  typed: number | null;
}

/** How many dots the password field fills to. */
const passwordLength = 8;

/**
 * A dark violet sign-in screen: the time on top, the round photo, the name, the password field.
 * Drawn on a desk's main screen and on its extra monitors alike.
 */
export function drawLockScreen(ctx: CanvasRenderingContext2D, width: number, height: number, lock: LockScreen): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#2a1a4a");
  gradient.addColorStop(1, "#120d1f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  const unit = Math.min(width, height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f4f1ec";
  ctx.font = `300 ${Math.round(unit * 0.13)}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillText(lock.clock, width / 2, height * 0.16);
  const radius = unit * 0.17;
  const centerY = height * 0.46;
  ctx.save();
  ctx.beginPath();
  ctx.arc(width / 2, centerY, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = "#3d2a63";
  ctx.fill();
  if (lock.photo !== null) {
    ctx.clip();
    ctx.drawImage(lock.photo, width / 2 - radius, centerY - radius, radius * 2, radius * 2);
  }
  ctx.restore();
  ctx.strokeStyle = "#b45cff";
  ctx.lineWidth = Math.max(2, unit * 0.008);
  ctx.beginPath();
  ctx.arc(width / 2, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#f4f1ec";
  ctx.font = `600 ${Math.round(unit * 0.07)}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillText(lock.name, width / 2, centerY + radius + unit * 0.08);
  // The password field under the name; empty while locked, dots as it fills.
  const fieldWidth = unit * 0.62;
  const fieldHeight = unit * 0.09;
  const fieldY = centerY + radius + unit * 0.15;
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  ctx.fillRect(width / 2 - fieldWidth / 2, fieldY, fieldWidth, fieldHeight);
  const dots = lock.typed === null ? 0 : Math.round(lock.typed * passwordLength);
  if (dots === 0) {
    ctx.fillStyle = "#a79fb8";
    ctx.font = `400 ${Math.round(unit * 0.045)}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillText("Terkunci", width / 2, fieldY + fieldHeight / 2);
  } else {
    ctx.fillStyle = "#f4f1ec";
    const spacing = unit * 0.045;
    for (let dot = 0; dot < dots; dot++) {
      ctx.beginPath();
      ctx.arc(
        width / 2 - ((passwordLength - 1) * spacing) / 2 + dot * spacing,
        fieldY + fieldHeight / 2,
        unit * 0.012,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
}

/** A monitor or laptop screen whose content is typed live onto a canvas texture. */
export class ScreenSurface {
  readonly canvas: HTMLCanvasElement;
  readonly texture: CanvasTexture;
  private readonly context: CanvasRenderingContext2D;
  private readonly progress: TypingProgress;
  private readonly keywordPattern: RegExp;
  private active = false;
  private cursorVisible = true;
  private cursorTimer = 0;
  private readonly width: number;
  private readonly height: number;
  private readonly maxLines: number;
  /** The live panel in the corner while typing, for the role at this desk; none on laptops. */
  private widget: WorkWidget | null = null;
  private widgetSeconds = 0;
  private widgetAt = -1;
  /** Locked while the owner is away; the work is not shown under it. */
  private lock: LockScreen | null = null;
  private lockShown = "";

  constructor(
    private readonly script: ScreenScript,
    size: ScreenSize = landscapeScreen,
  ) {
    this.width = size.width;
    this.height = size.height;
    this.maxLines = Math.floor((size.height - headerHeight - 12) / lineHeight);
    this.canvas = document.createElement("canvas");
    this.canvas.width = size.width;
    this.canvas.height = size.height;
    const context = this.canvas.getContext("2d");
    if (context === null) {
      throw new Error("2D canvas is not available");
    }
    this.context = context;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.progress = new TypingProgress(script.documents);
    const escaped = script.keywords.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    this.keywordPattern = new RegExp(`(${escaped.join("|")})`, "g");
    this.draw();
  }

  /** Shows `widget` in the screen's corner while typing, or nothing with null. */
  setWidget(widget: WorkWidget | null): void {
    if (widget !== this.widget) {
      this.widget = widget;
      this.widgetAt = -1;
      this.draw();
    }
  }

  /** Locks the screen to show `lock`, or back to the work with null. */
  setLock(lock: LockScreen | null): void {
    const signature =
      lock === null
        ? ""
        : `${lock.name}|${lock.clock}|${lock.typed === null ? "-" : Math.round(lock.typed * passwordLength)}|${lock.photo === null ? 0 : 1}`;
    if (signature === this.lockShown) {
      return;
    }
    this.lockShown = signature;
    this.lock = lock;
    if (lock === null) {
      this.draw();
    } else {
      this.drawLock(lock);
    }
  }

  /** Advances typing. Returns the characters typed this frame, for the keyboard. */
  update(deltaSeconds: number, typing: boolean): string {
    if (this.lock !== null) {
      return "";
    }
    let dirty = typing !== this.active;
    this.active = typing;

    const step = this.progress.step(deltaSeconds, typing);
    dirty ||= step.changed;

    if (typing && this.widget !== null) {
      this.widgetSeconds += deltaSeconds;
      const step = widgetStep(this.widgetSeconds);
      if (step !== this.widgetAt) {
        this.widgetAt = step;
        dirty = true;
      }
    }

    this.cursorTimer += deltaSeconds;
    if (this.cursorTimer >= 0.5) {
      this.cursorTimer = 0;
      this.cursorVisible = !this.cursorVisible;
      dirty ||= typing;
    }
    if (dirty) {
      this.draw();
    }
    return step.typed;
  }

  private drawLock(lock: LockScreen): void {
    drawLockScreen(this.context, this.width, this.height, lock);
    this.texture.needsUpdate = true;
  }

  private draw(): void {
    const ctx = this.context;
    const { theme } = this.script;
    const { width, height } = this;

    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = theme.header;
    ctx.fillRect(0, 0, width, headerHeight);
    ctx.font = "bold 17px 'Segoe UI', system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillStyle = theme.foreground;
    ctx.fillText(this.progress.document.title, 14, headerHeight / 2);
    // Honest label: the content is simulated, not the user's real work.
    ctx.font = "14px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = theme.muted;
    ctx.textAlign = "right";
    ctx.fillText("simulasi", width - 12, headerHeight / 2);
    ctx.textAlign = "left";

    const view = visibleText(this.progress.document.text, this.progress.typed, this.maxLines);
    ctx.font = font;
    view.lines.forEach((line, index) => {
      const y = headerHeight + 10 + index * lineHeight + lineHeight / 2;
      ctx.fillStyle = theme.muted;
      ctx.textAlign = "right";
      ctx.fillText(String(view.firstLineNumber + index), gutterWidth - 10, y);
      ctx.textAlign = "left";
      this.drawHighlighted(line, gutterWidth, y);
    });

    if (this.active && this.cursorVisible) {
      const cursorText = view.lines[view.cursorLine] ?? "";
      const x = gutterWidth + ctx.measureText(cursorText).width;
      const y = headerHeight + 10 + view.cursorLine * lineHeight + 3;
      ctx.fillStyle = theme.accent;
      ctx.fillRect(x + 1, y, 10, lineHeight - 6);
    }

    if (this.active && this.widget !== null) {
      const widgetWidth = Math.round(width * 0.36);
      const widgetHeight = Math.round(Math.min(height * 0.4, widgetWidth * 0.7));
      drawWorkWidget(ctx, this.widget, (Math.max(0, this.widgetAt) + 1) / widgetSteps, this.script.theme, {
        x: width - widgetWidth - 12,
        y: height - widgetHeight - 12,
        width: widgetWidth,
        height: widgetHeight,
      });
    }

    if (!this.active) {
      // Idle screens dim, so the active member stands out from across the room.
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.fillRect(0, 0, width, height);
    }
    this.texture.needsUpdate = true;
  }

  private drawHighlighted(line: string, x: number, y: number): void {
    const ctx = this.context;
    const script = this.script;
    let cursor = x;
    for (const part of line.split(this.keywordPattern)) {
      if (part === "") {
        continue;
      }
      const isKeyword = script.keywords.includes(part);
      ctx.fillStyle = isKeyword ? script.theme.accent : script.theme.foreground;
      ctx.fillText(part, cursor, y);
      cursor += ctx.measureText(part).width;
    }
  }
}
