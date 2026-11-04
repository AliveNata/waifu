import {
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { type PickerView, pickedKind, pickerTabs } from "./food-picker.js";
import { foodNames } from "./office-food.js";

/** A plain modern phone, in meters: tall and thin with rounded corners, no maker's marks. */
const width = 0.072;
const height = 0.15;
const thickness = 0.008;
const screenWidth = 360;
const screenHeight = 750;
const uiFont = "'Segoe UI', system-ui, sans-serif";

/** Screen colors: a dark app with the office's violet for what is picked. */
const colors = {
  background: "#14111c",
  card: "#221d2e",
  text: "#f4f1ec",
  muted: "#a79fb8",
  accent: "#a77bf3",
  accentInk: "#14111c",
};

/** Lines on the screen, for drawing and for tests: what the order app shows right now. */
export function phoneLines(view: PickerView, clock: string): string[] {
  if (view.status !== null) {
    return [clock, "Pesan Makanan", view.status, "I tutup"];
  }
  const tab = pickerTabs[view.state.tab];
  return [
    clock,
    "Pesan Makanan",
    `${pickerTabs.meal.label} | ${pickerTabs.drink.label}`,
    ...tab.kinds.map((kind, index) => `${index + 1} ${foodNames[kind]}`),
    "1-9 pesan · ←→ tab · Enter",
  ];
}

/**
 * Alyx's phone, held up in his left hand while he orders food: the order app on its screen,
 * redrawn only when what it shows changes.
 */
export class AlyxPhone {
  readonly root = new Group();
  private readonly context: CanvasRenderingContext2D;
  private readonly texture: CanvasTexture;
  private shown = "";

  constructor() {
    const canvas = document.createElement("canvas");
    canvas.width = screenWidth;
    canvas.height = screenHeight;
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("2D canvas is not available");
    }
    this.context = context;
    this.texture = new CanvasTexture(canvas);
    this.texture.colorSpace = SRGBColorSpace;
    const body = new Mesh(
      new RoundedBoxGeometry(width, height, thickness, 4, 0.008),
      new MeshStandardMaterial({ color: "#2a2730", roughness: 0.35, metalness: 0.6 }),
    );
    const screen = new Mesh(
      new PlaneGeometry(width - 0.006, height - 0.006),
      new MeshBasicMaterial({ map: this.texture, toneMapped: false }),
    );
    screen.position.z = thickness / 2 + 0.0005;
    // Two lenses in a raised block at the top of the back.
    const lensMaterial = new MeshStandardMaterial({ color: "#0d0c10", roughness: 0.2, metalness: 0.4 });
    const bump = new Mesh(
      new RoundedBoxGeometry(0.026, 0.03, 0.003, 2, 0.004),
      new MeshStandardMaterial({ color: "#2a2730", roughness: 0.3, metalness: 0.6 }),
    );
    bump.position.set(-0.016, height / 2 - 0.022, -thickness / 2 - 0.0012);
    const lenses = [-0.006, 0.006].map((y) => {
      const lens = new Mesh(new CylinderGeometry(0.0045, 0.0045, 0.002, 16), lensMaterial);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(-0.016, height / 2 - 0.022 + y, -thickness / 2 - 0.003);
      return lens;
    });
    this.root.add(body, screen, bump, ...lenses);
  }

  /** Draws the order app: the list on its two tabs, or how far along the order is. */
  draw(view: PickerView, clock: string): void {
    const signature = `${phoneLines(view, clock).join("|")}|${view.state.selected}|${view.state.tab}`;
    if (signature === this.shown) {
      return;
    }
    this.shown = signature;
    const ctx = this.context;
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, screenWidth, screenHeight);
    ctx.textBaseline = "middle";

    // Status bar: the time on the left, as phones show it.
    ctx.fillStyle = colors.text;
    ctx.font = `600 22px ${uiFont}`;
    ctx.textAlign = "left";
    ctx.fillText(clock, 28, 30);

    ctx.font = `700 32px ${uiFont}`;
    ctx.fillText("Pesan Makanan", 24, 92);

    if (view.status !== null) {
      this.card(24, 150, screenWidth - 48, 180);
      ctx.fillStyle = colors.text;
      ctx.font = `600 26px ${uiFont}`;
      this.wrap(view.status, 44, 200, screenWidth - 88, 34);
      ctx.fillStyle = colors.muted;
      ctx.font = `400 20px ${uiFont}`;
      ctx.fillText("I buat simpan HP", 24, screenHeight - 36);
      this.texture.needsUpdate = true;
      return;
    }

    // Tabs: the one showing is filled.
    const tabWidth = (screenWidth - 48 - 12) / 2;
    (["meal", "drink"] as const).forEach((tab, index) => {
      const x = 24 + index * (tabWidth + 12);
      const active = view.state.tab === tab;
      ctx.fillStyle = active ? colors.accent : colors.card;
      this.roundRect(x, 130, tabWidth, 48, 24);
      ctx.fill();
      ctx.fillStyle = active ? colors.accentInk : colors.muted;
      ctx.font = `600 22px ${uiFont}`;
      ctx.textAlign = "center";
      ctx.fillText(pickerTabs[tab].label, x + tabWidth / 2, 154);
    });

    const kinds = pickerTabs[view.state.tab].kinds;
    const picked = pickedKind(view.state);
    kinds.forEach((kind, index) => {
      const y = 200 + index * 62;
      const chosen = kind === picked;
      ctx.fillStyle = chosen ? colors.accent : colors.card;
      this.roundRect(24, y, screenWidth - 48, 52, 14);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.fillStyle = chosen ? colors.accentInk : colors.accent;
      ctx.font = `700 22px ${uiFont}`;
      ctx.fillText(String(index + 1), 52, y + 26);
      ctx.textAlign = "left";
      ctx.fillStyle = chosen ? colors.accentInk : colors.text;
      ctx.font = `500 24px ${uiFont}`;
      ctx.fillText(foodNames[kind], 80, y + 26);
    });

    ctx.textAlign = "left";
    ctx.fillStyle = colors.muted;
    ctx.font = `400 19px ${uiFont}`;
    ctx.fillText("1-9 pesan · ←→ tab · Enter pesan", 24, screenHeight - 60);
    ctx.fillText("I buat simpan HP", 24, screenHeight - 32);
    this.texture.needsUpdate = true;
  }

  private card(x: number, y: number, w: number, h: number): void {
    this.context.fillStyle = colors.card;
    this.roundRect(x, y, w, h, 18);
    this.context.fill();
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.context;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** Text broken onto as many lines as it needs within `maxWidth`. */
  private wrap(text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
    const ctx = this.context;
    ctx.textAlign = "left";
    let line = "";
    let row = 0;
    for (const word of text.split(" ")) {
      const next = line === "" ? word : `${line} ${word}`;
      if (ctx.measureText(next).width > maxWidth && line !== "") {
        ctx.fillText(line, x, y + row * lineHeight);
        line = word;
        row++;
      } else {
        line = next;
      }
    }
    ctx.fillText(line, x, y + row * lineHeight);
  }
}
