import {
  VRMSpringBoneCollider,
  VRMSpringBoneColliderShapeCapsule,
  VRMSpringBoneColliderShapeSphere,
} from "@pixiv/three-vrm";
import {
  Box3,
  BoxGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { type Furniture, people, surface } from "../office-plan.js";
import { ArcadeScreen, LaptopScreen, RackLights, TvScreen } from "./animated.js";
import { type FoodModelName, foodModel, kitScale, roomScale } from "./food-models.js";
import { furnitureModel } from "./furniture-models.js";
import { handPropModel, type PropLook } from "./hand-props.js";
import { fitModel, kitPiece, kitSize } from "./kit.js";
import { laptopShell } from "./laptop-model.js";
import { box, glow, mesh, palette, standard, unlit } from "./palette.js";
import { leafyCrown } from "./plant.js";
import { doorLetteringTexture, type SignLettering } from "./textures.js";

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

/** A capsule running front to back at `x`, such as along an armrest pad, in the piece's frame. */
function lengthwiseCollider(
  root: Group,
  x: number,
  y: number,
  back: number,
  front: number,
  radius: number,
): VRMSpringBoneCollider {
  const collider = new VRMSpringBoneCollider(
    new VRMSpringBoneColliderShapeCapsule({
      offset: new Vector3(0, 0, back),
      tail: new Vector3(0, 0, front),
      radius,
    }),
  );
  collider.position.set(x, y, 0);
  root.add(collider);
  return collider;
}

/** A sphere standing in for a rounded seat or cushion, so hair slides off it. */
function sphereCollider(root: Group, x: number, y: number, z: number, radius: number): VRMSpringBoneCollider {
  const collider = new VRMSpringBoneCollider(new VRMSpringBoneColliderShapeSphere({ radius }));
  collider.position.set(x, y, z);
  root.add(collider);
  return collider;
}

/**
 * The chair's body seen from the side, in (depth, height) with the front at +depth: one shell that
 * runs from the rounded front of the seat, curves up through the lumbar, and rises into a tall
 * back with the headrest in it, leaning back a little toward the top.
 */
function chairShellProfile(seatHeight: number): Shape {
  const top = seatHeight + 0.6;
  const under = seatHeight - 0.07;
  const shape = new Shape();
  shape.moveTo(0.19, under);
  shape.quadraticCurveTo(0.225, under + 0.01, 0.215, seatHeight - 0.025);
  shape.quadraticCurveTo(0.2, seatHeight, 0.16, seatHeight);
  shape.lineTo(-0.1, seatHeight);
  shape.quadraticCurveTo(-0.185, seatHeight, -0.19, seatHeight + 0.09);
  shape.lineTo(-0.215, top - 0.04);
  shape.quadraticCurveTo(-0.22, top + 0.02, -0.255, top);
  shape.quadraticCurveTo(-0.272, top - 0.01, -0.272, top - 0.06);
  shape.lineTo(-0.252, seatHeight + 0.08);
  shape.quadraticCurveTo(-0.245, under, -0.12, under);
  shape.closePath();
  return shape;
}

/** The colored back cover: a thin shell behind the leather, from the lumbar to the top. */
function chairCoverProfile(seatHeight: number): Shape {
  const top = seatHeight + 0.585;
  const shape = new Shape();
  shape.moveTo(-0.25, seatHeight + 0.04);
  shape.lineTo(-0.27, top - 0.06);
  shape.quadraticCurveTo(-0.272, top + 0.005, -0.255, top + 0.012);
  shape.lineTo(-0.285, top - 0.02);
  shape.lineTo(-0.288, top - 0.06);
  shape.lineTo(-0.268, seatHeight + 0.04);
  shape.closePath();
  return shape;
}

/** A side profile pushed out to `width`, edges rounded, centered on the chair's middle. */
function extrudedAcross(shape: Shape, width: number, round: number): ExtrudeGeometry {
  const geometry = new ExtrudeGeometry(shape, {
    depth: width - 2 * round,
    bevelEnabled: true,
    bevelThickness: round,
    bevelSize: round,
    bevelSegments: 3,
    curveSegments: 10,
  });
  // The profile is drawn in (depth, height) and extruded along z: turn it so the depth runs along
  // the chair's z and the width across its x, then center it.
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(width / 2 - round, 0, 0);
  return geometry;
}

/** Built once per seat height and shared, since all the chairs at that height are alike. */
const chairParts = new Map<number, { shell: ExtrudeGeometry; cover: ExtrudeGeometry; arm: TubeGeometry }>();

function chairGeometry(seatHeight: number): { shell: ExtrudeGeometry; cover: ExtrudeGeometry; arm: TubeGeometry } {
  const known = chairParts.get(seatHeight);
  if (known !== undefined) {
    return known;
  }
  // One armrest loop, from the back's side out and forward over the elbow, down to the seat edge.
  const arm = new TubeGeometry(
    new CatmullRomCurve3([
      new Vector3(0, seatHeight + 0.2, -0.2),
      new Vector3(0.02, seatHeight + 0.13, -0.08),
      new Vector3(0.02, seatHeight + 0.1, 0.06),
      new Vector3(0.01, seatHeight + 0.06, 0.13),
      new Vector3(0, seatHeight - 0.03, 0.1),
    ]),
    24,
    0.016,
    8,
    false,
  );
  const parts = {
    shell: extrudedAcross(chairShellProfile(seatHeight), 0.42, 0.018),
    cover: extrudedAcross(chairCoverProfile(seatHeight), 0.45, 0.01),
    arm,
  };
  chairParts.set(seatHeight, parts);
  return parts;
}

/**
 * Executive office chair after the modern ones in startup offices: one curved cream leather
 * shell from the seat up through the headrest, the brand's purple as a cover on the back that
 * shows down both sides, looping armrests kept low so typing elbows clear them, and a chrome
 * five-star base on casters.
 */
/**
 * The office chair model ("Office Chair" by PixelPlay, CC-BY-4.0), in its own units: the seat
 * cushion's top, the middle of the seat from the model's center, the backrest's front, and the
 * armrests' tops and spread. Its back is toward +z, so it is turned round to face the desk.
 */
const officeChairModel = { seatTop: 0.515, seatOffsetZ: 0.0985, backFront: 0.27, armTop: 0.759, armX: 0.33 } as const;

/** The office chair model fitted to the seat height, or null when it did not load. */
function modelChair(seatHeight: number): BuiltPiece | null {
  const scale = seatHeight / officeChairModel.seatTop;
  const chair = kitPiece(
    "officeChair",
    { height: 1.192 * scale },
    // An all-black chair, seat, back and arm pads, with only the headrest in the room's chair purple.
    { couro_2_4k: "#161616", couro_2_4k_encosto1: "#161616", couro_2_4k_encosto_de_cabea: palette.chairPurple },
  );
  if (chair === null) {
    return null;
  }
  chair.rotation.y = Math.PI;
  // Seat middle over the piece's origin, where the seated pose expects it.
  chair.position.z = -officeChairModel.seatOffsetZ * scale;
  const root = new Group();
  root.add(chair);
  const backZ = -officeChairModel.backFront * scale;
  const armX = officeChairModel.armX * scale;
  const armTop = officeChairModel.armTop * scale;
  return {
    root,
    hairColliders: [
      ...panelColliders(root, 0.36, backZ - 0.02, seatHeight + 0.06, seatHeight + 0.4, 0.04),
      lengthwiseCollider(root, -armX, armTop - 0.01, -0.12, 0.08, 0.03),
      lengthwiseCollider(root, armX, armTop - 0.01, -0.12, 0.08, 0.03),
      ...seatColliders(root, 0.36, seatHeight - 0.03, 0.15, -0.15, 0.035),
    ],
  };
}

export function buildChair(piece: Furniture, seatHeight: number): BuiltPiece {
  const fromModel = modelChair(seatHeight);
  if (fromModel !== null) {
    const root = placed(piece);
    root.add(fromModel.root);
    return { root, hairColliders: fromModel.hairColliders };
  }
  const root = placed(piece);
  const leather = standard(palette.leather, 0.45);
  // A warmer purple than the trim elsewhere: the deep one reads as navy under the room's lights.
  const trim = standard(palette.chairPurple, 0.5);
  const chrome = standard(palette.steel, 0.2, 0.9);
  const dark = standard(palette.inkDeep, 0.6);
  const { shell, cover, arm } = chairGeometry(seatHeight);
  const seatThickness = 0.07;

  for (let spoke = 0; spoke < 5; spoke++) {
    const angle = (spoke / 5) * Math.PI * 2;
    const spokeGroup = new Group();
    spokeGroup.rotation.y = angle;
    // Each spoke tapers and dips toward its caster, the way a cast base does.
    const leg = box(0.032, 0.022, 0.2, chrome, 0, 0.055, 0.1);
    leg.rotation.x = 0.12;
    const fork = box(0.022, 0.04, 0.022, dark, 0, 0.03, 0.205);
    const wheel = mesh(new CylinderGeometry(0.024, 0.024, 0.02, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(0, 0.024, 0.215);
    spokeGroup.add(leg, fork, wheel);
    root.add(spokeGroup);
  }
  const hub = mesh(new CylinderGeometry(0.045, 0.05, 0.035, 16), chrome);
  hub.position.y = 0.07;
  const columnHeight = seatHeight - seatThickness - 0.08;
  const column = mesh(new CylinderGeometry(0.02, 0.022, columnHeight, 12), chrome);
  column.position.y = 0.08 + columnHeight / 2;
  const sleeve = mesh(new CylinderGeometry(0.03, 0.03, 0.09, 12), dark);
  sleeve.position.y = 0.13;
  root.add(
    hub,
    column,
    sleeve,
    // The tilt mechanism under the seat.
    box(0.18, 0.03, 0.2, dark, 0, seatHeight - seatThickness - 0.03, 0),
    mesh(shell, leather),
    mesh(cover, trim),
  );
  // Armrests close to the seat's sides and low: a skirt spreading over the seat edge and an elbow
  // at the keys both stay clear of them.
  const armX = 0.235;
  // The top of the loop, where a forearm would rest.
  const armTop = seatHeight + 0.12;
  for (const side of [-1, 1]) {
    const loop = mesh(arm, leather);
    loop.position.x = side * armX;
    loop.scale.x = side;
    root.add(loop);
  }
  const backZ = -0.235;
  return {
    root,
    hairColliders: [
      ...panelColliders(root, 0.4, backZ, seatHeight + 0.06, seatHeight + 0.58, 0.04),
      // Along each armrest pad, so a skirt or long hair drapes over it instead of cutting through.
      lengthwiseCollider(root, -armX - 0.02, armTop - 0.01, -0.15, 0.08, 0.03),
      lengthwiseCollider(root, armX + 0.02, armTop - 0.01, -0.15, 0.08, 0.03),
      ...seatColliders(root, 0.4, seatHeight - 0.03, 0.15, -0.15, 0.035),
    ],
  };
}

export function buildSofa(piece: Furniture, seatHeight: number): BuiltPiece {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const body = standard(palette.fabric, 0.95);
  // A real sofa's back (0.85 m) and arms (0.62 m) at the room's 0.73 scale.
  const backTop = seatHeight + 0.31;
  // Kenney's lounge sofa: its cushions sit at half its height, so fitted to the back's height the
  // seat lands on the station's seat height.
  const kit = kitPiece("loungeSofa", { width, height: backTop, depth }, { carpet: palette.fabric, wood: palette.ink });
  if (kit !== null) {
    root.add(kit);
  } else {
    root.add(
      box(width, seatHeight - 0.08, depth, body, 0, 0, 0),
      box(width, backTop, 0.16, body, 0, 0, -depth / 2 + 0.08),
      box(0.14, seatHeight + 0.14, depth, body, -width / 2 + 0.07, 0, 0),
      box(0.14, seatHeight + 0.14, depth, body, width / 2 - 0.07, 0, 0),
    );
    const cushionWidth = (width - 0.32) / 3;
    for (let seat = 0; seat < 3; seat++) {
      const x = -width / 2 + 0.16 + cushionWidth * (seat + 0.5);
      root.add(
        box(cushionWidth - 0.03, 0.08, depth - 0.2, standard(palette.cushion, 0.95), x, seatHeight - 0.08, 0.05),
      );
    }
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
/**
 * "Simple Bean Bag" by AleixoAlonso (Sketchfab, CC-BY-4.0): a high back and a dip in front of it.
 * The dip is about 0.65 of the bag's height and lies about a quarter of its depth ahead of the
 * middle, so the bag is fitted that much taller than the seat, a little higher so the sitter sinks
 * in, and set back most of the way toward having the dip under their hips: all the way would push
 * its back into the wall behind it.
 */
const beanbagDip = 0.65;
const beanbagDipAhead = 0.23;

export function buildBeanbag(piece: Furniture, tint: string, seatHeight: number): BuiltPiece {
  const root = placed(piece);
  const size = 0.74;
  const model = furnitureModel("beanbag");
  if (model !== null) {
    const bag = fitModel(model, { width: size, height: (seatHeight + 0.02) / beanbagDip, depth: size });
    bag.position.z = -beanbagDipAhead * size * 0.6;
    root.add(bag);
    return { root, hairColliders: [sphereCollider(root, 0, seatHeight + 0.08, -0.22, 0.16)] };
  }
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
  // Kenney's bar stool frame in walnut, its eight-sided seat swapped for a round brown cushion so
  // the seat top lands on the station's seat height. The frame is square: 0.2 across, its corner
  // legs (0.14 from the middle) stay under the 0.15 cushion instead of poking out past its rim.
  const kit = kitPiece(
    "stoolBar",
    { width: 0.2, height: seatHeight, depth: 0.2 },
    { carpet: palette.accentDeep, wood: palette.walnutDark },
  );
  if (kit !== null) {
    kit.traverse((part) => {
      if (part instanceof Mesh && !Array.isArray(part.material) && part.material.name === "carpet") {
        part.visible = false;
      }
    });
    const cushion = mesh(new CylinderGeometry(0.155, 0.15, 0.05, 28), standard(palette.walnut, 0.6));
    cushion.position.y = seatHeight - 0.025;
    root.add(kit, cushion);
    return { root, hairColliders: stoolColliders(root, seatHeight) };
  }
  const ink = standard(palette.ink, 0.5);
  const leg = mesh(new CylinderGeometry(0.018, 0.018, seatHeight, 8), ink);
  leg.position.y = seatHeight / 2;
  const foot = mesh(new CylinderGeometry(0.12, 0.13, 0.02, 16), ink);
  foot.position.y = 0.01;
  // A foot ring wide enough to rest feet on, as on a real bar stool.
  const ring = mesh(new TorusGeometry(0.15, 0.009, 6, 24), ink);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = seatHeight * 0.45;
  const seat = mesh(new CylinderGeometry(0.15, 0.14, 0.045, 20), standard(palette.oak, 0.7));
  seat.position.y = seatHeight - 0.0225;
  root.add(leg, foot, ring, seat);
  return { root, hairColliders: stoolColliders(root, seatHeight) };
}

/**
 * A sphere just under the round seat: hair hanging behind the sitter slides around the stool,
 * and a flat one in the seat itself so tips resting on it stay on top.
 */
function stoolColliders(root: Group, seatHeight: number): VRMSpringBoneCollider[] {
  return [
    sphereCollider(root, 0, seatHeight - 0.15, 0, 0.16),
    ...seatColliders(root, 0.24, seatHeight - 0.03, 0.08, -0.08, 0.035),
  ];
}

/** Pantry counter at working height, with the coffee machine where the "coffee" station stands. */
/** The pantry counter's working parts, which the stage switches on while someone uses them. */
export interface PantryCounter {
  root: Group;
  sink: SinkTap;
  oven: Oven;
  /** One drying slot per owner, in the order given; each holds that owner's cup upside down. */
  rackCups: Object3D[];
  /** Where hands go: the coffee machine's button, the cup's place under its spout, the basin. */
  reach: { button: Object3D; tray: Object3D; basin: Object3D };
}

/** An empty point at a spot in `parent`'s frame, for hands to find in the world. */
function anchor(parent: Object3D, x: number, y: number, z: number): Object3D {
  const point = new Group();
  point.position.set(x, y, z);
  parent.add(point);
  return point;
}

/** A cup that dries on the rack: whose colors, and whether it is a teacup rather than a mug. */
export interface RackCup {
  look: PropLook;
  teacup: boolean;
}

/**
 * Counter along the back wall: a sink on the left, the coffee machine in the middle, and an oven
 * built in under the right end. Positions are world x, so they line up with the stations.
 */
export function buildPantryCounter(
  piece: Furniture,
  at: { coffee: number; sink: number; oven: number },
  cups: readonly RackCup[],
): PantryCounter {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const ink = standard(palette.ink, 0.6);
  const top = surface.counter;
  const front = depth / 2;
  const ovenX = at.oven - piece.x;
  root.add(
    box(width, top - 0.03, depth - 0.04, ink, 0, 0, 0),
    box(width + 0.02, 0.03, depth, standard(palette.laminate, 0.4), 0, top - 0.03, 0),
    box(width, 0.36, 0.02, standard(palette.backWall, 0.9), 0, top, -depth / 2 + 0.01),
    // Open shelf above the counter with mugs and jars, within reach.
    box(width * 0.8, 0.025, 0.18, standard(palette.oak, 0.6), 0, top + 0.42, -depth / 2 + 0.1),
  );
  // Kenney's kitchen cabinets along the front, in the room's ink with steel handles, leaving the
  // oven's slot open; the dark body behind fills the gap round the oven.
  const unitWidth = 0.42;
  const ovenFrom = ovenX - ovenWidth / 2 - 0.02;
  const ovenTo = ovenX + ovenWidth / 2 + 0.02;
  let cabinets = 0;
  for (const [from, to] of [
    [-width / 2, ovenFrom],
    [ovenTo, width / 2],
  ] as const) {
    const count = Math.floor((to - from) / unitWidth + 0.25);
    const each = count > 0 ? (to - from) / count : 0;
    for (let unit = 0; unit < count; unit++) {
      const cabinet = kitPiece(
        "kitchenCabinet",
        { width: each - 0.005, height: top - 0.03, depth: depth - 0.03 },
        { wood: palette.ink, woodDark: palette.inkSoft, metal: palette.steel },
      );
      if (cabinet === null) {
        break;
      }
      cabinet.position.x = from + each * (unit + 0.5);
      root.add(cabinet);
      cabinets++;
    }
  }
  if (cabinets === 0) {
    for (let door = 0; door < 4; door++) {
      const x = -width / 2 + (width / 4) * (door + 0.5);
      // No cupboard line across the oven's face.
      if (Math.abs(x - ovenX) < ovenWidth / 2 + 0.03) {
        continue;
      }
      root.add(box(0.015, top * 0.6, 0.01, standard(palette.inkSoft, 0.5), x, 0.08, front - 0.015));
    }
  }
  const machineX = at.coffee - piece.x;
  // Well forward on the counter: the team stands about 1.2 m tall, and the button and the cup's
  // place have to be within an arm's length of someone standing at the counter's edge.
  const machineZ = 0;
  // Kenney's espresso machine in dark ink and steel; its own cup is left out, the team brings mugs.
  const machine = kitPiece(
    "kitchenCoffeeMachine",
    { height: 0.3 },
    { metalMedium: palette.inkDeep, metal: palette.steel },
  );
  const machineCup = machine?.getObjectByName("mug");
  if (machine !== null) {
    if (machineCup !== undefined) {
      machineCup.visible = false;
    }
    machine.position.set(machineX, top, machineZ);
    root.add(machine, box(0.05, 0.01, 0.01, glow(), machineX + 0.06, top + 0.24, machineZ + 0.16));
  } else {
    root.add(
      box(0.22, 0.28, 0.22, standard(palette.inkDeep, 0.35, 0.3), machineX, top, machineZ),
      box(0.16, 0.025, 0.09, standard(palette.steel, 0.3, 0.6), machineX, top + 0.04, machineZ + 0.13),
      box(0.05, 0.01, 0.01, glow(), machineX + 0.06, top + 0.24, machineZ + 0.111),
    );
  }
  // No microwave on the counter: the oven is built in below. A toaster by the kettle.
  const toaster = kitPiece("toaster", { height: 0.13 }, { metalMedium: palette.accentDeep });
  if (toaster !== null) {
    toaster.position.set(width / 2 - 0.5, top, -depth / 2 + 0.12);
    root.add(toaster);
  }
  for (let jar = 0; jar < 4; jar++) {
    const glass = mesh(new CylinderGeometry(0.042, 0.042, 0.13, 12), standard(palette.glass, 0.15));
    glass.position.set(-width * 0.3 + jar * 0.14, top + 0.51, -depth / 2 + 0.1);
    root.add(glass);
  }
  const kettle = mesh(new CylinderGeometry(0.06, 0.075, 0.18, 14), standard(palette.steel, 0.25, 0.7));
  // Clear of the bar's overhanging top, which covers this end of the counter.
  kettle.position.set(width / 2 - 0.3, top + 0.09, -0.05);
  root.add(kettle);
  const sink = buildSink(at.sink - piece.x, top);
  const oven = buildOven(ovenX, front);
  // Right beside the basin, so a washed mug goes straight onto it, and wholly on the counter: its
  // far edge stops short of the counter's end by the fridge.
  const rack = buildDryingRack(at.sink - piece.x - 0.32, top, cups);
  root.add(sink.root, oven.root, rack.root);
  return {
    root,
    sink: sink.tap,
    oven: oven.oven,
    rackCups: rack.cups,
    reach: {
      button: anchor(root, machineX + 0.06, top + 0.2, machineZ + 0.115),
      tray: anchor(root, machineX, top + 0.07, machineZ + 0.13),
      basin: anchor(sink.root, 0, top + 0.03, 0),
    },
  };
}

/**
 * A steel drying rack with a peg for each cup: three across, four deep. Cups sit on it upside down,
 * and each slot's cup shows only while its owner's mug is there.
 */
function buildDryingRack(x: number, top: number, cups: readonly RackCup[]): { root: Group; cups: Object3D[] } {
  const root = new Group();
  // Toward the front of the counter, where someone standing at the sink can reach it.
  root.position.set(x, 0, 0.13);
  const steel = standard(palette.steel, 0.3, 0.6);
  root.add(box(0.21, 0.008, 0.3, steel, 0, top, 0), box(0.21, 0.04, 0.006, steel, 0, top, -0.15));
  const slots = cups.map((cup, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const slotX = (column - 1) * 0.065;
    const slotZ = (row - 1.5) * 0.07;
    const peg = mesh(new CylinderGeometry(0.002, 0.002, 0.04, 6), steel, false);
    peg.position.set(slotX, top + 0.028, slotZ);
    const model = handPropModel(cup.teacup ? "teacup" : "mug", cup.look);
    // Upside down to drain, the rim resting on the tray.
    model.rotation.x = Math.PI;
    model.position.set(slotX, top + 0.008 + (cup.teacup ? 0.016 : 0.035), slotZ);
    root.add(peg, model);
    return model;
  });
  return { root, cups: slots };
}

/** Water from the tap while someone is at the sink: a thin stream that wavers a little. */
export class SinkTap {
  constructor(private readonly stream: ReturnType<typeof mesh>) {}

  update(running: boolean, time: number): void {
    this.stream.visible = running;
    if (running) {
      const waver = 1 + 0.12 * Math.sin(time * 23) + 0.06 * Math.sin(time * 37);
      this.stream.scale.set(waver, 1, waver);
    }
  }
}

function buildSink(x: number, top: number): { root: Group; tap: SinkTap } {
  const root = new Group();
  // Toward the front of the counter, within reach of someone the team's height.
  root.position.set(x, 0, 0.08);
  const steel = standard(palette.steel, 0.25, 0.7);
  // A basin set into the top: a steel rim around a dark bowl.
  root.add(
    box(0.42, 0.006, 0.3, steel, 0, top, 0),
    box(0.38, 0.004, 0.26, standard("#2c3036", 0.35, 0.6), 0, top + 0.003, 0),
  );
  // A tap a real one's size at the room's scale: about 0.25 m tall with a reach over the bowl.
  const riser = mesh(new CylinderGeometry(0.012, 0.015, 0.25, 10), steel);
  riser.position.set(0, top + 0.125, -0.17);
  const spout = mesh(new CylinderGeometry(0.01, 0.01, 0.13, 10), steel);
  spout.rotation.x = Math.PI / 2;
  spout.position.set(0, top + 0.245, -0.11);
  const stream = mesh(new CylinderGeometry(0.006, 0.008, 0.23, 8), standard("#cfe8f7", 0.05, 0.1), false);
  const material = stream.material as MeshStandardMaterial;
  material.transparent = true;
  material.opacity = 0.65;
  stream.position.set(0, top + 0.12, -0.05);
  stream.visible = false;
  root.add(riser, spout, stream);
  return { root, tap: new SinkTap(stream) };
}

/** A built-in oven at the room's 0.73 scale: about 0.44 m wide and 0.4 tall (0.6 by 0.55 real). */
const ovenWidth = 0.44;
const ovenHeight = 0.4;
/** Radians the door falls open on its bottom hinge. */
const ovenOpenAngle = 1.35;

export type OvenState = "off" | "open" | "cooking";

/**
 * An oven built in under the counter: the door drops open on its bottom hinge, and the inside
 * glows warm while it cooks, seen through the door's window.
 */
export class Oven {
  private angle = 0;

  constructor(
    private readonly door: Group,
    private readonly light: MeshStandardMaterial,
    private readonly window: MeshStandardMaterial,
    private readonly dish: Group,
  ) {}

  update(state: OvenState, holdsFood: boolean, delta: number, time: number): void {
    const target = state === "open" ? ovenOpenAngle : 0;
    this.angle += (target - this.angle) * Math.min(1, 6 * delta);
    this.door.rotation.x = this.angle;
    const glowing = state === "cooking" ? 1.4 + 0.15 * Math.sin(time * 3) : state === "open" ? 0.6 : 0;
    this.light.emissiveIntensity = glowing;
    // The window is dark glass; while cooking the warm light inside shows through it.
    this.window.emissiveIntensity = state === "cooking" ? glowing * 0.45 : 0;
    this.dish.visible = holdsFood;
  }
}

function buildOven(x: number, front: number): { root: Group; oven: Oven } {
  const root = new Group();
  const bottom = 0.1;
  root.position.set(x, 0, front);
  const steel = standard(palette.steel, 0.3, 0.6);
  // The cavity: dark walls with a warm light panel at the back that comes on while cooking.
  const light = new MeshStandardMaterial({ color: "#2a1d14", emissive: "#ffb066", emissiveIntensity: 0 });
  root.add(
    box(ovenWidth, ovenHeight, 0.02, steel, 0, bottom, -0.005),
    box(ovenWidth - 0.04, ovenHeight - 0.05, 0.01, standard("#15171c", 0.6), 0, bottom + 0.025, -0.01),
    mesh(new BoxGeometry(ovenWidth - 0.06, ovenHeight - 0.08, 0.004), light, false),
  );
  const back = root.children[root.children.length - 1];
  back?.position.set(0, bottom + ovenHeight / 2, -0.25);
  const dish = new Group();
  dish.add(
    mesh(new CylinderGeometry(0.06, 0.05, 0.01, 18), standard("#fbfaf7", 0.4)),
    box(0.05, 0.025, 0.035, standard("#d9a05b", 0.7), 0, 0.005, 0),
  );
  dish.position.set(0, bottom + 0.06, -0.14);
  dish.visible = false;
  root.add(dish);
  // The door, hinged along its bottom edge.
  const door = new Group();
  door.position.set(0, bottom, 0.012);
  const glass = new MeshStandardMaterial({
    color: "#1a1c22",
    roughness: 0.1,
    metalness: 0.3,
    emissive: "#ff9a4a",
    emissiveIntensity: 0,
  });
  door.add(
    box(ovenWidth - 0.01, ovenHeight - 0.01, 0.02, steel, 0, 0, 0),
    box(ovenWidth - 0.1, ovenHeight * 0.45, 0.004, glass, 0, ovenHeight * 0.3, 0.011),
    box(ovenWidth - 0.08, 0.016, 0.02, standard(palette.ink, 0.4), 0, ovenHeight - 0.05, 0.025),
  );
  root.add(door);
  return { root, oven: new Oven(door, light, glass, dish) };
}

/**
 * The bar that runs out from the end of the pantry counter, making the L: a raised top that
 * overhangs both sides for the knees of whoever sits on the stools, and a footrest rail each side.
 */
export function buildBarCounter(piece: Furniture): Group {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const top = surface.barTable;
  const ink = standard(palette.ink, 0.6);
  const overhang = 0.14;
  root.add(
    box(width - 0.12, top - 0.035, depth, ink, 0, 0, 0),
    box(width + overhang * 2, 0.035, depth + 0.02, standard(palette.laminate, 0.4), 0, top - 0.035, 0),
    box(0.01, 0.012, depth - 0.2, glow(), width / 2 - 0.065, top - 0.05, 0),
    box(0.01, 0.012, depth - 0.2, glow(), -width / 2 + 0.065, top - 0.05, 0),
  );
  for (const side of [-1, 1]) {
    const rail = mesh(new CylinderGeometry(0.012, 0.012, depth - 0.3, 10), standard(palette.steel, 0.3, 0.6));
    rail.rotation.x = Math.PI / 2;
    rail.position.set(side * (width / 2 - 0.02), 0.16, 0);
    root.add(rail);
  }
  return root;
}

/** How far the bin's lid flips up, and how quickly it gets there and back. */
const binLidOpenAngle = 1.6;
const binLidRate = 9;

/** The bin's lid on its back hinge: up while someone drops something in, then down again. */
export class TrashBin {
  private angle = 0;

  constructor(
    readonly root: Group,
    private readonly lid: Group,
  ) {}

  update(open: boolean, delta: number): void {
    const target = open ? binLidOpenAngle : 0;
    this.angle += (target - this.angle) * Math.min(1, binLidRate * delta);
    // Negative pitch lifts the front edge, the lid turning up on the hinge at the back.
    this.lid.rotation.x = -this.angle;
  }
}

/**
 * A pedal bin by the bar, where the empty food boxes go: about 0.45 m tall (0.65 real at the
 * room's scale), eight-sided like the Kenney one it replaces, with a lid hinged at the back that
 * opens while something goes in.
 */
export function buildTrashBin(piece: Furniture): TrashBin {
  const root = placed(piece);
  const height = 0.44;
  const radius = 0.13;
  const body = mesh(new CylinderGeometry(radius, radius * 0.88, height, 8), standard("#3a3f4b", 0.5, 0.3));
  body.position.y = height / 2;
  body.rotation.y = Math.PI / 8;
  const steel = standard(palette.steel, 0.3, 0.6);
  const rim = mesh(new CylinderGeometry(radius + 0.006, radius + 0.006, 0.02, 8), steel);
  rim.position.y = height - 0.01;
  rim.rotation.y = Math.PI / 8;
  const lid = new Group();
  lid.position.set(0, height, -radius);
  const top = mesh(new CylinderGeometry(radius + 0.008, radius + 0.008, 0.02, 8), steel);
  top.position.set(0, 0.012, radius);
  top.rotation.y = Math.PI / 8;
  const knob = mesh(new CylinderGeometry(0.05, 0.05, 0.012, 8), standard("#3a3f4b", 0.4, 0.3));
  knob.position.set(0, 0.028, radius);
  lid.add(top, knob);
  root.add(body, rim, lid, box(0.07, 0.014, 0.06, steel, 0, 0.012, radius + 0.02));
  return new TrashBin(root, lid);
}

/** Doors slide this fast toward open or shut, as a share of the way per second. */
const entryDoorSpeed = 4;

/**
 * The automatic entry doors: two glass panels that slide apart while someone is close and back
 * together after, the name on them splitting and joining with them.
 */
export class EntryDoor {
  private open = 0;

  constructor(
    private readonly panels: readonly [Group, Group],
    private readonly travel: number,
  ) {}

  update(open: boolean, delta: number): void {
    this.open += ((open ? 1 : 0) - this.open) * Math.min(1, entryDoorSpeed * delta);
    // Eased at both ends, the way automatic doors start and stop.
    const eased = this.open * this.open * (3 - 2 * this.open);
    const [left, right] = this.panels;
    left.position.x = -this.travel * eased;
    right.position.x = this.travel * eased;
  }
}

/**
 * The way in at the right-hand side of the room: a header with the door sensor and the accent
 * strip, a track, and two clear glass doors lettered "Alyx" and "Labs" that read as one name
 * when shut. Each door slides out over its own side bay, so the whole opening clears.
 */
/** How tall the glass doors are; the header over them takes another 10 cm. */
export const entryDoorHeight = 1.6;

export function buildEntryDoor(piece: Furniture, logo: Texture | null = null): { root: Group; door: EntryDoor } {
  const root = placed(piece);
  const { width } = localSize(piece);
  // Half the footprint is the opening, a quarter on each side is where a door slides to.
  const opening = width / 2;
  const height = entryDoorHeight;
  const frame = standard(palette.inkDeep, 0.5);
  const steel = standard(palette.steel, 0.3, 0.6);
  root.add(
    box(0.06, height + 0.1, 0.1, frame, -width / 2, 0, 0),
    box(0.06, height + 0.1, 0.1, frame, width / 2, 0, 0),
    // The header box over the doors holds the motion sensor, a small dark eye in the middle.
    box(width + 0.06, 0.1, 0.12, frame, 0, height, 0),
    box(0.06, 0.03, 0.01, standard("#1a1a22", 0.3), 0, height + 0.02, 0.065),
    box(width - 0.1, 0.012, 0.012, glow(), 0, height + 0.08, 0.065),
    // The floor track the doors run in, and a mat on the room side.
    box(width, 0.012, 0.05, steel, 0, 0, 0),
  );
  // Kenney's doormat in the room's dark ink, stretched across the opening.
  const mat = kitPiece("rugDoormat", { width: opening + 0.3, height: 0.012, depth: 0.45 }, { wood: palette.inkSoft });
  if (mat !== null) {
    mat.position.z = 0.32;
    root.add(mat);
  } else {
    root.add(box(opening + 0.3, 0.01, 0.45, standard(palette.inkSoft, 0.95), 0, 0, 0.32));
  }
  const glass = new MeshStandardMaterial({
    color: palette.glass,
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  const lettering = (word: "Alyx" | "Labs"): Object3D => {
    const material = new MeshBasicMaterial({
      map: doorLetteringTexture(word, palette.accent),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    // As wide as the door, so the word on each half reaches the seam.
    const plane = mesh(new PlaneGeometry(opening / 2, (opening / 2) * (180 / 512)), material, false);
    // At eye level, just on the room side of the glass.
    plane.position.set(0, 0.95, 0.008);
    return plane;
  };
  const panelWidth = opening / 2;
  /**
   * The logo above the name, centered on the seam: each door carries its own half, so the mark
   * splits down the middle as the doors slide apart.
   */
  const logoSize = 0.16;
  const logoHalf = (side: -1 | 1): Object3D | null => {
    if (logo === null) {
      return null;
    }
    const half = logo.clone();
    half.repeat.set(0.5, 1);
    half.offset.set(side === -1 ? 0 : 0.5, 0);
    half.needsUpdate = true;
    const plane = mesh(
      new PlaneGeometry(logoSize / 2, logoSize),
      new MeshBasicMaterial({ map: half, transparent: true, depthWrite: false, toneMapped: false }),
      false,
    );
    // At the inner edge of this door, on the room side of the glass, above the lettering.
    plane.position.set((-side * panelWidth) / 2 + (side * logoSize) / 4, 1.17, 0.008);
    return plane;
  };
  const door = (side: -1 | 1, word: "Alyx" | "Labs"): Group => {
    const panel = new Group();
    const inner = new Group();
    inner.position.x = (side * panelWidth) / 2;
    const glassPane = mesh(new BoxGeometry(panelWidth - 0.01, height - 0.04, 0.012), glass, false);
    glassPane.position.y = (height - 0.04) / 2 + 0.02;
    inner.add(
      glassPane,
      // Slim rails on the outer edge, top and bottom, so the clear glass still reads as a door.
      box(0.02, height - 0.04, 0.02, steel, (side * (panelWidth - 0.02)) / 2, 0.02, 0),
      box(panelWidth - 0.01, 0.03, 0.02, steel, 0, 0.02, 0),
      box(panelWidth - 0.01, 0.03, 0.02, steel, 0, height - 0.05, 0),
      lettering(word),
    );
    const mark = logoHalf(side);
    if (mark !== null) {
      inner.add(mark);
    }
    // Both halves run in one plane, so the name stays joined from any angle; the panes stop
    // short of the seam, so they never overlap.
    panel.add(inner);
    return panel;
  };
  const left = door(-1, "Alyx");
  const right = door(1, "Labs");
  root.add(left, right);
  return { root, door: new EntryDoor([left, right], panelWidth) };
}

/** How far the fridge door swings: short of 90 degrees, since the hinge side is right by the wall. */
const fridgeOpenAngle = 1.45;
/** Radians per second at full speed; the door eases out and in around that. */
const fridgeSwingRate = 5;

/** The fridge's doors on their hinges. The stage opens them while someone grabs a snack. */
export class FridgeDoor {
  private angle = 0;

  /** `hinge` turns on its left edge; `rightHinge`, a second door turning on its right edge, mirrors it. */
  constructor(
    private readonly hinge: Object3D,
    private readonly rightHinge: Object3D | null = null,
  ) {}

  update(open: boolean, delta: number): void {
    const target = open ? fridgeOpenAngle : 0;
    const step = Math.min(1, fridgeSwingRate * delta);
    this.angle += (target - this.angle) * step;
    // Negative yaw swings a door hinged on its left edge outward, toward the person in front.
    this.hinge.rotation.y = -this.angle;
    if (this.rightHinge !== null) {
      this.rightHinge.rotation.y = this.angle;
    }
  }
}

export function buildFridge(piece: Furniture): { root: Group; door: FridgeDoor } {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  // Kenney's double-door fridge at 1.32 m, a little over the team's heads, its back to the wall.
  // Fitted uniformly so the left door, which the snack run opens, turns without shearing.
  const kit = kitPiece("kitchenFridgeLarge", { height: 1.32 }, { metalLight: palette.steel, metalMedium: palette.ink });
  const kitDoor = kit?.getObjectByName("doorLeft");
  if (kit !== null && kitDoor !== undefined) {
    kit.position.z = -(depth - kitSize(kit).z) / 2;
    root.add(kit);
    const rightDoor = kit.getObjectByName("doorRight") ?? null;
    stockFridge(kit, kitDoor, rightDoor);
    return { root, door: new FridgeDoor(kitDoor, rightDoor) };
  }
  const body = standard(palette.steel, 0.35, 0.4);
  // A tall fridge at the team's scale (they stand 1.2 m): a little over head height, as a real
  // one stands over an adult.
  const height = 1.32;
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
    box(0.02, 0.28, 0.03, standard(palette.ink, 0.4), doorWidth - 0.07, height * 0.34, 0.035),
  );
  root.add(hinge);
  return { root, door: new FridgeDoor(hinge) };
}

/**
 * Kenney's fridge is one open cavity behind its two doors. In the kit's own units: inside walls
 * at x 0.027 and 0.493, floor at y 0.087, a fixed shelf at 0.69 to 0.717 and the roof at 0.893,
 * back wall at z -0.31 and the opening at z 0.
 */
const fridgeCavity = { left: 0.027, right: 0.493, floor: 0.087, shelf: 0.717, back: -0.31 } as const;

/**
 * Glass shelves and the week's groceries inside the kit fridge, and a bin of drinks on the inside
 * of each door, so it is stocked when the doors swing open. Placed in the kit's units, under the
 * same scale as the fridge.
 */
function stockFridge(kit: Group, leftDoor: Object3D, rightDoor: Object3D | null): void {
  const model = kit.children[0];
  if (model === undefined) {
    return;
  }
  // Food sizes are meters in the room; the kit is scaled up to fit the fridge's height.
  const toKit = 1 / model.scale.x;
  const food = (name: FoodModelName, x: number, y: number, z: number, turn = 0): void => {
    const piece = foodModel(name, kitScale * roomScale * toKit);
    piece.position.set(x, y, z);
    piece.rotation.y = turn;
    model.add(piece);
  };
  const shelfGlass = standard("#dfeaf2", 0.15);
  const width = fridgeCavity.right - fridgeCavity.left;
  const middle = (fridgeCavity.left + fridgeCavity.right) / 2;
  // Short of the opening, clear of the door bins when the doors shut.
  const depth = -fridgeCavity.back - 0.06;
  const shelfZ = fridgeCavity.back + depth / 2;
  const lowShelf = 0.31;
  const highShelf = 0.5;
  for (const y of [lowShelf, highShelf]) {
    model.add(box(width, 0.006, depth, shelfGlass, middle, y, shelfZ));
  }
  // A cool light strip under the fixed shelf, lighting the contents from above.
  model.add(box(width * 0.7, 0.006, 0.02, glow("#eef6ff", 0.9), middle, fridgeCavity.shelf - 0.034, shelfZ));
  const front = -0.1;
  // Bottom: fruit and cheese.
  food("grapes", 0.09, fridgeCavity.floor, front);
  food("cheese-block", 0.21, fridgeCavity.floor, front, 0.4);
  food("apple", 0.33, fridgeCavity.floor, front + 0.02);
  food("apple", 0.37, fridgeCavity.floor, front - 0.05);
  food("orange", 0.43, fridgeCavity.floor, front + 0.01);
  // Middle: milk and puddings.
  food("milk", 0.08, lowShelf + 0.006, front - 0.05);
  food("milk", 0.15, lowShelf + 0.006, front - 0.08, 0.3);
  food("pudding", 0.27, lowShelf + 0.006, front);
  food("pudding", 0.33, lowShelf + 0.006, front - 0.03);
  food("soda-bottle", 0.42, lowShelf + 0.006, front - 0.06);
  // Top: drinks and leftovers; ice cream on the fixed shelf.
  food("soda-bottle", 0.07, highShelf + 0.006, front - 0.07);
  food("soda-bottle", 0.12, highShelf + 0.006, front - 0.07);
  food("carton", 0.3, highShelf + 0.006, front, -0.3);
  food("orange", 0.42, highShelf + 0.006, front);
  food("ice-cream-cup", 0.12, fridgeCavity.shelf, front - 0.04);
  food("ice-cream-cup", 0.35, fridgeCavity.shelf, front - 0.06);
  // A shallow bin on the inside of each door, its drinks standing in it. The door's inside face
  // is at z -0.04 in its own frame; the bin hangs in from there.
  const binMaterial = standard("#e8eef2", 0.3);
  const doorBin = (door: Object3D, from: number, to: number, drinks: readonly number[]): void => {
    for (const y of [-0.22, 0.08]) {
      door.add(box(to - from, 0.03, 0.05, binMaterial, (from + to) / 2, y, -0.065));
      for (const x of drinks) {
        const bottle = foodModel("soda-bottle", kitScale * roomScale * toKit * 0.8);
        bottle.position.set(x, y + 0.004, -0.065);
        door.add(bottle);
      }
    }
  };
  doorBin(leftDoor, 0.02, 0.17, [0.06, 0.12]);
  if (rightDoor !== null) {
    doorBin(rightDoor, -0.25, -0.02, [-0.2, -0.13, -0.07]);
  }
}

/** A compact rack, chest-to-head height for the team: Yor checks the lights at eye level. */
export function buildServerRack(piece: Furniture): { root: Group; lights: RackLights } {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  // A full-height rack at the room's scale, about 0.73 of life size like everything else here.
  const height = 1.4;
  // "Server Rack" by Spellkaze (CC-BY-4.0); the status lights are the office's own, on its front.
  const model = kitPiece("serverRack", { width: width - 0.1, height, depth: depth - 0.1 });
  root.add(model ?? box(width - 0.1, height, depth - 0.1, standard(palette.inkDeep, 0.5, 0.2), 0, 0, 0));
  const lights: { mesh: ReturnType<typeof box>; material: MeshStandardMaterial }[] = [];
  const front = (depth - 0.1) / 2;
  for (let unit = 0; unit < 6; unit++) {
    const y = 0.14 + unit * 0.2;
    if (model === null) {
      root.add(box(width - 0.16, 0.14, 0.02, standard(palette.ink, 0.4, 0.3), 0, y, front));
    }
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

/** Arcade cabinet height at the office's scale: controls at hand height, screen at eye height. */
const arcadeHeight = 1.32;

/**
 * The arcade models: how each is turned to face +z, which part is the glass the game shows on,
 * and the parts left out (the Pac-Man model's own sprites would sit over the office's game).
 */
const arcadeModels = {
  // "Pacman Arcade + animation" by Daniel Brück, CC-BY-4.0, in the repo.
  pacman: { yaw: 0, glass: "scheibe", hide: ["pacman_", "mouth_", "ghost"] },
  // "Arcade Cabinet Elben Quest" by iceboxX708, CC-BY-NC-4.0: only from the user's own models/.
  elben: { yaw: Math.PI / 2, glass: "ArcadeMachine_Glass", hide: [] },
} as const;
export type ArcadeModel = keyof typeof arcadeModels;

/**
 * An arcade model fitted to the cabinet height and turned to face the player, the office's game
 * on a plane laid over its glass at the glass's own tilt.
 */
function modelArcade(model: Object3D, kind: ArcadeModel, screen: ArcadeScreen): Group {
  const spec = arcadeModels[kind];
  const holder = fitModel(model, { height: arcadeHeight });
  holder.rotation.y = spec.yaw;
  const cabinet = new Group();
  cabinet.add(holder);
  cabinet.updateMatrixWorld(true);
  let glass: Box3 | null = null;
  cabinet.traverse((part) => {
    if (spec.hide.some((prefix: string) => part.name.startsWith(prefix))) {
      part.visible = false;
    } else if (glass === null && part instanceof Mesh && part.name.startsWith(spec.glass)) {
      glass = new Box3().setFromObject(part);
    }
  });
  const bounds: Box3 = glass ?? new Box3().setFromObject(cabinet);
  const size = bounds.getSize(new Vector3());
  // The glass leans back: bottom edge at the front, top edge further back.
  const tilt = Math.atan2(size.z, size.y);
  const display = mesh(new PlaneGeometry(size.x * 0.9, Math.hypot(size.y, size.z) * 0.9), unlit(screen.texture), false);
  const center = bounds.getCenter(new Vector3());
  display.position.set(center.x, center.y + 0.006 * Math.sin(tilt), center.z + 0.006 * Math.cos(tilt));
  display.rotation.x = -tilt;
  cabinet.add(display);
  return cabinet;
}

/**
 * One of the two arcade cabinets. The first is the Pac-Man model; the second is built here
 * until the user's own Elben Quest model loads, which then takes its place.
 */
export class ArcadeCabinet {
  readonly root: Group;
  readonly screen: ArcadeScreen;
  private body: Group;

  constructor(piece: Furniture) {
    this.root = placed(piece);
    // The pair runs two different games, so they never show the same frame side by side.
    this.screen = new ArcadeScreen(piece.id === "arcade" ? "shooter" : "breakout");
    const pacman = piece.id === "arcade" ? furnitureModel("arcadePacman") : null;
    this.body = pacman === null ? codeArcade(piece, this.screen) : modelArcade(pacman, "pacman", this.screen);
    this.root.add(this.body);
  }

  /** Swaps the cabinet for a model that arrived after the room was built. */
  useModel(model: Object3D, kind: ArcadeModel): void {
    const next = modelArcade(model, kind, this.screen);
    this.root.remove(this.body);
    this.body = next;
    this.root.add(next);
  }
}

/** The arcade cabinet built from boxes, for when no model is there. */
function codeArcade(piece: Furniture, screen: ArcadeScreen): Group {
  const { width, depth } = localSize(piece);
  const cabinet = new Group();
  const body = standard(palette.ink, 0.55);
  const cabinetWidth = width - 0.16;
  // Controls at a standing player's hands and the top at about 1.3 m, at the room's 0.73 scale.
  const panelTop = 0.68;
  const screenBox = 0.5;
  cabinet.add(
    box(cabinetWidth, panelTop, depth * 0.7, body, 0, 0, -depth * 0.05),
    box(cabinetWidth, screenBox, depth * 0.45, body, 0, panelTop, -depth * 0.18),
    box(cabinetWidth, 0.14, depth * 0.5, body, 0, panelTop + screenBox, -depth * 0.15),
    // Marquee: the brightest accent in the room, the arcade's whole reason to exist is to call you over.
    box(cabinetWidth - 0.04, 0.12, 0.02, glow(palette.accent, 2), 0, panelTop + screenBox + 0.01, depth * 0.1),
    box(cabinetWidth, 0.04, depth * 0.36, standard(palette.inkSoft, 0.5), 0, panelTop - 0.02, depth * 0.24),
  );
  const display = mesh(new PlaneGeometry(cabinetWidth - 0.1, 0.38), unlit(screen.texture), false);
  // Tilted back like a real cabinet's glass, and stood far enough out from the screen box that
  // its top edge stays in front of the box instead of sinking into it.
  const tilt = 0.18;
  const screenBoxFront = -depth * 0.18 + (depth * 0.45) / 2;
  display.position.set(0, panelTop + 0.26, screenBoxFront + 0.19 * Math.sin(tilt) + 0.006);
  display.rotation.x = -tilt;
  // A thin lit bezel around the glass, so the screen reads as a screen in a dark cabinet.
  const bezel = new Group();
  const lit = glow(palette.accent, 0.9);
  const glassWidth = cabinetWidth - 0.1;
  bezel.add(
    box(glassWidth + 0.02, 0.008, 0.004, lit, 0, 0.19, -0.002),
    box(glassWidth + 0.02, 0.008, 0.004, lit, 0, -0.198, -0.002),
    box(0.008, 0.38, 0.004, lit, -glassWidth / 2 - 0.006, -0.19, -0.002),
    box(0.008, 0.38, 0.004, lit, glassWidth / 2 + 0.006, -0.19, -0.002),
  );
  bezel.position.copy(display.position);
  bezel.rotation.copy(display.rotation);
  cabinet.add(display, bezel);
  const stick = mesh(new CylinderGeometry(0.008, 0.008, 0.05, 6), standard(palette.ink, 0.4));
  stick.position.set(-0.1, panelTop + 0.045, depth * 0.27);
  const knob = mesh(new SphereGeometry(0.018, 10, 8), glow(palette.accent, 0.8));
  knob.position.set(-0.1, panelTop + 0.075, depth * 0.27);
  cabinet.add(stick, knob);
  for (let button = 0; button < 3; button++) {
    const cap = mesh(
      new CylinderGeometry(0.014, 0.014, 0.012, 12),
      standard(button === 0 ? palette.accent : palette.laminate, 0.4),
    );
    cap.position.set(0.03 + button * 0.05, panelTop + 0.026, depth * 0.27);
    cabinet.add(cap);
  }
  return cabinet;
}

/** TV centered at seated eye height for the sofa, on a low console. */
export function buildTvWall(piece: Furniture): { root: Group; screen: TvScreen } {
  const root = placed(piece);
  const screen = new TvScreen();
  const standing = modelTv(screen);
  if (standing !== null) {
    root.add(standing);
    return { root, screen };
  }
  const width = 1.15;
  const height = width * (9 / 16);
  const centerY = people.seatedEye + 0.08;
  root.add(
    box(width + 0.05, height + 0.05, 0.04, standard(palette.inkDeep, 0.3, 0.2), 0, centerY - height / 2 - 0.025, 0),
  );
  const display = mesh(new PlaneGeometry(width, height), unlit(screen.texture), false);
  display.position.set(0, centerY, 0.025);
  root.add(display);
  return { root, screen };
}

/** From the wall to the middle of the TV console's top, and the top's height. */
const tvConsoleTop = { z: 0.23, y: 0.33 } as const;

/**
 * Kenney's modern TV on its own stand, on the middle of the console in front of the wall, the
 * same 1.15 m wide as the wall-hung one it replaces. The feed goes on its screen face, found from
 * the screen's own part of the model. Null when the model did not load.
 */
function modelTv(screen: TvScreen): Group | null {
  const width = 1.15;
  const tv = kitPiece("televisionModern", { height: (width / 0.685) * 0.455 });
  if (tv === null) {
    return null;
  }
  tv.position.set(0, tvConsoleTop.y, tvConsoleTop.z);
  tv.updateMatrixWorld(true);
  // The lighter "metal" part of the kit TV is its screen.
  let face: Box3 | null = null;
  tv.traverse((part) => {
    if (part instanceof Mesh && !Array.isArray(part.material) && part.material.name === "metal") {
      face = new Box3().setFromObject(part);
    }
  });
  const holder = new Group();
  holder.add(tv);
  const bounds: Box3 = face ?? new Box3().setFromObject(tv);
  const size = bounds.getSize(new Vector3());
  const display = mesh(new PlaneGeometry(size.x * 0.96, size.y * 0.94), unlit(screen.texture), false);
  display.position.set(0, (bounds.min.y + bounds.max.y) / 2, bounds.max.z + 0.003);
  holder.add(display);
  return holder;
}

export function buildTvConsole(piece: Furniture): Group {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  // Kenney's TV cabinet in the room's oak, with the console box and its light on top.
  const kit = kitPiece(
    "cabinetTelevision",
    { width: width - 0.1, height: 0.33, depth: depth - 0.1 },
    { wood: palette.oak },
  );
  root.add(
    kit ?? box(width - 0.1, 0.33, depth - 0.1, standard(palette.oak, 0.7), 0, 0, 0),
    box(width - 0.14, 0.012, 0.01, glow(), 0, 0.04, (depth - 0.1) / 2 + 0.005),
    box(0.22, 0.05, 0.16, standard(palette.inkDeep, 0.3, 0.2), -0.45, 0.33, 0),
    box(0.01, 0.01, 0.01, glow(), -0.37, 0.36, 0.081),
  );
  // A pair of Kenney's small speakers at the console's ends, either side of the TV.
  for (const side of [-1, 1]) {
    const speaker = kitPiece("speakerSmall", { height: 0.24 }, { wood: palette.ink, metalMedium: palette.inkSoft });
    if (speaker !== null) {
      speaker.position.set(side * ((width - 0.1) / 2 - 0.1), 0.33, 0);
      root.add(speaker);
    }
  }
  return root;
}

export function buildRug(piece: Furniture, color: string = palette.rug, inner = "#cfc5b6"): Group {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const rug = box(width, 0.012, depth, standard(color, 1), 0, 0, 0);
  rug.castShadow = false;
  const border = box(width - 0.2, 0.013, depth - 0.2, standard(inner, 1), 0, 0, 0);
  border.castShadow = false;
  root.add(rug, border);
  return root;
}

export function buildCoffeeTable(piece: Furniture): Group {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const top = surface.coffeeTable;
  const legs = standard(palette.ink, 0.5);
  const kit = kitPiece("tableCoffee", { width, height: top, depth }, { wood: palette.oak });
  if (kit !== null) {
    root.add(kit);
  } else {
    root.add(box(width, 0.035, depth, standard(palette.oak, 0.6), 0, top - 0.035, 0));
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      root.add(box(0.035, top - 0.035, 0.035, legs, x * (width / 2 - 0.05), 0, z * (depth / 2 - 0.05)));
    }
  }
  root.add(box(0.14, 0.025, 0.07, standard(palette.inkDeep, 0.4), -0.1, top, -0.15));
  return root;
}

/**
 * The Kenney decor pieces: a floor lamp whose shade glows warm, and a standing coat rack. Empty
 * when the kit did not load.
 */
export function buildKitDecor(piece: Furniture): Group {
  const root = placed(piece);
  if (piece.kind === "floor-lamp") {
    // 1.2 m: a 1.6 m reading lamp at the room's scale, its shade lit.
    const lamp = kitPiece("lampRoundFloor", { height: 1.2 }, { metal: palette.ink, lamp: "#ffe9c4" });
    if (lamp !== null) {
      root.add(lamp);
    }
  } else if (piece.kind === "coat-rack") {
    const rack = kitPiece("coatRackStanding", { height: 1.25 }, { wood: palette.oak });
    if (rack !== null) {
      root.add(rack);
    }
  }
  return root;
}

/** Potted plant: a ceramic pot and a loose cluster of leaves, sized from the footprint. */
export function buildPlant(piece: Furniture): Group {
  const root = placed(piece);
  const radius = Math.min(piece.width, piece.depth) / 2;
  // Kenney's potted plant, as tall as the pot's footprint allows: 0.85 m from a 0.5 m spot.
  const kit = kitPiece(
    "pottedPlant",
    { height: radius * 3.4 },
    {
      wood: palette.pot,
      woodDark: palette.ink,
      plant: palette.leaf,
    },
  );
  if (kit !== null) {
    root.add(kit);
    return root;
  }
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

/** Ring light with the ring at eye height, where it would actually light a face. */
export function buildRingLight(piece: Furniture): Group {
  const root = placed(piece);
  const ink = standard(palette.ink, 0.5);
  const ringY = people.eye;
  // "Ring Light" by ahmagh2e (CC-BY-4.0): its ring's middle is 0.88 of its height up. The model's
  // ring faces along x, so it is turned a quarter round to face the piece's front like the old one.
  const model = kitPiece("ringLight", { height: ringY / 0.88 });
  if (model !== null) {
    model.rotation.y = Math.PI / 2;
    const lit = glow("#fff3e6", 1.2);
    model.traverse((part) => {
      if (part instanceof Mesh && !Array.isArray(part.material) && part.material.name === "Mat.1_1") {
        part.material = lit;
      }
    });
    root.add(model);
    return root;
  }
  // Three splayed feet like a real light stand, about 0.55 m across at the room's scale.
  root.add(box(0.02, ringY - 0.15, 0.02, ink, 0, 0, 0));
  for (let foot = 0; foot < 3; foot++) {
    const leg = box(0.27, 0.015, 0.02, ink, 0.135, 0, 0);
    const turn = new Group();
    turn.rotation.y = (foot / 3) * Math.PI * 2;
    turn.add(leg);
    root.add(turn);
  }
  // Warm white, not the accent: a ring light's job is lighting faces. About 0.33 m across (18 in).
  const ring = mesh(new TorusGeometry(0.15, 0.018, 8, 36), glow("#fff3e6", 1.2));
  ring.position.y = ringY;
  root.add(ring);
  return root;
}

/** Camera on a tripod with the lens at seated eye height, framing Ruby at her desk. */
export function buildCameraTripod(piece: Furniture): Group {
  const root = placed(piece);
  const ink = standard(palette.ink, 0.5);
  const headY = people.seatedEye - 0.04;
  // "Camera With Tripod" by FatWasHere (CC-BY-4.0): the camera sits 0.945 of the way up and its
  // lens points along -x, so it is turned a quarter round to point it at the piece's front.
  const model = kitPiece("cameraTripod", { height: headY / 0.945 });
  if (model !== null) {
    model.rotation.y = Math.PI / 2;
    root.add(model, box(0.012, 0.012, 0.008, glow(palette.accent, 1.8), 0.04, headY + 0.07, 0.03));
    return root;
  }
  const head = new Vector3(0, headY, 0);
  const up = new Vector3(0, 1, 0);
  for (let leg = 0; leg < 3; leg++) {
    const angle = (leg / 3) * Math.PI * 2;
    // Legs spread about 0.5 m, as a real tripod stands.
    const foot = new Vector3(Math.sin(angle) * 0.25, 0, Math.cos(angle) * 0.25);
    const length = head.distanceTo(foot);
    const rod = mesh(new CylinderGeometry(0.009, 0.009, length, 6), ink);
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
  const height = 1.5;
  root.add(box(width, height, 0.05, ink, 0, 0, 0), box(width, 0.018, 0.06, glow(), 0, height - 0.02, 0));
  // The name stays inside the panel, above a seated head, whatever the team's height.
  const bandY = height - 0.24;
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
/** Radians the lid turns from upright to folded shut over the keys. */
const lidClosedAngle = Math.PI / 2 - 0.03;
const lidOpenAngle = -0.12;

/** What a meeting laptop shows: nothing (nobody brought one), or one brought to this seat. */
export interface MeetingLaptopView {
  /** 0 closed to 1 open. */
  lid: number;
  screenOn: boolean;
  /** The shell color of the laptop the member brought. */
  shell: string;
}

/**
 * The laptop someone brought to a meeting seat: set down shut, opened, switched on, and closed
 * again before they take it away. Hidden while the seat has none.
 */
export class MeetingLaptop {
  constructor(
    readonly root: Group,
    private readonly lid: Group,
    private readonly shell: MeshStandardMaterial,
    private readonly screen: LaptopScreen,
  ) {}

  update(delta: number, view: MeetingLaptopView | null): void {
    this.root.visible = view !== null;
    this.screen.update(delta, view?.screenOn === true ? "on" : "off");
    if (view === null) {
      return;
    }
    this.shell.color.set(view.shell);
    this.lid.rotation.x = lidClosedAngle + (lidOpenAngle - lidClosedAngle) * view.lid;
  }
}

export function buildMeetingTable(
  piece: Furniture,
  laptopSpots: readonly { x: number; z: number; yaw: number }[],
): { root: Group; laptops: MeetingLaptop[]; lunchBoxes: Group[] } {
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
  // One per chair, each turned so its keys face the chair it belongs to.
  const laptops = laptopSpots.map(({ x, z, yaw }, index) => {
    const screen = new LaptopScreen(index + 1);
    const laptop = new Group();
    const shell = standard("#d9d4cc", 0.5);
    // The lid turns on a hinge along the back edge of the keys.
    const lid = new Group();
    lid.position.set(0, top + 0.012, -0.085);
    const fromModel = laptopShell("laptop", { width: 0.26, depth: 0.18, baseHeight: 0.012 }, shell);
    if (fromModel !== null) {
      fromModel.base.position.set(0, top, -0.085);
      laptop.add(fromModel.base);
      lid.add(fromModel.lid);
      const panel = mesh(
        new PlaneGeometry(0.235, Math.min(0.15, fromModel.lidHeight * 0.8)),
        unlit(screen.texture),
        false,
      );
      panel.position.set(0, fromModel.lidHeight * 0.52, fromModel.screenZ + 0.001);
      lid.add(panel);
    } else {
      laptop.add(box(0.26, 0.012, 0.18, shell, 0, top, 0));
      lid.add(box(0.26, 0.17, 0.01, shell, 0, 0, -0.005));
      const panel = mesh(new PlaneGeometry(0.24, 0.15), unlit(screen.texture), false);
      panel.position.set(0, 0.085, 0.001);
      lid.add(panel);
    }
    laptop.add(lid);
    laptop.position.set(x, 0, z);
    laptop.rotation.y = yaw;
    laptop.visible = false;
    root.add(laptop);
    return new MeetingLaptop(laptop, lid, shell, screen);
  });
  // Between the laptops: a printout. Mugs are everyone's own now, so none is left lying here.
  root.add(box(0.14, 0.004, 0.2, standard("#fbfaf7", 0.9), 0.33, top, 0));
  // A lunch box for each chair, set out while someone eats there.
  const lunchBoxes = laptopSpots.map(({ x, z, yaw }) => {
    const lunch = lunchBox(top);
    lunch.position.set(x, 0, z);
    lunch.rotation.y = yaw;
    lunch.visible = false;
    root.add(lunch);
    return lunch;
  });
  return { root, laptops, lunchBoxes };
}

/**
 * An open bento: rice on one side, salmon, egg and greens on the other. Near the table's edge, in
 * easy reach of the chopsticks from the chair, where a laptop would sit further in.
 */
function lunchBox(top: number): Group {
  const lunch = new Group();
  const z = 0.13;
  lunch.add(
    box(0.13, 0.03, 0.09, standard(palette.inkDeep, 0.5), 0, top, z),
    box(0.058, 0.006, 0.078, standard("#f7f3ea", 0.9), -0.03, top + 0.026, z),
    box(0.03, 0.012, 0.03, standard("#f2a65a", 0.7), 0.03, top + 0.026, z - 0.018),
    box(0.024, 0.01, 0.022, standard("#f2c94c", 0.7), 0.026, top + 0.026, z + 0.022),
    box(0.016, 0.012, 0.02, standard(palette.leaf, 0.8), 0.05, top + 0.026, z + 0.02),
  );
  return lunch;
}

/** The low step along a board: oak top, dark sides, a thin glow along its front edge. */
export function buildBoardStep(piece: Furniture, height: number): Group {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  root.add(
    box(width, height - 0.02, depth, standard(palette.ink, 0.6), 0, 0, 0),
    box(width, 0.02, depth, standard(palette.oak, 0.55), 0, height - 0.02, 0),
    box(width - 0.06, 0.008, 0.008, glow(palette.accent, 1.2), 0, height - 0.04, depth / 2 + 0.002),
  );
  return root;
}

/** Ping-pong table at the office's scale: ink top with white lines and a net, accent paddles at each end. */
/** The ping-pong model's own height and play surface, so its top lands on the office's table height. */
const pingpongModel = { height: 0.903, top: 0.76 } as const;

export function buildPingpongTable(piece: Furniture): Group {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const top = surface.pingpong;
  // "ping pong" by alixor22 (CC-BY-4.0), scaled as a whole so its top is the office's table height;
  // at that scale it is 2.0 by 1.1 m, the table's own footprint, so the ball's bounces still land.
  const model = kitPiece("pingpong", { height: (pingpongModel.height / pingpongModel.top) * top });
  if (model !== null) {
    root.add(model);
    return root;
  }
  const ink = standard(palette.ink, 0.6);
  root.add(
    box(width, 0.03, depth, standard(palette.inkSoft, 0.5), 0, top - 0.03, 0),
    box(width, 0.004, 0.012, standard("#ffffff", 0.6), 0, top, 0),
    box(0.012, 0.004, depth, standard("#ffffff", 0.6), -width / 2 + 0.006, top, 0),
    box(0.012, 0.004, depth, standard("#ffffff", 0.6), width / 2 - 0.006, top, 0),
    // A real net, 15 cm high and past the table edges, at the room scale.
    box(0.012, 0.11, depth + 0.2, standard("#f4f1ec", 0.8), 0, top, 0),
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
  root.add(box(width - 0.04, cabinetHeight, depth - 0.06, standard(palette.ink, 0.6), 0, 0, 0));
  // "Printer- Low Poly" by CG Buzz (CC-BY-4.0), as wide as the cabinet top allows.
  const printer = kitPiece("printer", { height: (0.155 / 0.459) * (width - 0.06) });
  if (printer !== null) {
    printer.position.y = cabinetHeight;
    root.add(printer);
    return root;
  }
  root.add(
    // An office printer at the room's scale: about 0.3 m a side and 0.17 tall.
    box(width - 0.08, 0.17, 0.3, standard(palette.laminate, 0.5), 0, cabinetHeight, 0),
    box(width - 0.14, 0.015, 0.1, standard("#fbfaf7", 0.9), 0, cabinetHeight + 0.17, 0.04),
    box(0.012, 0.012, 0.01, glow(), width / 2 - 0.09, cabinetHeight + 0.14, 0.155),
  );
  return root;
}

/** Spine colors for the books: muted cloth and paper tones with the odd bright paperback. */
const spineColors = ["#7a2e3a", "#2f4b6e", "#3e5e3a", "#c9a46a", "#5b3f78", "#d9d4cc", "#a8573a", "#22313f", "#e2b33c"];

/** Shelf height in the room: chest high on the members. */
const bookshelfHeight = 0.95;
/** The Furniture Kit's wide bookcase in its own units: 0.8 wide, 0.79 tall, 0.25 deep, front at +Z. */
const kitBookcase = {
  width: 0.8,
  height: 0.79,
  depth: 0.25,
  shelves: [0.07, 0.31, 0.55],
  inner: [0.04, 0.76],
} as const;
/** The kit's cluster of books in its own units, spines toward +Z. */
const kitBooks = { width: 0.15, height: 0.104, depth: 0.095 };

/** One material per cover color, shared by every cluster that uses it. */
const coverMaterials = new Map<string, MeshStandardMaterial>();

/** The kit's maroon and green covers swapped for two of the spine colors, picked by the cluster's place. */
function recolorBooks(cluster: Object3D, index: number): void {
  const covers: Record<string, string | undefined> = {
    carpetDarker: spineColors[(index * 4) % spineColors.length],
    plant: spineColors[(index * 7 + 2) % spineColors.length],
  };
  cluster.traverse((part) => {
    if (!(part instanceof Mesh)) {
      return;
    }
    const materials: Material[] = Array.isArray(part.material) ? part.material : [part.material];
    const swapped = materials.map((material) => {
      const color = covers[material.name];
      if (color === undefined) {
        return material;
      }
      let cover = coverMaterials.get(color);
      if (cover === undefined) {
        cover = standard(color, 0.85);
        coverMaterials.set(color, cover);
      }
      return cover;
    });
    part.material = Array.isArray(part.material) ? swapped : (swapped[0] ?? part.material);
  });
}

/**
 * Chest-high shelves against a wall, from two of the Furniture Kit's wide bookcases side by side,
 * three tiers of books with the odd gap. Each cluster of books can be taken off and put back; a
 * taken one leaves its gap. Without the kit's models, a plain oak frame with single books stands in.
 */
export class Bookshelf {
  readonly root: Group;
  readonly books: Object3D[] = [];
  /** Where a hand takes hold of each book, in that book's own frame. */
  private readonly grips: Vector3[] = [];

  constructor(piece: Furniture) {
    this.root = placed(piece);
    const { width, depth } = localSize(piece);
    const bookcase = furnitureModel("bookcase");
    const books = furnitureModel("books");
    if (bookcase !== null && books !== null) {
      this.fromKit(width, depth, bookcase);
    } else {
      this.fromBoxes(width, depth);
    }
  }

  private fromKit(width: number, depth: number, first: Object3D): void {
    const units = 2;
    const sx = width / units / kitBookcase.width;
    const sy = bookshelfHeight / kitBookcase.height;
    const sz = depth / kitBookcase.depth;
    for (let unit = 0; unit < units; unit++) {
      const bookcase = unit === 0 ? first : furnitureModel("bookcase");
      if (bookcase === null) {
        continue;
      }
      bookcase.scale.set(sx, sy, sz);
      // The kit's origin is the back left corner on the floor; the front lands on the room side.
      bookcase.position.set(-width / 2 + (unit * width) / units, 0, depth / 2);
      this.root.add(bookcase);
    }
    // Books a little taller than the kit's, to fill a tier the way real ones do.
    const bookScale = 0.2 / kitBooks.height;
    const clusterWidth = kitBooks.width * bookScale;
    // A fixed layout per tier and unit: where each cluster starts across the inner width, 0..1,
    // with a skipped slot here and there for the gaps.
    // Two clusters only fit side by side when the second starts a whole cluster width after the
    // first: about 0.75 of the free span at this size.
    const layout: readonly (readonly number[])[] = [[0, 0.8], [0.15], [0.02, 1], [0.05, 0.85], [0.45], [0, 0.9]];
    const innerFrom = kitBookcase.inner[0] * sx;
    const innerWidth = (kitBookcase.inner[1] - kitBookcase.inner[0]) * sx - clusterWidth;
    let slot = 0;
    for (const shelf of kitBookcase.shelves) {
      for (let unit = 0; unit < units; unit++) {
        const unitLeft = -width / 2 + (unit * width) / units;
        for (const along of layout[slot % layout.length] ?? []) {
          const cluster = furnitureModel("books");
          if (cluster === null) {
            continue;
          }
          cluster.scale.setScalar(bookScale);
          // The kit has one cluster; other covers and every other one turned round keep the
          // shelves from looking stamped.
          const index = this.books.length;
          recolorBooks(cluster, index);
          if (index % 2 === 1) {
            cluster.scale.x = -bookScale;
          }
          const holder = new Group();
          // The holder sits at the cluster's front bottom middle, so the grip is easy to name.
          holder.position.set(
            unitLeft + innerFrom + along * innerWidth + clusterWidth / 2,
            shelf * sy,
            depth / 2 - 0.03,
          );
          cluster.position.set(index % 2 === 1 ? clusterWidth / 2 : -clusterWidth / 2, 0, 0);
          holder.add(cluster);
          this.root.add(holder);
          this.books.push(holder);
          this.grips.push(new Vector3(0, kitBooks.height * bookScale * 0.55, 0));
        }
        slot++;
      }
    }
  }

  /** The stand-in: an oak frame, a dark back and single books with the odd gap and a leaning one. */
  private fromBoxes(width: number, depth: number): void {
    const height = bookshelfHeight;
    const oak = standard(palette.oak, 0.65);
    const back = standard(palette.inkDeep, 0.8);
    const side = 0.03;
    const tiers = [0.04, 0.34, 0.64];
    this.root.add(
      box(width, height, 0.02, back, 0, 0, -depth / 2 + 0.01),
      box(side, height, depth, oak, -width / 2 + side / 2, 0, 0),
      box(side, height, depth, oak, width / 2 - side / 2, 0, 0),
      box(width, 0.03, depth, oak, 0, height - 0.03, 0),
      box(width - 2 * side, 0.04, depth, oak, 0, 0, 0),
      ...tiers.slice(1).map((y) => box(width - 2 * side, 0.025, depth, oak, 0, y - 0.025, 0)),
    );
    // A fixed pattern, so every visit shows the same shelves.
    let seed = 7;
    const next = (): number => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (const floor of tiers) {
      let x = -width / 2 + side + 0.02;
      const end = width / 2 - side - 0.02;
      while (x < end - 0.05) {
        if (next() < 0.08) {
          // A gap, as on any real shelf.
          x += 0.06 + next() * 0.08;
          continue;
        }
        const thick = 0.022 + next() * 0.026;
        const tall = 0.19 + next() * 0.07;
        const book = box(
          thick,
          tall,
          0.19 + next() * 0.04,
          standard(spineColors[Math.floor(next() * spineColors.length)] ?? "#7a2e3a", 0.85),
          0,
          0,
          0,
        );
        const holder = new Group();
        holder.position.set(x + thick / 2, floor, depth / 2 - 0.13);
        if (next() < 0.06 && x + thick + 0.05 < end) {
          // Leaning on its neighbor.
          holder.rotation.z = -0.25;
          x += 0.05;
        }
        holder.add(book);
        this.root.add(holder);
        this.books.push(holder);
        this.grips.push(new Vector3(0, 0.11, 0.1));
        x += thick + 0.002;
      }
    }
  }

  /** Off the shelf or back on it. */
  setTaken(index: number, taken: boolean): void {
    const book = this.books[index];
    if (book !== undefined) {
      book.visible = !taken;
    }
  }

  /** Where a hand takes hold of a book: the middle of its spine, in the room. */
  spineOf(index: number): Vector3 | null {
    const book = this.books[index];
    const grip = this.grips[index];
    return book === undefined || grip === undefined ? null : book.localToWorld(grip.clone());
  }
}

/**
 * The reading corner's armchair: Kenney's lounge chair, its cushion at half its height like the
 * sofa's, so fitted to twice the seat height the seat lands on the station's.
 */
export function buildLoungeChair(piece: Furniture, seatHeight: number): BuiltPiece {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const kit = kitPiece(
    "loungeChair",
    { width, height: seatHeight * 2, depth },
    { carpet: palette.fabric, wood: palette.ink },
  );
  if (kit !== null) {
    root.add(kit);
  } else {
    const body = standard(palette.fabric, 0.95);
    root.add(
      box(width, seatHeight, depth, body, 0, 0, 0),
      box(width, seatHeight * 2, 0.14, body, 0, 0, -depth / 2 + 0.07),
    );
  }
  return {
    root,
    hairColliders: [
      ...panelColliders(root, width - 0.2, -depth / 2 + 0.08, seatHeight, seatHeight * 2, 0.08),
      ...seatColliders(root, width - 0.2, seatHeight - 0.05, depth / 2 - 0.1, -depth / 2 + 0.2, 0.05),
    ],
  };
}

/** A small side table by the armchair, with the book the last reader left on it. */
export function buildSideTable(piece: Furniture): Group {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const top = 0.36;
  const kit = kitPiece("sideTable", { width, height: top, depth }, { wood: palette.oak });
  root.add(kit ?? box(width, top, depth, standard(palette.oak, 0.6), 0, 0, 0));
  const book = box(0.15, 0.025, 0.11, standard("#2f4b6e", 0.8), 0.02, top, 0.02);
  book.rotation.y = 0.3;
  root.add(book);
  return root;
}

/** A hackathon cup in gold on a dark base, `height` tall. */
function trophy(height: number): Group {
  const gold = standard("#d4af37", 0.3, 0.8);
  const group = new Group();
  const base = box(height * 0.45, height * 0.18, height * 0.45, standard(palette.inkDeep, 0.4), 0, 0, 0);
  const stem = mesh(new CylinderGeometry(height * 0.05, height * 0.09, height * 0.3, 10), gold);
  stem.position.y = height * 0.33;
  const cup = mesh(new CylinderGeometry(height * 0.28, height * 0.12, height * 0.42, 16, 1, true), gold);
  cup.position.y = height * 0.69;
  const handles = [-1, 1].map((side) => {
    const handle = mesh(new TorusGeometry(height * 0.1, height * 0.025, 6, 12, Math.PI), gold);
    handle.rotation.z = (side * Math.PI) / 2;
    handle.position.set(side * height * 0.28, height * 0.72, 0);
    return handle;
  });
  group.add(base, stem, cup, ...handles);
  return group;
}

/** The framed photo from the hackathon the team won, drawn once. */
function hackathonPhoto(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");
  if (ctx !== null) {
    const sky = ctx.createLinearGradient(0, 0, 0, 192);
    sky.addColorStop(0, "#3a2a6a");
    sky.addColorStop(1, "#1b0f2e");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 256, 192);
    // The team in a row, heads and shoulders, in the members' colors.
    const colors = ["#e8e6f2", "#c9783f", "#c0303a", "#e9c46a", "#4fae6f", "#2b2b30", "#c23a3a", "#f5a8c2"];
    colors.forEach((color, index) => {
      const x = 22 + index * 30;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, 112, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 13, 124, 26, 40);
    });
    ctx.fillStyle = "#f2c94c";
    ctx.font = "700 22px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("JUARA 1", 128, 40);
    ctx.fillStyle = "#f4f1ec";
    ctx.font = "600 16px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("Hackathon 24 jam", 128, 64);
  } else {
    console.error("[office] no 2D canvas for the hackathon photo");
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * A low cabinet of the team's keepsakes: three of Kenney's low open shelves side by side, with
 * the hackathon cups, the winning photo, a teddy bear and a radio on top.
 */
export function buildDisplayCabinet(piece: Furniture): Group {
  const root = placed(piece);
  const { width, depth } = localSize(piece);
  const height = 0.5;
  const units = 3;
  for (let unit = 0; unit < units; unit++) {
    const shelf = kitPiece("bookcaseOpenLow", { width: width / units, height, depth }, { wood: palette.oak });
    if (shelf === null) {
      root.add(box(width, height, depth, standard(palette.oak, 0.6), 0, 0, 0));
      break;
    }
    shelf.position.x = -width / 2 + (width / units) * (unit + 0.5);
    root.add(shelf);
  }
  const big = trophy(0.16);
  big.position.set(-0.05, height, 0);
  const small = trophy(0.11);
  small.position.set(0.1, height, 0.04);
  // Leaning back a little, the way a frame stands on its own foot.
  const frame = new Group();
  frame.add(
    box(0.2, 0.155, 0.012, standard(palette.inkDeep, 0.4), 0, 0, 0),
    mesh(new PlaneGeometry(0.18, 0.135), unlit(hackathonPhoto()), false),
  );
  const photo = frame.children[1];
  photo?.position.set(0, 0.0775, 0.007);
  frame.rotation.x = -0.15;
  frame.position.set(0.3, height, 0.02);
  root.add(big, small, frame);
  const bear = kitPiece("bear", { height: 0.2 }, { fur: "#a8744f", wood: palette.oak });
  if (bear !== null) {
    bear.position.set(-0.4, height, 0.02);
    root.add(bear);
  }
  const radio = kitPiece("radio", { height: 0.12 }, { metalMedium: palette.inkSoft, wood: palette.oak });
  if (radio !== null) {
    radio.position.set(0.48, height, -0.04);
    root.add(radio);
  }
  return root;
}
