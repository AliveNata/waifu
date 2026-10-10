import { CanvasTexture, type Mesh, type MeshStandardMaterial, SRGBColorSpace } from "three";
import { palette } from "./palette.js";

/** Redraw rate for the small animated screens: smooth enough to read as motion, cheap on the CPU. */
const framesPerSecond = 12;

abstract class CanvasScreen<Mode extends string> {
  readonly texture: CanvasTexture;
  protected readonly ctx: CanvasRenderingContext2D;
  protected time = 0;
  private sinceDraw = Number.POSITIVE_INFINITY;
  private mode: Mode | null = null;

  constructor(
    protected readonly width: number,
    protected readonly height: number,
  ) {
    const element = document.createElement("canvas");
    element.width = width;
    element.height = height;
    const ctx = element.getContext("2d");
    if (ctx === null) {
      throw new Error("2D canvas is not available");
    }
    this.ctx = ctx;
    this.texture = new CanvasTexture(element);
    this.texture.colorSpace = SRGBColorSpace;
  }

  update(deltaSeconds: number, mode: Mode): void {
    this.time += deltaSeconds;
    this.sinceDraw += deltaSeconds;
    const changed = mode !== this.mode;
    if (!changed && (this.isStatic(mode) || this.sinceDraw < 1 / framesPerSecond)) {
      return;
    }
    this.mode = mode;
    this.sinceDraw = 0;
    this.draw(mode);
    this.texture.needsUpdate = true;
  }

  protected abstract isStatic(mode: Mode): boolean;
  protected abstract draw(mode: Mode): void;
}

export type TvMode = "off" | "show" | "game";

/** Lounge TV: dark when nobody watches, a calm show for "tv", a side-scroller for the console. */
export class TvScreen extends CanvasScreen<TvMode> {
  constructor() {
    super(320, 180);
  }

  protected isStatic(mode: TvMode): boolean {
    return mode === "off";
  }

  protected draw(mode: TvMode): void {
    const { ctx, width, height, time } = this;
    if (mode === "off") {
      const glass = ctx.createLinearGradient(0, 0, width, height);
      glass.addColorStop(0, "#15121c");
      glass.addColorStop(1, "#262033");
      ctx.fillStyle = glass;
      ctx.fillRect(0, 0, width, height);
      return;
    }
    if (mode === "show") {
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, "#f7b98b");
      sky.addColorStop(1, "#f3dfb8");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#e9875f";
      ctx.beginPath();
      ctx.arc(width * 0.72, height * 0.42, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5d4a6b";
      ctx.fillRect(0, height * 0.72, width, height * 0.28);
      // Two characters talking: small bobbing silhouettes.
      for (const [x, phase] of [
        [0.35, 0],
        [0.52, 1.7],
      ] as const) {
        const bob = Math.sin(time * 3 + phase) * 2;
        ctx.fillStyle = "#3a2d48";
        ctx.fillRect(width * x, height * 0.5 + bob, 22, 34);
        ctx.beginPath();
        ctx.arc(width * x + 11, height * 0.46 + bob, 11, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    ctx.fillStyle = "#1e1636";
    ctx.fillRect(0, 0, width, height);
    const ground = height * 0.78;
    ctx.fillStyle = palette.accent;
    ctx.fillRect(0, ground, width, 4);
    const scroll = (time * 90) % 120;
    ctx.fillStyle = "#7cf2c8";
    for (let x = -scroll; x < width; x += 120) {
      ctx.fillRect(x + 60, ground - 22, 16, 22);
    }
    const jump = Math.max(0, Math.sin(time * 4.2)) * 38;
    ctx.fillStyle = "#ffd36b";
    ctx.fillRect(width * 0.22, ground - 20 - jump, 18, 20);
  }
}

export type ArcadeMode = "attract" | "playing";

/** Arcade cabinet: a starfield shooter in attract mode, busier while someone plays. */
export class ArcadeScreen extends CanvasScreen<ArcadeMode> {
  constructor() {
    super(160, 200);
  }

  protected isStatic(): boolean {
    return false;
  }

  protected draw(mode: ArcadeMode): void {
    const { ctx, width, height, time } = this;
    const speed = mode === "playing" ? 160 : 60;
    ctx.fillStyle = "#0d0818";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    for (let star = 0; star < 28; star++) {
      const x = (star * 53) % width;
      const y = (star * 37 + time * speed * (0.5 + (star % 3) * 0.25)) % height;
      ctx.fillRect(x, y, 2, 2);
    }
    const shipX = width / 2 + Math.sin(time * (mode === "playing" ? 2.6 : 1.1)) * 40;
    ctx.fillStyle = palette.accentSoft;
    ctx.beginPath();
    ctx.moveTo(shipX, height - 40);
    ctx.lineTo(shipX - 12, height - 18);
    ctx.lineTo(shipX + 12, height - 18);
    ctx.fill();
    if (mode === "playing") {
      ctx.fillStyle = "#ffd36b";
      for (let shot = 0; shot < 4; shot++) {
        const y = height - 50 - ((time * 260 + shot * 45) % (height - 60));
        ctx.fillRect(shipX - 1, y, 3, 8);
      }
    }
    ctx.fillStyle = "#7cf2c8";
    for (let enemy = 0; enemy < 5; enemy++) {
      const x = 20 + enemy * 28 + Math.sin(time * 1.5 + enemy) * 6;
      ctx.fillRect(x, 30 + Math.cos(time + enemy) * 4, 14, 10);
    }
  }
}

/** Status lights on the server rack: steady when idle, busy blinking while Yor checks it. */
export class RackLights {
  constructor(private readonly lights: readonly { mesh: Mesh; material: MeshStandardMaterial }[]) {}

  update(time: number, busy: boolean): void {
    this.lights.forEach(({ material }, index) => {
      const rate = busy ? 7 + (index % 3) * 2 : 1.2 + (index % 4) * 0.3;
      const on = Math.sin(time * rate + index * 1.9) > (busy ? -0.2 : -0.7);
      material.emissiveIntensity = on ? 1.8 : 0.15;
    });
  }
}
