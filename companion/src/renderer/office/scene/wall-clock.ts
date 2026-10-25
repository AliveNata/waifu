import { CanvasTexture, Group, PlaneGeometry, SRGBColorSpace } from "three";
import type { Furniture } from "../office-plan.js";
import { clockFace, jakartaTime, officeTimeZone } from "../office-time.js";
import { box, glow, mesh, palette, standard, unlit } from "./palette.js";

const faceWidth = 512;
const faceHeight = 192;
const uiFont = "'Segoe UI', system-ui, sans-serif";

/**
 * A big LED clock on the pantry wall showing Jakarta time, with the time zone written under the
 * digits. It redraws only when what it shows changes, which is once a second for the colon.
 */
export class WallClock {
  readonly root: Group;
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
    this.root = new Group();
    this.root.position.set(piece.x, 0, piece.z);
    this.root.rotation.y = piece.yaw;
    // As tall as the face drawing is wide-to-high, so the digits keep their shape at any width.
    const height = piece.width * (faceHeight / faceWidth) + 0.04;
    const centerY = 1.58;
    this.root.add(
      box(piece.width, height, 0.03, standard(palette.inkDeep, 0.4), 0, centerY - height / 2, 0),
      box(piece.width - 0.04, 0.008, 0.032, glow(palette.accent, 1.4), 0, centerY - height / 2 + 0.01, 0),
    );
    const face = mesh(new PlaneGeometry(piece.width - 0.04, height - 0.03), unlit(this.texture), false);
    face.position.set(0, centerY, 0.017);
    this.root.add(face);
  }

  update(date: Date): void {
    const time = jakartaTime(date);
    const digits = clockFace(time, true);
    if (digits === this.shown) {
      return;
    }
    this.shown = digits;
    const ctx = this.context;
    ctx.fillStyle = "#120f1a";
    ctx.fillRect(0, 0, faceWidth, faceHeight);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = palette.accent;
    ctx.shadowBlur = 18;
    ctx.fillStyle = palette.accentSoft;
    ctx.font = `600 118px ${uiFont}`;
    // Each half drawn on its own, so the blinking colon never shifts the digits.
    const [hours, minutes] = [digits.slice(0, 2), digits.slice(3)];
    ctx.fillText(hours, faceWidth / 2 - 92, 78);
    ctx.fillText(minutes, faceWidth / 2 + 92, 78);
    if (digits[2] === ":") {
      ctx.fillText(":", faceWidth / 2, 70);
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#8f86a3";
    ctx.font = `500 26px ${uiFont}`;
    ctx.fillText(officeTimeZone, faceWidth / 2, 162);
    this.texture.needsUpdate = true;
  }
}
