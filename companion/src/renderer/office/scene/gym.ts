import {
  CanvasTexture,
  CylinderGeometry,
  Group,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
} from "three";
import { type Furniture, treadmillDeckHeight } from "../office-plan.js";
import { punchReach } from "../office-pose.js";
import { deskTop } from "./desks.js";
import { box, glow, mesh, palette, standard } from "./palette.js";

function placed(piece: Furniture): Group {
  const root = new Group();
  root.position.set(piece.x, 0, piece.z);
  root.rotation.y = piece.yaw;
  return root;
}

function localSize(piece: Furniture): { width: number; depth: number } {
  const sideways = Math.abs(Math.sin(piece.yaw)) > 0.5;
  return sideways ? { width: piece.depth, depth: piece.width } : { width: piece.width, depth: piece.depth };
}

/**
 * The short leg of an L-desk: the same laminate top and dark legs as the desks, at the same
 * height, with the accent strip along its open edge so it reads as one piece with the main desk.
 */
export function buildDeskReturn(piece: Furniture): Group {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const legs = standard(palette.ink, 0.6);
  root.add(
    box(width, 0.04, depth, standard(palette.laminate, 0.45), 0, deskTop - 0.04, 0),
    // One leg panel at the free end: the other end rests on the main desk.
    box(width - 0.08, deskTop - 0.04, 0.04, legs, 0, 0, depth / 2 - 0.04),
    box(0.012, 0.012, depth - 0.1, glow(), width / 2 - 0.02, deskTop - 0.05, 0),
  );
  return root;
}

/** A plain bench: an oak seat on two dark frames, at the sofa's height. */
export function buildBench(piece: Furniture): Group {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const seat = 0.26;
  const frame = standard(palette.ink, 0.6);
  root.add(
    box(width, 0.05, depth, standard(palette.oak, 0.7), 0, seat - 0.05, 0),
    box(width - 0.08, seat - 0.05, 0.05, frame, 0, 0, -depth / 2 + 0.1),
    box(width - 0.08, seat - 0.05, 0.05, frame, 0, 0, depth / 2 - 0.1),
  );
  return root;
}

function beltTexture(): CanvasTexture {
  const element = document.createElement("canvas");
  element.width = 32;
  element.height = 64;
  const context = element.getContext("2d");
  if (context === null) {
    throw new Error("2D canvas is not available");
  }
  context.fillStyle = "#26222d";
  context.fillRect(0, 0, 32, 64);
  // Cross ribs, so the belt is seen to move.
  context.fillStyle = "#3a3542";
  for (let y = 0; y < 64; y += 16) {
    context.fillRect(0, y, 32, 4);
  }
  const texture = new CanvasTexture(element);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}

/**
 * A treadmill sized for chibi legs: a low deck with a moving belt, side rails, and the console on
 * two uprights at the front, at a chibi's waist height. The belt runs and the console lights up
 * while someone is jogging on it.
 */
export class Treadmill {
  readonly root: Group;
  private readonly belt: CanvasTexture;
  private readonly display: MeshStandardMaterial;
  private offset = 0;

  constructor(piece: Furniture) {
    this.root = placed(piece);
    const { width, depth } = localSize(piece);
    const frame = standard(palette.inkSoft, 0.5, 0.2);
    const deck = treadmillDeckHeight;
    this.belt = beltTexture();
    this.belt.repeat.set(1, depth * 6);
    const beltWidth = width - 0.16;
    const belt = mesh(
      new PlaneGeometry(beltWidth, depth - 0.12),
      new MeshStandardMaterial({ map: this.belt, roughness: 0.9 }),
      false,
    );
    belt.rotation.x = -Math.PI / 2;
    belt.position.set(0, deck + 0.002, 0);
    this.display = glow(palette.accentSoft, 0.2);
    const front = depth / 2 - 0.08;
    const consoleY = 0.62;
    this.root.add(
      box(width, deck, depth, frame, 0, 0, 0),
      box(0.06, deck + 0.015, depth - 0.04, standard(palette.ink, 0.6), -width / 2 + 0.03, 0, 0),
      box(0.06, deck + 0.015, depth - 0.04, standard(palette.ink, 0.6), width / 2 - 0.03, 0, 0),
      belt,
      box(0.04, consoleY, 0.04, frame, -width / 2 + 0.04, 0, front),
      box(0.04, consoleY, 0.04, frame, width / 2 - 0.04, 0, front),
      // Hand rails reaching back along the sides at a chibi's hip height.
      box(0.03, 0.03, 0.32, frame, -width / 2 + 0.04, consoleY - 0.14, front - 0.16),
      box(0.03, 0.03, 0.32, frame, width / 2 - 0.04, consoleY - 0.14, front - 0.16),
      box(width, 0.1, 0.12, standard(palette.ink, 0.5), 0, consoleY, front),
      box(width - 0.16, 0.05, 0.01, this.display, 0, consoleY + 0.03, front - 0.061),
    );
  }

  update(running: boolean, delta: number): void {
    this.display.emissiveIntensity = running ? 1.4 : 0.2;
    if (!running) {
      return;
    }
    // The belt runs back under the runner's feet, at about their jogging speed.
    this.offset = (this.offset + delta * 1.4) % 1;
    this.belt.offset.y = -this.offset;
  }
}

/**
 * A heavy bag on a freestanding stand: a weighted base, a post at the back and an arm over the
 * top with the bag on a short chain, its middle at a standing chibi's chest. It swings back each
 * time a punch lands, on the same clock as the puncher's fists.
 */
export class PunchingBag {
  readonly root: Group;
  private readonly swing: Group;
  private angle = 0;

  constructor(piece: Furniture) {
    this.root = placed(piece);
    const { depth } = localSize(piece);
    const frame = standard(palette.ink, 0.5, 0.2);
    const top = 1.15;
    const post = -depth / 2 + 0.05;
    this.root.add(
      box(0.42, 0.05, depth, frame, 0, 0, 0),
      box(0.05, top, 0.05, frame, 0, 0, post),
      box(0.05, 0.05, depth / 2 + 0.03, frame, 0, top - 0.05, post + depth / 4),
    );
    this.swing = new Group();
    this.swing.position.set(0, top - 0.05, 0.02);
    const chain = mesh(new CylinderGeometry(0.006, 0.006, 0.12, 6), standard(palette.steel, 0.4, 0.8));
    chain.position.y = -0.06;
    const bagHeight = 0.5;
    const bag = mesh(new CylinderGeometry(0.13, 0.13, bagHeight, 20), standard("#b5473f", 0.75));
    bag.position.y = -0.12 - bagHeight / 2;
    const band = mesh(new CylinderGeometry(0.133, 0.133, 0.04, 20), standard(palette.ink, 0.6));
    band.position.y = -0.12 - bagHeight * 0.3;
    this.swing.add(chain, bag, band);
    this.root.add(this.swing);
  }

  /** `elapsed` is how long the current puncher has been at it, or null when nobody is. */
  update(elapsed: number | null, delta: number): void {
    const reach = elapsed === null ? 0 : Math.max(punchReach(elapsed).left, punchReach(elapsed).right);
    // Pushed away from the puncher (who stands in front, at +z) as the fist lands, then settling.
    const target = 0.22 * reach;
    this.angle += (target - this.angle) * (1 - Math.exp(-8 * delta));
    this.swing.rotation.x = this.angle;
  }
}

interface Fish {
  body: Object3D;
  speed: number;
  phase: number;
  depthLane: number;
  height: number;
}

const fishColors = ["#ff8a3d", "#ffd23f", "#4fc3f7", "#ff6fa8", "#9be564", "#ff8a3d"] as const;

/**
 * A long low aquarium on an oak cabinet: tinted water, sand, a few plants and small fish swimming
 * from end to end at different speeds and depths, lit from a strip under the lid.
 */
export class Aquarium {
  readonly root: Group;
  private readonly fish: Fish[] = [];
  private readonly tankWidth: number;

  constructor(piece: Furniture) {
    this.root = placed(piece);
    const { width, depth } = localSize(piece);
    const cabinet = 0.42;
    const tank = 0.4;
    this.tankWidth = width - 0.06;
    const water = new MeshStandardMaterial({
      color: "#6fc3e0",
      transparent: true,
      opacity: 0.32,
      roughness: 0.1,
      depthWrite: false,
    });
    const frame = standard(palette.ink, 0.5);
    this.root.add(
      // Oak, like the meeting table, so it reads as furniture and not a black box from across the room.
      box(width, cabinet, depth, standard(palette.oak, 0.7), 0, 0, 0),
      box(width + 0.01, 0.04, depth + 0.01, standard(palette.ink, 0.6), 0, 0, 0),
      box(width - 0.06, 0.04, depth - 0.06, standard("#e8d9b5", 0.95), 0, cabinet, 0),
      box(width, 0.03, depth, frame, 0, cabinet + tank, 0),
      box(width - 0.1, 0.012, 0.02, glow("#bfe9ff", 1.2), 0, cabinet + tank - 0.015, 0),
    );
    const glass = mesh(new PlaneGeometry(1, 1), water, false);
    const tankBox = new Group();
    for (const [w, h, x, z, yaw] of [
      [width - 0.04, tank, 0, depth / 2 - 0.02, 0],
      [width - 0.04, tank, 0, -depth / 2 + 0.02, Math.PI],
      [depth - 0.04, tank, width / 2 - 0.02, 0, Math.PI / 2],
      [depth - 0.04, tank, -width / 2 + 0.02, 0, -Math.PI / 2],
    ] as const) {
      const pane = glass.clone();
      pane.scale.set(w, h, 1);
      pane.position.set(x, cabinet + tank / 2, z);
      pane.rotation.y = yaw;
      tankBox.add(pane);
    }
    this.root.add(tankBox);
    for (let index = 0; index < 5; index++) {
      const x = -width / 2 + 0.2 + index * ((width - 0.4) / 4);
      const blade = mesh(
        new CylinderGeometry(0.004, 0.012, 0.14 + 0.08 * (index % 2), 5),
        standard(index % 2 === 0 ? palette.leaf : palette.leafDark, 0.8),
      );
      blade.position.set(x, cabinet + 0.1, (index % 2 === 0 ? -1 : 1) * depth * 0.18);
      this.root.add(blade);
    }
    fishColors.forEach((color, index) => {
      const body = new Group();
      const fishBody = mesh(new SphereGeometry(0.022, 10, 8), standard(color, 0.5), false);
      fishBody.scale.set(1.6, 0.9, 0.7);
      const tail = mesh(new CylinderGeometry(0, 0.016, 0.03, 4), standard(color, 0.5), false);
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -0.045;
      body.add(fishBody, tail);
      this.root.add(body);
      this.fish.push({
        body,
        speed: 0.12 + 0.05 * (index % 3),
        phase: index * 1.7,
        depthLane: ((index % 3) - 1) * depth * 0.22,
        height: cabinet + 0.1 + 0.05 * (index % 4),
      });
    });
  }

  update(elapsed: number): void {
    const half = this.tankWidth / 2 - 0.08;
    for (const fish of this.fish) {
      // There and back along the tank, turning round at each end.
      const travel = (elapsed * fish.speed) / (2 * half) + fish.phase;
      const t = travel % 2;
      const forward = t < 1;
      const along = forward ? t : 2 - t;
      fish.body.position.set(
        -half + along * 2 * half,
        fish.height + 0.012 * Math.sin(elapsed * 1.7 + fish.phase),
        fish.depthLane,
      );
      fish.body.rotation.y = forward ? 0 : Math.PI;
    }
  }
}
