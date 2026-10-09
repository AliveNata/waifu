import { CanvasTexture, SRGBColorSpace } from "three";
import type { ScreenScript } from "./screen-scripts.js";
import { TypingProgress, visibleText } from "./typing.js";

const width = 640;
const height = 400;
const headerHeight = 36;
const lineHeight = 24;
const gutterWidth = 44;
const font = "19px Consolas, 'DejaVu Sans Mono', 'Courier New', monospace";
const maxLines = Math.floor((height - headerHeight - 12) / lineHeight);

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

  constructor(private readonly script: ScreenScript) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
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

  /** Advances typing. Returns the characters typed this frame, for the keyboard. */
  update(deltaSeconds: number, typing: boolean): string {
    let dirty = typing !== this.active;
    this.active = typing;

    const step = this.progress.step(deltaSeconds, typing);
    dirty ||= step.changed;

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

  private draw(): void {
    const ctx = this.context;
    const { theme } = this.script;

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

    const view = visibleText(this.progress.document.text, this.progress.typed, maxLines);
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
