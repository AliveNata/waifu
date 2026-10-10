import { BoxGeometry, CylinderGeometry, Group, type Object3D, TorusGeometry, Vector3 } from "three";
import type { HandPropKind } from "../office-director.js";
import { box, glow, mesh, palette, standard } from "./palette.js";

/**
 * Small objects a chibi holds in the right hand. Each is built around its grip point
 * (the origin), facing +z like the avatar, and sized for chibi hands.
 */
function buildProp(kind: HandPropKind): Group {
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
};

const handPosition = new Vector3();

/** One member's hand props: shows at most one, kept upright and turned with the body. */
export class HandProps {
  readonly root = new Group();
  private readonly built = new Map<HandPropKind, Group>();
  private shown: HandPropKind | null = null;

  show(kind: HandPropKind | null): void {
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
      prop = buildProp(kind);
      this.built.set(kind, prop);
      this.root.add(prop);
    }
    prop.visible = true;
  }

  /** Follows the hand bone. Only the bone's position is used, so props never inherit odd wrist rolls. */
  follow(hand: Object3D | null, yaw: number): void {
    if (this.shown === null || hand === null) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    hand.getWorldPosition(handPosition);
    const offset = gripOffset[this.shown];
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
