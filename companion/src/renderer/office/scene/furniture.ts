import {
  VRMSpringBoneCollider,
  VRMSpringBoneColliderShapeCapsule,
  VRMSpringBoneColliderShapeSphere,
} from "@pixiv/three-vrm";
import {
  CylinderGeometry,
  Group,
  type MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  type Texture,
  TorusGeometry,
  Vector3,
} from "three";
import { chibi, type Furniture, surface } from "../office-plan.js";
import { ArcadeScreen, LaptopScreen, RackLights, TvScreen } from "./animated.js";
import { box, glow, mesh, palette, printed, standard, unlit } from "./palette.js";
import { leafyCrown } from "./plant.js";
import { kanbanTexture, type SignLettering } from "./textures.js";

export interface BuiltPiece {
  root: Group;
  /** Spring bone colliders that keep long hair outside seats and backrests. */
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
function capsuleCollider(root: Group, width: number, y: number, z: number, radius: number): VRMSpringBoneCollider {
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

/**
 * Capsules stacked from `bottom` to `top`, overlapping so no strand slips between them: the
 * whole face of a backrest or seat, not just its top edge. Long hair falling behind a sitter
 * otherwise drapes over the top capsule and then sinks straight through the panel below it.
 */
function panelColliders(
  root: Group,
  width: number,
  z: number,
  bottom: number,
  top: number,
  radius: number,
): VRMSpringBoneCollider[] {
  const rows = Math.max(1, Math.ceil((top - bottom) / (radius * 1.5)));
  return Array.from({ length: rows + 1 }, (_, row) =>
    capsuleCollider(root, width, bottom + ((top - bottom) * row) / rows, z, radius),
  );
}

/** The top of a seat cushion as a row of capsules front to back, so hair rests on it. */
function seatColliders(root: Group, width: number, y: number, front: number, back: number, radius: number) {
  const rows = Math.max(1, Math.ceil((front - back) / (radius * 1.5)));
  return Array.from({ length: rows + 1 }, (_, row) =>
    capsuleCollider(root, width, y, back + ((front - back) * row) / rows, radius),
  );
}

/** A sphere standing in for a rounded seat or cushion, so hair slides off it. */
function sphereCollider(root: Group, x: number, y: number, z: number, radius: number): VRMSpringBoneCollider {
  const collider = new VRMSpringBoneCollider(new VRMSpringBoneColliderShapeSphere({ radius }));
  collider.position.set(x, y, z);
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
    const leg = box(0.03, 0.03, 0.22, ink, Math.sin(angle) * 0.09, 0.02, Math.cos(angle) * 0.09);
    leg.rotation.y = angle;
    root.add(leg);
  }
  const columnHeight = seatHeight - seatThickness - 0.05;
  const column = mesh(new CylinderGeometry(0.022, 0.022, columnHeight, 8), ink);
  column.position.y = 0.05 + columnHeight / 2;
  root.add(
    column,
    box(0.4, seatThickness, 0.38, ink, 0, seatHeight - seatThickness, 0),
    box(0.36, backTop - seatHeight, 0.05, ink, 0, seatHeight, -0.2),
    // Accent piping on the backrest: the one gaming cue on furniture people sit in all day.
    box(0.37, 0.018, 0.055, glow(palette.accent, 1.1), 0, backTop - 0.03, -0.2),
  );
  return {
    root,
    hairColliders: [
      ...panelColliders(root, 0.36, -0.2, seatHeight + 0.02, backTop, 0.04),
      ...seatColliders(root, 0.36, seatHeight - 0.03, 0.14, -0.14, 0.035),
    ],
  };
}

export function buildSofa(piece: Furniture, seatHeight: number): BuiltPiece {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const body = standard(palette.fabric, 0.95);
  const backTop = seatHeight + 0.22;
  root.add(
    box(width, seatHeight - 0.08, depth, body, 0, 0, 0),
    box(width, backTop, 0.16, body, 0, 0, -depth / 2 + 0.08),
    box(0.14, seatHeight + 0.09, depth, body, -width / 2 + 0.07, 0, 0),
    box(0.14, seatHeight + 0.09, depth, body, width / 2 - 0.07, 0, 0),
  );
  const cushionWidth = (width - 0.32) / 3;
  for (let seat = 0; seat < 3; seat++) {
    const x = -width / 2 + 0.16 + cushionWidth * (seat + 0.5);
    root.add(box(cushionWidth - 0.03, 0.08, depth - 0.2, standard(palette.cushion, 0.95), x, seatHeight - 0.08, 0.05));
  }
  return {
    root,
    hairColliders: [
      ...panelColliders(root, width - 0.28, -depth / 2 + 0.08, seatHeight, backTop, 0.08),
      ...seatColliders(root, width - 0.28, seatHeight - 0.05, depth / 2 - 0.1, -depth / 2 + 0.2, 0.05),
    ],
  };
}

/**
 * Beanbag with a sunken seat and a raised back. The cushion surface is the station's seat
 * height, so a sitter rests on it; the back bump carries a collider so hair drapes over it.
 */
export function buildBeanbag(piece: Furniture, tint: string, seatHeight: number): BuiltPiece {
  const root = placed(piece);
  const material = standard(tint, 1);
  const base = mesh(new SphereGeometry(0.34, 18, 10), material);
  base.scale.set(1, seatHeight / 0.34, 1);
  base.position.y = seatHeight / 2;
  const back = mesh(new SphereGeometry(0.26, 16, 10), material);
  back.scale.set(1.05, 0.9, 0.55);
  back.position.set(0, seatHeight + 0.1, -0.2);
  root.add(base, back);
  return { root, hairColliders: [sphereCollider(root, 0, seatHeight + 0.1, -0.2, 0.17)] };
}

export function buildStool(piece: Furniture, seatHeight: number): BuiltPiece {
  const root = placed(piece);
  const ink = standard(palette.ink, 0.5);
  const leg = mesh(new CylinderGeometry(0.018, 0.018, seatHeight, 8), ink);
  leg.position.y = seatHeight / 2;
  const foot = mesh(new CylinderGeometry(0.12, 0.13, 0.02, 16), ink);
  foot.position.y = 0.01;
  const ring = mesh(new TorusGeometry(0.09, 0.008, 6, 20), ink);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = seatHeight * 0.45;
  const seat = mesh(new CylinderGeometry(0.15, 0.14, 0.045, 20), standard(palette.oak, 0.7));
  seat.position.y = seatHeight - 0.0225;
  root.add(leg, foot, ring, seat);
  // A sphere just under the round seat: hair hanging behind the sitter slides around the stool,
  // and a flat one in the seat itself so tips resting on it stay on top.
  return {
    root,
    hairColliders: [
      sphereCollider(root, 0, seatHeight - 0.15, 0, 0.16),
      ...seatColliders(root, 0.24, seatHeight - 0.03, 0.08, -0.08, 0.035),
    ],
  };
}

export function buildBarTable(piece: Furniture): Group {
  const root = placed(piece);
  const ink = standard(palette.ink, 0.5);
  const top = surface.barTable;
  const post = mesh(new CylinderGeometry(0.035, 0.035, top - 0.04, 10), ink);
  post.position.y = (top - 0.04) / 2;
  const tabletop = mesh(new CylinderGeometry(0.3, 0.3, 0.035, 28), standard(palette.laminate, 0.5));
  tabletop.position.y = top - 0.0175;
  const base = mesh(new CylinderGeometry(0.2, 0.22, 0.025, 20), ink);
  base.position.y = 0.0125;
  root.add(post, tabletop, base, mug(0.1, top, 0.05), mug(-0.12, top, -0.06));
  return root;
}

/** A coffee mug sized for chibi hands. */
export function mug(x = 0, y = 0, z = 0): Group {
  const group = new Group();
  const material = standard(palette.laminate, 0.4);
  const cup = mesh(new CylinderGeometry(0.028, 0.024, 0.06, 12), material);
  cup.position.y = 0.03;
  const handle = mesh(new TorusGeometry(0.017, 0.006, 6, 12), material);
  handle.position.set(0.032, 0.033, 0);
  const coffee = mesh(new CylinderGeometry(0.024, 0.024, 0.004, 12), standard("#5b3a22", 0.4));
  coffee.position.y = 0.056;
  group.add(cup, handle, coffee);
  group.position.set(x, y, z);
  return group;
}

/** Pantry counter at chibi working height, with the coffee machine where the "coffee" station stands. */
export function buildPantryCounter(piece: Furniture, coffeeX: number): Group {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const ink = standard(palette.ink, 0.6);
  const top = surface.counter;
  root.add(
    box(width, top - 0.03, depth - 0.04, ink, 0, 0, 0),
    box(width + 0.02, 0.03, depth, standard(palette.laminate, 0.4), 0, top - 0.03, 0),
    box(width, 0.36, 0.02, standard(palette.backWall, 0.9), 0, top, -depth / 2 + 0.01),
    // Open shelf above the counter with mugs and jars, within a chibi's reach.
    box(width * 0.8, 0.025, 0.18, standard(palette.oak, 0.6), 0, top + 0.42, -depth / 2 + 0.1),
  );
  for (let door = 0; door < 4; door++) {
    root.add(
      box(
        0.015,
        top * 0.6,
        0.01,
        standard(palette.inkSoft, 0.5),
        -width / 2 + (width / 4) * (door + 0.5),
        0.08,
        depth / 2 - 0.015,
      ),
    );
  }
  const machineX = coffeeX - piece.x;
  root.add(
    box(0.22, 0.28, 0.22, standard(palette.inkDeep, 0.35, 0.3), machineX, top, -0.08),
    box(0.16, 0.025, 0.09, standard(palette.steel, 0.3, 0.6), machineX, top + 0.04, 0.05),
    box(0.05, 0.01, 0.01, glow(), machineX + 0.06, top + 0.24, 0.031),
    mug(machineX, top + 0.065, 0.04),
    mug(machineX + 0.55, top, 0.05),
    mug(machineX + 0.65, top, -0.04),
  );
  for (let jar = 0; jar < 4; jar++) {
    const glass = mesh(new CylinderGeometry(0.035, 0.035, 0.1, 12), standard(palette.glass, 0.15));
    glass.position.set(-width * 0.3 + jar * 0.14, top + 0.495, -depth / 2 + 0.1);
    root.add(glass);
  }
  const kettle = mesh(new CylinderGeometry(0.05, 0.065, 0.14, 14), standard(palette.steel, 0.25, 0.7));
  kettle.position.set(machineX - 0.5, top + 0.07, -0.05);
  root.add(kettle);
  return root;
}

/** How far the fridge door swings: short of 90 degrees, since the hinge side is right by the wall. */
const fridgeOpenAngle = 1.45;
/** Radians per second at full speed; the door eases out and in around that. */
const fridgeSwingRate = 5;

/** The fridge's main door on its hinge. The stage opens it while someone grabs a snack. */
export class FridgeDoor {
  private angle = 0;

  constructor(private readonly hinge: Group) {}

  update(open: boolean, delta: number): void {
    const target = open ? fridgeOpenAngle : 0;
    const step = Math.min(1, fridgeSwingRate * delta);
    this.angle += (target - this.angle) * step;
    // Negative yaw swings a door hinged on its left edge outward, toward the person in front.
    this.hinge.rotation.y = -this.angle;
  }
}

export function buildFridge(piece: Furniture): { root: Group; door: FridgeDoor } {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const body = standard(palette.steel, 0.35, 0.4);
  const height = 1.1;
  const split = height * 0.66;
  const front = (depth - 0.06) / 2;
  root.add(
    box(width - 0.06, height, depth - 0.06, body, 0, 0, 0),
    box(width - 0.08, 0.01, 0.01, standard(palette.frame, 0.5), 0, split, front + 0.02),
    box(0.02, 0.22, 0.03, standard(palette.ink, 0.4), width / 2 - 0.1, height * 0.72, front + 0.01),
  );
  // Behind the door: a lit inside with two shelves and a few drinks, only seen while it is open.
  const inside = width - 0.14;
  root.add(
    box(inside, split - 0.1, 0.004, glow("#eef6ff", 0.8), 0, 0.06, front + 0.002),
    box(inside, 0.012, 0.02, standard("#ffffff", 0.6), 0, 0.24, front + 0.01),
    box(inside, 0.012, 0.02, standard("#ffffff", 0.6), 0, 0.46, front + 0.01),
  );
  for (const [x, color] of [
    [-0.14, palette.accent],
    [-0.02, "#e9c46a"],
    [0.1, "#8fbf9f"],
  ] as const) {
    // Flat stand-ins for drinks: they have to fit in the gap the closed door leaves.
    root.add(box(0.05, 0.1, 0.016, standard(color, 0.45), x, 0.252, front + 0.009));
  }
  const doorWidth = width - 0.06;
  const hinge = new Group();
  hinge.position.set(-doorWidth / 2, 0, front);
  hinge.add(
    box(doorWidth, split - 0.01, 0.025, body, doorWidth / 2, 0.005, 0.0125),
    box(0.02, 0.18, 0.03, standard(palette.ink, 0.4), doorWidth - 0.07, height * 0.38, 0.035),
  );
  root.add(hinge);
  return { root, door: new FridgeDoor(hinge) };
}

/** A compact rack, chest-to-head height for a chibi: Yor checks the lights at eye level. */
export function buildServerRack(piece: Furniture): { root: Group; lights: RackLights } {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const height = 1.15;
  root.add(box(width - 0.1, height, depth - 0.1, standard(palette.inkDeep, 0.5, 0.2), 0, 0, 0));
  const lights: { mesh: ReturnType<typeof box>; material: MeshStandardMaterial }[] = [];
  const front = (depth - 0.1) / 2;
  for (let unit = 0; unit < 5; unit++) {
    const y = 0.14 + unit * 0.19;
    root.add(box(width - 0.16, 0.14, 0.02, standard(palette.ink, 0.4, 0.3), 0, y, front));
    for (let led = 0; led < 3; led++) {
      // Status lights: the accent for activity, white for link, the colors gear actually uses.
      const material = glow(led === 0 ? "#ffffff" : palette.accent, 1.5);
      const light = box(0.02, 0.016, 0.01, material, -width / 2 + 0.13 + led * 0.04, y + 0.06, front + 0.012);
      root.add(light);
      lights.push({ mesh: light, material });
    }
  }
  return { root, lights: new RackLights(lights) };
}

/** Arcade cabinet at chibi scale: controls at hand height, screen at eye height. */
export function buildArcade(piece: Furniture): { root: Group; screen: ArcadeScreen } {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const body = standard(palette.ink, 0.55);
  const screen = new ArcadeScreen();
  const cabinetWidth = width - 0.16;
  const panelTop = 0.56;
  root.add(
    box(cabinetWidth, panelTop, depth * 0.7, body, 0, 0, -depth * 0.05),
    box(cabinetWidth, 0.44, depth * 0.45, body, 0, panelTop, -depth * 0.18),
    box(cabinetWidth, 0.14, depth * 0.5, body, 0, panelTop + 0.44, -depth * 0.15),
    // Marquee: the brightest accent in the room, the arcade's whole reason to exist is to call you over.
    box(cabinetWidth - 0.04, 0.09, 0.02, glow(palette.accent, 2), 0, panelTop + 0.465, depth * 0.1),
    box(cabinetWidth, 0.04, depth * 0.36, standard(palette.inkSoft, 0.5), 0, panelTop - 0.02, depth * 0.24),
  );
  const display = mesh(new PlaneGeometry(cabinetWidth - 0.1, 0.34), unlit(screen.texture), false);
  display.position.set(0, panelTop + 0.23, depth * 0.05);
  display.rotation.x = -0.18;
  root.add(display);
  const stick = mesh(new CylinderGeometry(0.008, 0.008, 0.05, 6), standard(palette.ink, 0.4));
  stick.position.set(-0.1, panelTop + 0.045, depth * 0.27);
  const knob = mesh(new SphereGeometry(0.018, 10, 8), glow(palette.accent, 0.8));
  knob.position.set(-0.1, panelTop + 0.075, depth * 0.27);
  root.add(stick, knob);
  for (let button = 0; button < 3; button++) {
    const cap = mesh(
      new CylinderGeometry(0.014, 0.014, 0.012, 12),
      standard(button === 0 ? palette.accent : palette.laminate, 0.4),
    );
    cap.position.set(0.03 + button * 0.05, panelTop + 0.026, depth * 0.27);
    root.add(cap);
  }
  return { root, screen };
}

/** TV centered at seated eye height for the sofa, on a low console. */
export function buildTvWall(piece: Furniture): { root: Group; screen: TvScreen } {
  const root = placed(piece);
  const screen = new TvScreen();
  const width = 1.15;
  const height = width * (9 / 16);
  const centerY = chibi.seatedEye + 0.08;
  root.add(
    box(width + 0.05, height + 0.05, 0.04, standard(palette.inkDeep, 0.3, 0.2), 0, centerY - height / 2 - 0.025, 0),
  );
  const display = mesh(new PlaneGeometry(width, height), unlit(screen.texture), false);
  display.position.set(0, centerY, 0.025);
  root.add(display);
  return { root, screen };
}

export function buildTvConsole(piece: Furniture): Group {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  root.add(
    box(width - 0.1, 0.26, depth - 0.1, standard(palette.oak, 0.7), 0, 0, 0),
    box(width - 0.14, 0.012, 0.01, glow(), 0, 0.04, (depth - 0.1) / 2 + 0.005),
    box(0.22, 0.05, 0.16, standard(palette.inkDeep, 0.3, 0.2), -0.25, 0.26, 0),
    box(0.01, 0.01, 0.01, glow(), -0.17, 0.29, 0.081),
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
  const top = surface.coffeeTable;
  const legs = standard(palette.ink, 0.5);
  root.add(box(width, 0.035, depth, standard(palette.oak, 0.6), 0, top - 0.035, 0));
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    root.add(box(0.035, top - 0.035, 0.035, legs, x * (width / 2 - 0.05), 0, z * (depth / 2 - 0.05)));
  }
  root.add(mug(0.1, top, 0.15), box(0.14, 0.025, 0.07, standard(palette.inkDeep, 0.4), -0.1, top, -0.15));
  return root;
}

/** Potted plant: a ceramic pot and a loose cluster of leaves, sized from the footprint. */
export function buildPlant(piece: Furniture): Group {
  const root = placed(piece);
  const radius = Math.min(piece.width, piece.depth) / 2;
  const potHeight = radius * 1.2;
  const pot = mesh(new CylinderGeometry(radius * 0.8, radius * 0.62, potHeight, 16), standard(palette.pot, 0.6));
  pot.position.y = potHeight / 2;
  const band = mesh(new CylinderGeometry(radius * 0.81, radius * 0.81, 0.025, 16), standard(palette.ink, 0.5));
  band.position.y = potHeight * 0.8;
  root.add(pot, band);
  // Soil a little below the rim, so the leaves grow out of something.
  const soil = mesh(new CylinderGeometry(radius * 0.76, radius * 0.76, 0.02, 16), standard(palette.soil, 1), false);
  soil.position.y = potHeight - 0.03;
  const crown = leafyCrown(radius, palette.leaf, palette.leafDark);
  crown.position.y = potHeight - 0.02;
  root.add(soil, crown);
  return root;
}

/** Standing kanban, its cards between waist and eye height where a chibi reads them. */
export function buildKanban(piece: Furniture): Group {
  const root = placed(piece);
  const { width } = localSize(piece);
  const ink = standard(palette.ink, 0.5);
  const bottom = 0.32;
  const height = 0.62;
  root.add(
    box(0.035, bottom + height + 0.04, 0.035, ink, -width / 2 + 0.04, 0, 0),
    box(0.035, bottom + height + 0.04, 0.035, ink, width / 2 - 0.04, 0, 0),
    box(0.22, 0.025, 0.22, ink, -width / 2 + 0.04, 0, 0),
    box(0.22, 0.025, 0.22, ink, width / 2 - 0.04, 0, 0),
    box(width, height + 0.06, 0.025, standard(palette.frame, 0.5), 0, bottom - 0.03, 0),
  );
  const board = mesh(new PlaneGeometry(width - 0.06, height), printed(kanbanTexture()), false);
  board.position.set(0, bottom + height / 2, 0.016);
  root.add(board);
  return root;
}

/** Ring light with the ring at a chibi's eye height, where it would actually light a face. */
export function buildRingLight(piece: Furniture): Group {
  const root = placed(piece);
  const ink = standard(palette.ink, 0.5);
  const ringY = chibi.eye;
  root.add(box(0.2, 0.02, 0.2, ink, 0, 0, 0), box(0.02, ringY - 0.12, 0.02, ink, 0, 0, 0));
  // Warm white, not the accent: a ring light's job is lighting faces.
  const ring = mesh(new TorusGeometry(0.12, 0.016, 8, 32), glow("#fff3e6", 1.2));
  ring.position.y = ringY;
  root.add(ring);
  return root;
}

/** Camera on a tripod with the lens at a seated chibi's eye height, framing Ruby at her desk. */
export function buildCameraTripod(piece: Furniture): Group {
  const root = placed(piece);
  const ink = standard(palette.ink, 0.5);
  const headY = chibi.seatedEye - 0.04;
  const head = new Vector3(0, headY, 0);
  const up = new Vector3(0, 1, 0);
  for (let leg = 0; leg < 3; leg++) {
    const angle = (leg / 3) * Math.PI * 2;
    const foot = new Vector3(Math.sin(angle) * 0.16, 0, Math.cos(angle) * 0.16);
    const length = head.distanceTo(foot);
    const rod = mesh(new CylinderGeometry(0.006, 0.006, length, 6), ink);
    rod.position.copy(head).add(foot).multiplyScalar(0.5);
    rod.quaternion.setFromUnitVectors(up, new Vector3().subVectors(head, foot).normalize());
    root.add(rod);
  }
  const body = box(0.12, 0.075, 0.07, standard(palette.inkDeep, 0.4), 0, headY, 0);
  const lens = mesh(new CylinderGeometry(0.026, 0.026, 0.06, 14), standard(palette.ink, 0.3, 0.4));
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, headY + 0.04, 0.06);
  const tally = box(0.012, 0.012, 0.008, glow(palette.accent, 1.8), 0.045, headY + 0.06, 0.036);
  root.add(body, lens, tally);
  return root;
}

/**
 * Ruby's brand wall: logo and "AlyxLabs" side by side like the wall sign, in a band above her
 * head so neither hides behind her in the close-up.
 */
export function buildBackdrop(piece: Furniture, logo: Texture, lettering: SignLettering): Group {
  const root = placed(piece);
  const { width } = localSize(piece);
  const ink = standard(palette.inkDeep, 0.7);
  const height = 1.25;
  root.add(box(width, height, 0.05, ink, 0, 0, 0), box(width, 0.018, 0.06, glow(), 0, height - 0.02, 0));
  const bandY = chibi.eye + 0.13;
  const markSize = 0.32;
  const gap = 0.06;
  const planeWidth = 0.8;
  // Center the logo plus the words themselves, not the texture's empty margin after "Labs".
  const inkWidth = planeWidth * (lettering.inkEnd - lettering.inkStart);
  const left = -(markSize + gap + inkWidth) / 2;
  const mark = mesh(new PlaneGeometry(markSize, markSize), unlit(logo, true), false);
  mark.position.set(left + markSize / 2, bandY, 0.03);
  const text = mesh(new PlaneGeometry(planeWidth, planeWidth / 4), unlit(lettering.texture, true), false);
  const inkLeft = left + markSize + gap;
  text.position.set(inkLeft - planeWidth * lettering.inkStart + planeWidth / 2, bandY, 0.03);
  root.add(mark, text);
  return root;
}

/**
 * Team table with one laptop per chair, each facing its sitter. Laptops come back in the order
 * of the meeting seats (back left, back right, front left, front right), so the stage can light
 * the screen of whoever sits down.
 */
export function buildMeetingTable(piece: Furniture): { root: Group; laptops: LaptopScreen[] } {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const top = surface.desk;
  const legs = standard(palette.ink, 0.6);
  root.add(
    box(width, 0.035, depth, standard(palette.oak, 0.55), 0, top - 0.035, 0),
    box(0.05, top - 0.035, depth - 0.2, legs, -width / 2 + 0.12, 0, 0),
    box(0.05, top - 0.035, depth - 0.2, legs, width / 2 - 0.12, 0, 0),
    box(width - 0.3, 0.012, 0.01, glow(), 0, top - 0.045, depth / 2 - 0.01),
  );
  // A laptop's keys face +z in its own frame, so the back-row seats (sitting at -z) need it
  // turned half way round; the front-row seats sit at +z and take it as built.
  const laptops = (
    [
      [-0.5, -0.22, Math.PI],
      [0.5, -0.22, Math.PI],
      [-0.5, 0.22, 0],
      [0.5, 0.22, 0],
    ] as const
  ).map(([x, z, yaw], index) => {
    const screen = new LaptopScreen(index + 1);
    const laptop = new Group();
    const shell = standard("#d9d4cc", 0.5);
    laptop.add(box(0.26, 0.012, 0.18, shell, 0, top, 0), box(0.26, 0.17, 0.01, shell, 0, top + 0.012, -0.09));
    const panel = mesh(new PlaneGeometry(0.24, 0.15), unlit(screen.texture), false);
    panel.position.set(0, top + 0.012 + 0.085, -0.084);
    laptop.add(panel);
    laptop.position.set(x, 0, z);
    laptop.rotation.y = yaw;
    root.add(laptop);
    return screen;
  });
  root.add(box(0.14, 0.004, 0.2, standard("#fbfaf7", 0.9), 0.05, top, 0.0), mug(-0.05, top, 0.05));
  return { root, laptops };
}

/** Chibi-scale ping-pong table: ink top with white lines and a net, accent paddles at each end. */
export function buildPingpongTable(piece: Furniture): Group {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const top = surface.pingpong;
  const ink = standard(palette.ink, 0.6);
  root.add(
    box(width, 0.03, depth, standard(palette.inkSoft, 0.5), 0, top - 0.03, 0),
    box(width, 0.004, 0.012, standard("#ffffff", 0.6), 0, top, 0),
    box(0.012, 0.004, depth, standard("#ffffff", 0.6), -width / 2 + 0.006, top, 0),
    box(0.012, 0.004, depth, standard("#ffffff", 0.6), width / 2 - 0.006, top, 0),
    box(0.012, 0.09, depth + 0.04, standard("#f4f1ec", 0.8), 0, top, 0),
  );
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      root.add(box(0.035, top - 0.03, 0.035, ink, x * (width / 2 - 0.08), 0, z * (depth / 2 - 0.08)));
    }
  }
  return root;
}

/** Low cabinet with a printer on top, at desk height so it reads as part of the workspace. */
export function buildPrinterCabinet(piece: Furniture): Group {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const cabinetHeight = surface.desk - 0.12;
  root.add(
    box(width - 0.04, cabinetHeight, depth - 0.06, standard(palette.ink, 0.6), 0, 0, 0),
    box(width - 0.08, 0.13, depth - 0.14, standard(palette.laminate, 0.5), 0, cabinetHeight, 0),
    box(width - 0.14, 0.015, 0.1, standard("#fbfaf7", 0.9), 0, cabinetHeight + 0.13, 0.04),
    box(0.012, 0.012, 0.01, glow(), width / 2 - 0.09, cabinetHeight + 0.1, (depth - 0.14) / 2 + 0.005),
  );
  return root;
}
