import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  type Object3D,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import type { ArmSide } from "../avatar.js";
import type { HandPropKind } from "../office-director.js";
import { box, glow, mesh, palette, standard } from "./palette.js";

/**
 * Small objects a chibi holds in a hand. Each is built around its grip point (the origin), facing
 * +z like the avatar, and sized for chibi hands. Desks use the same models for the things that
 * get picked up, so what lands in the hand is what was on the desk.
 */
export function handPropModel(kind: HandPropKind): Group {
  const group = new Group();
  switch (kind) {
    case "mug": {
      const material = standard(palette.laminate, 0.4);
      const cup = mesh(new CylinderGeometry(0.022, 0.019, 0.05, 12), material);
      cup.position.y = 0.01;
      const handle = mesh(new TorusGeometry(0.012, 0.0035, 6, 12), material);
      handle.position.set(-0.025, 0.012, 0);
      const coffee = mesh(new CylinderGeometry(0.019, 0.019, 0.002, 12), standard("#5a3a24", 0.3));
      coffee.position.y = 0.032;
      group.add(cup, handle, coffee);
      break;
    }
    case "paddle": {
      const blade = mesh(new CylinderGeometry(0.045, 0.045, 0.008, 20), standard("#c8323c", 0.6));
      blade.rotation.x = Math.PI / 2;
      blade.position.y = 0.07;
      group.add(blade, box(0.016, 0.05, 0.012, standard(palette.oak, 0.7), 0, -0.01, 0));
      break;
    }
    case "phone": {
      group.add(
        box(0.035, 0.065, 0.006, standard(palette.inkDeep, 0.3, 0.3), 0, 0, 0),
        box(0.03, 0.056, 0.001, glow("#cfe3ff", 0.9), 0, 0.0045, 0.0035),
      );
      break;
    }
    case "book": {
      // Open book: two tilted pages and a cover, held in front of the chest.
      const cover = standard("#3f5fa8", 0.7);
      const pages = standard("#f7f3ea", 0.9);
      const left = new Group();
      left.add(mesh(new BoxGeometry(0.055, 0.075, 0.004), cover), box(0.05, 0.07, 0.003, pages, 0, -0.035, 0.003));
      left.position.set(-0.028, 0, 0);
      left.rotation.y = 0.35;
      const right = left.clone();
      right.position.x = 0.028;
      right.rotation.y = -0.35;
      group.add(left, right);
      group.rotation.x = -0.6;
      break;
    }
    case "can": {
      const metal = standard("#5b8c4a", 0.5, 0.2);
      const body = mesh(new CylinderGeometry(0.03, 0.034, 0.06, 14), metal);
      body.position.set(0, -0.03, 0.02);
      const spout = mesh(new CylinderGeometry(0.005, 0.008, 0.08, 8), metal);
      spout.rotation.x = Math.PI / 2 - 0.5;
      spout.position.set(0, -0.015, 0.075);
      const grip = mesh(new TorusGeometry(0.02, 0.004, 6, 12, Math.PI), metal);
      grip.rotation.y = Math.PI / 2;
      grip.position.set(0, 0.0, 0.02);
      group.add(body, spout, grip);
      break;
    }
    case "plate": {
      // A warmed-up plate: a white dish with a slice of something on it, carried flat.
      const dish = mesh(new CylinderGeometry(0.05, 0.042, 0.008, 20), standard("#fbfaf7", 0.4));
      const food = box(0.04, 0.02, 0.03, standard("#d9a05b", 0.7), 0, 0.004, 0);
      group.add(dish, food);
      break;
    }
    case "duck": {
      const yellow = standard("#f2c94c", 0.6);
      const body = mesh(new SphereGeometry(0.022, 12, 10), yellow);
      body.scale.set(1, 0.8, 1.2);
      const head = mesh(new SphereGeometry(0.014, 10, 8), yellow);
      head.position.set(0, 0.022, 0.014);
      const beak = box(0.012, 0.005, 0.012, standard("#e8833a", 0.5), 0, 0.018, 0.03);
      group.add(body, head, beak);
      break;
    }
    case "console": {
      // A handheld held level in both hands, screen up toward the face.
      group.add(
        box(0.14, 0.012, 0.075, standard("#121214", 0.3), 0, 0, 0),
        box(0.1, 0.002, 0.058, glow("#bfe0ff", 0.9), 0, 0.012, 0),
        box(0.022, 0.014, 0.075, standard("#e0453a", 0.5), -0.081, 0, 0),
        box(0.022, 0.014, 0.075, standard("#2f8fd8", 0.5), 0.081, 0, 0),
      );
      break;
    }
    case "plush": {
      const body = mesh(new SphereGeometry(0.045, 12, 10), standard("#9fd6b4", 0.9));
      body.scale.set(1, 0.85, 1.1);
      const horn = mesh(new CylinderGeometry(0.003, 0.009, 0.03, 6), standard(palette.laminate, 0.6));
      horn.position.set(0.02, 0.045, 0.008);
      const hornLeft = horn.clone();
      hornLeft.position.x = -0.02;
      group.add(body, horn, hornLeft);
      break;
    }
    case "fork": {
      const steel = standard("#c9ccd2", 0.25, 0.8);
      const handle = box(0.006, 0.07, 0.003, steel, 0, -0.02, 0);
      const tines = box(0.012, 0.022, 0.002, steel, 0, 0.05, 0);
      const bite = box(0.012, 0.01, 0.01, standard("#f6efe4", 0.8), 0, 0.06, 0.004);
      bite.name = "bite";
      group.add(handle, tines, bite);
      break;
    }
    case "rose": {
      const stem = mesh(new CylinderGeometry(0.003, 0.003, 0.1, 6), standard(palette.leafDark, 0.8));
      stem.position.y = 0.02;
      const bloom = mesh(new IcosahedronGeometry(0.018, 1), standard("#b3262f", 0.7));
      bloom.position.y = 0.075;
      group.add(stem, bloom);
      break;
    }
    case "teacup": {
      const china = standard("#f7f1ea", 0.3);
      const cup = mesh(new CylinderGeometry(0.024, 0.016, 0.03, 14), china);
      const rim = mesh(new TorusGeometry(0.024, 0.0018, 6, 18), standard("#c9a24a", 0.3, 0.6));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.015;
      const tea = mesh(new CylinderGeometry(0.022, 0.022, 0.002, 14), standard("#9a5a2a", 0.2));
      tea.position.y = 0.012;
      const handle = mesh(new TorusGeometry(0.009, 0.0025, 6, 10), china);
      handle.position.set(-0.026, 0.002, 0);
      group.add(cup, rim, tea, handle);
      break;
    }
    case "marker": {
      const barrel = mesh(new CylinderGeometry(0.006, 0.006, 0.09, 8), standard("#f4efe6", 0.6));
      const cap = mesh(new CylinderGeometry(0.0065, 0.0065, 0.025, 8), standard("#e8833a", 0.5));
      cap.position.y = 0.045;
      group.add(barrel, cap);
      // Held like a pen: the writing tip down and forward.
      group.rotation.x = 0.7;
      break;
    }
    case "controller": {
      const shell = standard("#26222e", 0.5);
      group.add(
        box(0.07, 0.016, 0.035, shell, 0, -0.008, 0),
        box(0.008, 0.004, 0.008, glow("#8fd1ff", 1.2), 0.018, 0.008, 0.004),
        box(0.008, 0.004, 0.008, glow(palette.accent, 1.2), -0.018, 0.008, 0.004),
      );
      break;
    }
  }
  return group;
}

/** Where the prop sits relative to the hand, in the avatar's own frame (x right, z forward). */
const gripOffset: Record<HandPropKind, { x: number; y: number; z: number; tilt: number; turn: number }> = {
  mug: { x: 0, y: -0.015, z: 0.015, tilt: 0, turn: 0 },
  paddle: { x: 0, y: 0, z: 0.01, tilt: -0.3, turn: 0 },
  // Screen turned back toward the face.
  phone: { x: 0, y: 0.01, z: 0.01, tilt: 0.4, turn: Math.PI },
  // Both hands hold the book, so it sits between them, left of the right hand.
  book: { x: -0.045, y: 0.01, z: 0.03, tilt: 0, turn: Math.PI },
  can: { x: 0, y: -0.01, z: 0.01, tilt: 0.35, turn: 0 },
  controller: { x: -0.04, y: 0, z: 0.03, tilt: 0.3, turn: 0 },
  // Flat on the palm, held out in front.
  plate: { x: -0.02, y: 0.012, z: 0.04, tilt: 0, turn: 0 },
  duck: { x: 0, y: 0.01, z: 0.02, tilt: 0, turn: 0 },
  // Between both hands, tipped so the screen faces up at the eyes. Positive x is toward the
  // avatar's left (it faces +z with its left on +x), so this sits inward of the right hand.
  console: { x: 0.06, y: 0.01, z: 0.03, tilt: 0.5, turn: 0 },
  // Hugged to the chest, inward of the hand that holds it.
  plush: { x: 0.06, y: 0.01, z: 0.04, tilt: 0, turn: 0 },
  fork: { x: 0, y: 0.01, z: 0.01, tilt: -0.4, turn: 0 },
  rose: { x: 0, y: 0, z: 0.01, tilt: -0.2, turn: 0 },
  teacup: { x: 0, y: -0.01, z: 0.015, tilt: 0, turn: 0 },
  marker: { x: 0, y: 0, z: 0.01, tilt: 0, turn: 0 },
};

const handPosition = new Vector3();

/** One member's hand props: shows at most one, kept upright and turned with the body. */
export class HandProps {
  readonly root = new Group();
  private readonly built = new Map<HandPropKind, Group>();
  private shown: HandPropKind | null = null;
  private side: ArmSide = "right";

  /** Most props are held in the right hand; a few desk things are picked up with the left. */
  show(kind: HandPropKind | null, side: ArmSide = "right"): void {
    this.side = side;
    if (kind === this.shown) {
      return;
    }
    if (this.shown !== null) {
      (this.built.get(this.shown) as Group).visible = false;
    }
    this.shown = kind;
    if (kind === null) {
      return;
    }
    let prop = this.built.get(kind);
    if (prop === undefined) {
      prop = handPropModel(kind);
      this.built.set(kind, prop);
      this.root.add(prop);
    }
    prop.visible = true;
  }

  /** Follows the hand bone. Only the bone's position is used, so props never inherit odd wrist rolls. */
  follow(hands: Record<ArmSide, Object3D | null>, yaw: number): void {
    const hand = hands[this.side];
    if (this.shown === null || hand === null) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    hand.getWorldPosition(handPosition);
    const grip = gripOffset[this.shown];
    // Offsets are written for the right hand; the left hand holds things mirrored.
    const offset = this.side === "right" ? grip : { ...grip, x: -grip.x };
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    this.root.position.set(
      handPosition.x + offset.x * cos + offset.z * sin,
      handPosition.y + offset.y,
      handPosition.z - offset.x * sin + offset.z * cos,
    );
    this.root.rotation.set(offset.tilt, yaw + offset.turn, 0, "YXZ");
  }

  dispose(): void {
    this.root.removeFromParent();
  }
}
