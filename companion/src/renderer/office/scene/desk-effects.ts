import { CanvasTexture, Group, Sprite, SpriteMaterial, SRGBColorSpace, Vector3 } from "three";
import { palette } from "./palette.js";

/**
 * Little flourishes at a desk while someone works: bits of code that float up off the keyboard
 * during a fast stretch of typing, and a burst of sparks over the screen when the work is done.
 * A fixed pool of sprites is reused, so busy desks never pile up objects.
 */

const glyphs = ["{ }", "</>", ";", "=>", "( )", "01"] as const;
const poolSize = 48;
/** Seconds a glyph takes to float up and fade, and how high it rises. */
const glyphSeconds = 1.2;
const glyphRise = 0.22;
/** Seconds a spark flies out and fades, and how far. */
const sparkSeconds = 0.9;
const sparkReach = 0.16;
const sparksPerBurst = 10;

function texture(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 64): CanvasTexture {
  const element = document.createElement("canvas");
  element.width = size;
  element.height = size;
  const ctx = element.getContext("2d");
  if (ctx === null) {
    throw new Error("2D canvas is not available");
  }
  draw(ctx, size);
  const result = new CanvasTexture(element);
  result.colorSpace = SRGBColorSpace;
  return result;
}

interface Particle {
  sprite: Sprite;
  kind: "glyph" | "spark";
  age: number;
  from: Vector3;
  /** Glyphs drift sideways as they rise; sparks fly along this. */
  drift: Vector3;
}

export class DeskEffects {
  readonly root = new Group();
  private readonly glyphTextures: CanvasTexture[];
  private readonly sparkTexture: CanvasTexture;
  private readonly free: Sprite[] = [];
  private readonly live: Particle[] = [];

  constructor(private readonly random: () => number = Math.random) {
    this.glyphTextures = glyphs.map((glyph) =>
      texture((ctx, size) => {
        ctx.font = `800 26px ui-monospace, Consolas, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = palette.accent;
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#e9dcff";
        ctx.fillText(glyph, size / 2, size / 2);
      }),
    );
    this.sparkTexture = texture((ctx, size) => {
      const c = size / 2;
      const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
      glow.addColorStop(0, "rgba(255, 255, 255, 1)");
      glow.addColorStop(0.3, "rgba(214, 170, 255, 0.9)");
      glow.addColorStop(1, "rgba(180, 92, 255, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);
    });
    for (let index = 0; index < poolSize; index++) {
      const sprite = new Sprite(new SpriteMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
      sprite.visible = false;
      this.root.add(sprite);
      this.free.push(sprite);
    }
  }

  /** A bit of code floating up from `at`, usually a keyboard. Dropped when the pool is in use. */
  emitGlyph(at: Vector3): void {
    const sprite = this.free.pop();
    if (sprite === undefined) {
      return;
    }
    const map = this.glyphTextures[Math.floor(this.random() * this.glyphTextures.length)] ?? null;
    sprite.material.map = map;
    sprite.material.needsUpdate = true;
    sprite.scale.setScalar(0.07);
    this.live.push({
      sprite,
      kind: "glyph",
      age: 0,
      from: at.clone(),
      drift: new Vector3((this.random() - 0.5) * 0.08, 0, (this.random() - 0.5) * 0.04),
    });
  }

  /** A ring of sparks bursting out from `at`, for work just finished. */
  burst(at: Vector3): void {
    for (let spark = 0; spark < sparksPerBurst; spark++) {
      const sprite = this.free.pop();
      if (sprite === undefined) {
        return;
      }
      sprite.material.map = this.sparkTexture;
      sprite.material.needsUpdate = true;
      const angle = (spark / sparksPerBurst) * Math.PI * 2 + this.random() * 0.3;
      const up = 0.4 + this.random() * 0.6;
      this.live.push({
        sprite,
        kind: "spark",
        age: 0,
        from: at.clone(),
        drift: new Vector3(Math.cos(angle), up, Math.sin(angle)).normalize(),
      });
    }
  }

  update(delta: number): void {
    for (let index = this.live.length - 1; index >= 0; index--) {
      const particle = this.live[index] as Particle;
      particle.age += delta;
      const length = particle.kind === "glyph" ? glyphSeconds : sparkSeconds;
      const t = particle.age / length;
      const { sprite } = particle;
      if (t >= 1) {
        sprite.visible = false;
        this.free.push(sprite);
        this.live.splice(index, 1);
        continue;
      }
      sprite.visible = true;
      if (particle.kind === "glyph") {
        sprite.position
          .copy(particle.from)
          .addScaledVector(particle.drift, t)
          .setY(particle.from.y + glyphRise * (1 - (1 - t) * (1 - t)));
        sprite.material.opacity = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      } else {
        sprite.position.copy(particle.from).addScaledVector(particle.drift, sparkReach * Math.sqrt(t));
        sprite.scale.setScalar(0.05 * (1 - t * 0.6));
        sprite.material.opacity = 1 - t;
      }
    }
  }

  /** How many sprites are showing, for tests and the frame budget. */
  active(): number {
    return this.live.length;
  }
}
