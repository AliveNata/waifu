import { VRMSpringBoneCollider, VRMSpringBoneColliderShapeCapsule } from "@pixiv/three-vrm";
import {
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  type MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  type Texture,
  TorusGeometry,
  Vector3,
} from "three";
import type { Furniture } from "../office-plan.js";
import { ArcadeScreen, RackLights, TvScreen } from "./animated.js";
import { box, glow, mesh, palette, standard, unlit } from "./palette.js";
import { kanbanTexture } from "./textures.js";

export interface BuiltPiece {
  root: Group;
  /** Spring bone colliders that keep long hair on the right side of backrests. */
  hairColliders: VRMSpringBoneCollider[];
}

/** Size of the piece in its own frame (front faces +z), from the plan's world-axis footprint. */
function localSize(piece: Furniture): { width: number; depth: number } {
  const sideways = Math.abs(Math.sin(piece.yaw)) > 0.5;
  return sideways ? { width: piece.depth, depth: piece.width } : { width: piece.width, depth: piece.depth };
}

function placed(piece: Furniture): Group {
  const root = new Group();
  root.position.set(piece.x, 0, piece.z);
  root.rotation.y = piece.yaw;
  return root;
}

/**
 * A capsule along a backrest's top edge, in the piece's frame. Hair that falls
 * behind the sitter drapes over it instead of slicing through the backrest.
 */
function backrestCollider(root: Group, width: number, y: number, z: number, radius: number): VRMSpringBoneCollider {
  const collider = new VRMSpringBoneCollider(
    new VRMSpringBoneColliderShapeCapsule({
      offset: new Vector3(-width / 2, 0, 0),
      tail: new Vector3(width / 2, 0, 0),
      radius,
    }),
  );
  collider.position.set(0, y, z);
  root.add(collider);
  return collider;
}

/** Gaming chair with a deliberately low back, so long chibi hair falls over it rather than through it. */
export function buildChair(piece: Furniture, seatHeight: number): BuiltPiece {
  const root = placed(piece);
  const ink = standard(palette.ink, 0.6);
  const seatThickness = 0.06;
  const backTop = seatHeight + 0.24;
  for (let spoke = 0; spoke < 5; spoke++) {
    const angle = (spoke / 5) * Math.PI * 2;
    const leg = box(0.03, 0.03, 0.24, ink, Math.sin(angle) * 0.1, 0.03, Math.cos(angle) * 0.1);
    leg.rotation.y = angle;
    root.add(leg);
  }
  const columnHeight = seatHeight - seatThickness - 0.05;
  const column = mesh(new CylinderGeometry(0.025, 0.025, columnHeight, 8), ink);
  column.position.y = 0.05 + columnHeight / 2;
  root.add(
    column,
    box(0.44, seatThickness, 0.42, ink, 0, seatHeight - seatThickness, 0),
    box(0.4, backTop - seatHeight, 0.06, ink, 0, seatHeight, -0.22),
    // Accent piping on the backrest: the one gaming cue on furniture people sit in all day.
    box(0.41, 0.02, 0.065, glow(palette.accent, 1.1), 0, backTop - 0.03, -0.22),
  );
  return { root, hairColliders: [backrestCollider(root, 0.4, backTop, -0.22, 0.045)] };
}

export function buildSofa(piece: Furniture, seatHeight: number): BuiltPiece {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const body = standard(palette.fabric, 0.95);
  const backTop = seatHeight + 0.22;
  root.add(
    box(width, seatHeight - 0.1, depth, body, 0, 0, 0),
    box(width, backTop, 0.18, body, 0, 0, -depth / 2 + 0.09),
    box(0.16, seatHeight + 0.1, depth, body, -width / 2 + 0.08, 0, 0),
    box(0.16, seatHeight + 0.1, depth, body, width / 2 - 0.08, 0, 0),
  );
  const cushionWidth = (width - 0.36) / 3;
  for (let seat = 0; seat < 3; seat++) {
    const x = -width / 2 + 0.18 + cushionWidth * (seat + 0.5);
    root.add(box(cushionWidth - 0.03, 0.1, depth - 0.24, standard(palette.cushion, 0.95), x, seatHeight - 0.1, 0.06));
  }
  return { root, hairColliders: [backrestCollider(root, width - 0.3, backTop, -depth / 2 + 0.09, 0.09)] };
}

export function buildBeanbag(piece: Furniture, tint: string): BuiltPiece {
  const root = placed(piece);
  const bag = mesh(new SphereGeometry(0.34, 16, 10), standard(tint, 1));
  bag.scale.set(1, 0.5, 1);
  bag.position.y = 0.16;
  const dent = mesh(new SphereGeometry(0.22, 12, 8), standard(tint, 1));
  dent.scale.set(1, 0.6, 0.8);
  dent.position.set(0, 0.25, -0.16);
  root.add(bag, dent);
  return { root, hairColliders: [] };
}

export function buildStool(piece: Furniture, seatHeight: number): BuiltPiece {
  const root = placed(piece);
  const ink = standard(palette.ink, 0.5);
  const leg = mesh(new CylinderGeometry(0.02, 0.02, seatHeight, 8), ink);
  leg.position.y = seatHeight / 2;
  const foot = mesh(new CylinderGeometry(0.14, 0.15, 0.02, 16), ink);
  foot.position.y = 0.01;
  const seat = mesh(new CylinderGeometry(0.16, 0.15, 0.05, 20), standard(palette.oak, 0.7));
  seat.position.y = seatHeight - 0.025;
  root.add(leg, foot, seat);
  return { root, hairColliders: [] };
}

export function buildBarTable(piece: Furniture): Group {
  const root = placed(piece);
  const ink = standard(palette.ink, 0.5);
  const post = mesh(new CylinderGeometry(0.04, 0.04, 0.95, 10), ink);
  post.position.y = 0.475;
  const top = mesh(new CylinderGeometry(0.32, 0.32, 0.04, 28), standard(palette.laminate, 0.5));
  top.position.y = 0.97;
  const base = mesh(new CylinderGeometry(0.22, 0.24, 0.03, 20), ink);
  base.position.y = 0.015;
  root.add(post, top, base, mug(0.1, 0.99, 0.05), mug(-0.12, 0.99, -0.06));
  return root;
}

function mug(x: number, y: number, z: number): Group {
  const group = new Group();
  const cup = mesh(new CylinderGeometry(0.035, 0.03, 0.08, 12), standard(palette.laminate, 0.4));
  cup.position.y = 0.04;
  const handle = mesh(new TorusGeometry(0.022, 0.007, 6, 12), standard(palette.laminate, 0.4));
  handle.position.set(0.04, 0.045, 0);
  group.add(cup, handle);
  group.position.set(x, y, z);
  return group;
}

/** Pantry counter with the coffee machine at its middle, where the "coffee" station stands. */
export function buildPantryCounter(piece: Furniture, coffeeX: number): Group {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const ink = standard(palette.ink, 0.6);
  root.add(
    box(width, 0.86, depth - 0.04, ink, 0, 0, 0),
    box(width + 0.02, 0.04, depth, standard(palette.laminate, 0.4), 0, 0.86, 0),
    box(width, 0.5, 0.02, standard(palette.backWall, 0.9), 0, 0.9, -depth / 2 + 0.01),
  );
  for (let door = 0; door < 4; door++) {
    root.add(
      box(
        0.02,
        0.6,
        0.01,
        standard(palette.inkSoft, 0.5),
        -width / 2 + (width / 4) * (door + 0.5),
        0.12,
        depth / 2 - 0.015,
      ),
    );
  }
  const machineX = coffeeX - piece.x;
  root.add(
    box(0.3, 0.42, 0.3, standard(palette.inkDeep, 0.35, 0.3), machineX, 0.9, -0.08),
    box(0.22, 0.04, 0.12, standard(palette.steel, 0.3, 0.6), machineX, 0.98, 0.05),
    box(0.06, 0.012, 0.012, glow(), machineX + 0.08, 1.22, 0.075),
    mug(machineX, 1.02, 0.04),
    mug(machineX + 0.6, 0.9, 0.05),
    mug(machineX + 0.72, 0.9, -0.04),
  );
  const kettle = mesh(new CylinderGeometry(0.07, 0.09, 0.2, 14), standard(palette.steel, 0.25, 0.7));
  kettle.position.set(machineX - 0.55, 1.0, -0.05);
  root.add(kettle);
  return root;
}

export function buildFridge(piece: Furniture): Group {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const body = standard(palette.steel, 0.35, 0.4);
  root.add(
    box(width, 1.75, depth, body, 0, 0, 0),
    box(width - 0.02, 0.012, 0.01, standard(palette.frame, 0.5), 0, 1.15, depth / 2),
    box(0.025, 0.4, 0.04, standard(palette.ink, 0.4), width / 2 - 0.1, 1.25, depth / 2 + 0.02),
    box(0.025, 0.3, 0.04, standard(palette.ink, 0.4), width / 2 - 0.1, 0.75, depth / 2 + 0.02),
  );
  return root;
}

export function buildServerRack(piece: Furniture): { root: Group; lights: RackLights } {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  root.add(box(width, 1.85, depth, standard(palette.inkDeep, 0.5, 0.2), 0, 0, 0));
  const lights: { mesh: ReturnType<typeof box>; material: MeshStandardMaterial }[] = [];
  for (let unit = 0; unit < 7; unit++) {
    const y = 0.2 + unit * 0.22;
    root.add(box(width - 0.08, 0.16, 0.02, standard(palette.ink, 0.4, 0.3), 0, y, depth / 2));
    for (let led = 0; led < 3; led++) {
      // Status lights: the accent for activity, white for link, the colors gear actually uses.
      const material = glow(led === 0 ? "#ffffff" : palette.accent, 1.5);
      const light = box(0.025, 0.02, 0.01, material, -width / 2 + 0.1 + led * 0.05, y + 0.07, depth / 2 + 0.012);
      root.add(light);
      lights.push({ mesh: light, material });
    }
  }
  return { root, lights: new RackLights(lights) };
}

export function buildArcade(piece: Furniture): { root: Group; screen: ArcadeScreen } {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const body = standard(palette.ink, 0.55);
  const screen = new ArcadeScreen();
  root.add(
    box(width, 1.0, depth, body, 0, 0, 0),
    box(width, 0.75, depth * 0.55, body, 0, 1.0, -depth * 0.22),
    box(width, 0.22, depth * 0.6, body, 0, 1.75, -depth * 0.2),
    // Marquee: the brightest accent in the room, the arcade's whole reason to exist is to call you over.
    box(width - 0.06, 0.14, 0.02, glow(palette.accent, 2), 0, 1.79, depth * 0.11),
    box(width, 0.06, depth * 0.45, standard(palette.inkSoft, 0.5), 0, 0.98, depth * 0.27),
  );
  const display = mesh(new PlaneGeometry(width - 0.16, 0.5), unlit(screen.texture), false);
  display.position.set(0, 1.4, depth * 0.06);
  display.rotation.x = -0.18;
  root.add(display);
  const stick = mesh(new CylinderGeometry(0.01, 0.01, 0.08, 6), standard(palette.ink, 0.4));
  stick.position.set(-0.15, 1.08, depth * 0.3);
  const knob = mesh(new SphereGeometry(0.025, 10, 8), glow(palette.accent, 0.8));
  knob.position.set(-0.15, 1.13, depth * 0.3);
  root.add(stick, knob);
  for (let button = 0; button < 3; button++) {
    const cap = mesh(
      new CylinderGeometry(0.02, 0.02, 0.015, 12),
      standard(button === 0 ? palette.accent : palette.laminate, 0.4),
    );
    cap.position.set(0.05 + button * 0.07, 1.05, depth * 0.3);
    root.add(cap);
  }
  return { root, screen };
}

export function buildTvWall(piece: Furniture): { root: Group; screen: TvScreen } {
  const root = placed(piece);
  const { width } = localSize(piece);
  const screen = new TvScreen();
  root.add(box(width, 0.9, 0.05, standard(palette.inkDeep, 0.3, 0.2), 0, 0.85, 0));
  const display = mesh(new PlaneGeometry(width - 0.08, 0.82), unlit(screen.texture), false);
  display.position.set(0, 1.3, 0.03);
  root.add(display);
  return { root, screen };
}

export function buildTvConsole(piece: Furniture): Group {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  root.add(
    box(width, 0.38, depth, standard(palette.oak, 0.7), 0, 0, 0),
    box(width - 0.04, 0.015, 0.01, glow(), 0, 0.05, depth / 2 + 0.005),
    box(0.3, 0.07, 0.22, standard(palette.inkDeep, 0.3, 0.2), -0.3, 0.38, 0),
    box(0.012, 0.012, 0.01, glow(), -0.2, 0.42, 0.111),
  );
  return root;
}

export function buildRug(piece: Furniture): Group {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const rug = box(width, 0.012, depth, standard(palette.rug, 1), 0, 0, 0);
  rug.castShadow = false;
  const border = box(width - 0.2, 0.013, depth - 0.2, standard("#cfc5b6", 1), 0, 0, 0);
  border.castShadow = false;
  root.add(rug, border);
  return root;
}

export function buildCoffeeTable(piece: Furniture): Group {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  root.add(
    box(width, 0.04, depth, standard(palette.oak, 0.6), 0, 0.3, 0),
    box(0.04, 0.3, 0.04, standard(palette.ink, 0.5), -width / 2 + 0.06, 0, -depth / 2 + 0.06),
    box(0.04, 0.3, 0.04, standard(palette.ink, 0.5), width / 2 - 0.06, 0, -depth / 2 + 0.06),
    box(0.04, 0.3, 0.04, standard(palette.ink, 0.5), -width / 2 + 0.06, 0, depth / 2 - 0.06),
    box(0.04, 0.3, 0.04, standard(palette.ink, 0.5), width / 2 - 0.06, 0, depth / 2 - 0.06),
    mug(0.1, 0.34, 0.15),
    box(0.16, 0.03, 0.08, standard(palette.inkDeep, 0.4), -0.1, 0.34, -0.15),
  );
  return root;
}

/** Potted plant: a ceramic pot and a loose cluster of leaves, sized from the footprint. */
export function buildPlant(piece: Furniture): Group {
  const root = placed(piece);
  const radius = Math.min(piece.width, piece.depth) / 2;
  const potHeight = radius * 1.3;
  const pot = mesh(new CylinderGeometry(radius * 0.8, radius * 0.62, potHeight, 16), standard(palette.pot, 0.6));
  pot.position.y = potHeight / 2;
  const band = mesh(new CylinderGeometry(radius * 0.81, radius * 0.81, 0.03, 16), standard(palette.ink, 0.5));
  band.position.y = potHeight * 0.8;
  root.add(pot, band);
  const leaves = [palette.leaf, palette.leafDark];
  const count = Math.round(5 + radius * 10);
  for (let leaf = 0; leaf < count; leaf++) {
    const angle = leaf * 2.4;
    const height = potHeight + 0.15 + (leaf % 4) * radius * 0.45;
    const spread = radius * (0.35 + (leaf % 3) * 0.25);
    const blob = mesh(
      new IcosahedronGeometry(radius * (0.5 + (leaf % 2) * 0.15), 0),
      standard(leaves[leaf % 2] as string, 0.9),
    );
    blob.scale.set(1, 0.7, 1.3);
    blob.position.set(Math.cos(angle) * spread, height, Math.sin(angle) * spread);
    blob.rotation.set(leaf * 0.7, angle, leaf * 0.3);
    root.add(blob);
  }
  return root;
}

export function buildKanban(piece: Furniture): Group {
  const root = placed(piece);
  const { width } = localSize(piece);
  const ink = standard(palette.ink, 0.5);
  root.add(
    box(0.04, 1.15, 0.04, ink, -width / 2 + 0.05, 0, 0),
    box(0.04, 1.15, 0.04, ink, width / 2 - 0.05, 0, 0),
    box(0.26, 0.03, 0.26, ink, -width / 2 + 0.05, 0, 0),
    box(0.26, 0.03, 0.26, ink, width / 2 - 0.05, 0, 0),
    box(width, 0.78, 0.03, standard(palette.frame, 0.5), 0, 0.42, 0),
  );
  const board = mesh(new PlaneGeometry(width - 0.06, 0.72), unlit(kanbanTexture()), false);
  board.position.set(0, 0.81, 0.02);
  root.add(board);
  return root;
}

export function buildRingLight(piece: Furniture): Group {
  const root = placed(piece);
  const ink = standard(palette.ink, 0.5);
  root.add(box(0.26, 0.02, 0.26, ink, 0, 0, 0), box(0.025, 1.2, 0.025, ink, 0, 0, 0));
  // Warm white, not the accent: a ring light's job is lighting faces.
  const ring = mesh(new TorusGeometry(0.17, 0.022, 8, 32), glow("#fff3e6", 1.2));
  ring.position.y = 1.32;
  root.add(ring);
  return root;
}

export function buildCameraTripod(piece: Furniture): Group {
  const root = placed(piece);
  const ink = standard(palette.ink, 0.5);
  const head = new Vector3(0, 0.95, 0);
  const up = new Vector3(0, 1, 0);
  for (let leg = 0; leg < 3; leg++) {
    const angle = (leg / 3) * Math.PI * 2;
    const foot = new Vector3(Math.sin(angle) * 0.22, 0, Math.cos(angle) * 0.22);
    const length = head.distanceTo(foot);
    const rod = mesh(new CylinderGeometry(0.008, 0.008, length, 6), ink);
    rod.position.copy(head).add(foot).multiplyScalar(0.5);
    rod.quaternion.setFromUnitVectors(up, new Vector3().subVectors(head, foot).normalize());
    root.add(rod);
  }
  const body = box(0.16, 0.1, 0.09, standard(palette.inkDeep, 0.4), 0, 1.0, 0);
  const lens = mesh(new CylinderGeometry(0.035, 0.035, 0.08, 14), standard(palette.ink, 0.3, 0.4));
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 1.05, 0.08);
  const tally = box(0.015, 0.015, 0.01, glow(palette.accent, 1.8), 0.06, 1.08, 0.046);
  root.add(body, lens, tally);
  return root;
}

/** Ruby's brand wall: the AlyxLabs logo behind her, the same mark as the wall sign, so the room has one motif. */
export function buildBackdrop(piece: Furniture, logo: Texture): Group {
  const root = placed(piece);
  const { width } = localSize(piece);
  const ink = standard(palette.inkDeep, 0.7);
  root.add(box(width, 1.7, 0.06, ink, 0, 0, 0), box(width, 0.02, 0.07, glow(), 0, 1.68, 0));
  const mark = mesh(new PlaneGeometry(0.55, 0.55), unlit(logo, true), false);
  mark.position.set(0, 1.2, 0.035);
  root.add(mark);
  return root;
}
