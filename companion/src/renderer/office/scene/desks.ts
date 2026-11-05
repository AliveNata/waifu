import {
  AdditiveBlending,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DataTexture,
  Group,
  type Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  type Object3D,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import type { MemberId } from "../../../shared/team.js";
import type { ArmSide } from "../avatar.js";
import type { DeskItem } from "../desk-habits.js";
import { type Furniture, surface } from "../office-plan.js";
import { Keyboard } from "../surfaces/keyboard.js";
import { DeskMouse } from "../surfaces/mouse.js";
import { type ScreenSize, ScreenSurface } from "../surfaces/screen.js";
import { screenScripts } from "../surfaces/screen-scripts.js";
import { type DeskGadget, returnSetup } from "./desk-returns.js";
import { handPropModel, type PropLook } from "./hand-props.js";
import { kitPiece } from "./kit.js";
import { type LaptopModel, laptopShell } from "./laptop-model.js";
import { box, glow, mesh, palette, standard, unlit } from "./palette.js";
import { leafyCrown } from "./plant.js";
import {
  checklistTexture,
  contractDiagramTexture,
  jobRunsTexture,
  monitoringTexture,
  pipelineTexture,
  pullRequestsTexture,
  securityLogTexture,
} from "./textures.js";

export const deskTop = surface.desk;
/**
 * Bottom edge of a monitor panel: a short stand above the desk, so a seated person
 * (eyes near 0.72 m) looks at the middle of the screen, not up at its bezel.
 */
const panelBottom = deskTop + 0.07;

export type DeskMember = MemberId;

export interface Workstation {
  screen: ScreenSurface;
  keyboard: Keyboard;
  /** To the right of the keyboard, for the typist's occasional mouse work. */
  mouse: DeskMouse;
  /** The member's own mug on the desk. Hidden while they carry it to the pantry and back. */
  mug: Group;
  /**
   * Things the member picks up or moves during a desk bit. Each one's origin is where the hand
   * takes hold of it, so the stage can reach for it directly.
   */
  items: Partial<Record<DeskItem, Object3D>>;
  /** The two squares the movable chess piece goes between, in its parent's frame. */
  chessMove: [Vector3, Vector3] | null;
  /** Top of the sticky pad someone writes on, for the marker to scribble over. */
  writingPad: Object3D | null;
  /** The hand nearer the mug, which picks it up. */
  mugSide: ArmSide;
  /**
   * The drawer the meeting laptop is kept in, its origin at the handle. It slides toward the
   * sitter (+z) from where it rests. Null on laptop desks, whose laptop is the one on the desk.
   */
  drawer: Group | null;
  /** On laptop desks: the lid, hinged at the back of the keyboard, and the shell's color. */
  lid: Group | null;
  /** Switched on in the evening. */
  lamp: DeskLamp;
  /** The moving thing on the L-desk's short leg, if this desk has one. */
  gadget: DeskGadget | null;
}

/**
 * A desk lamp at the back of the desk, its shade over the work area. Lit, the bulb glows and a
 * warm pool of light shows on the desktop; a faked pool rather than a real light, so eight lamps
 * cost nothing on a slow laptop.
 */
export class DeskLamp {
  constructor(
    readonly root: Group,
    private readonly bulb: MeshStandardMaterial,
    private readonly pool: MeshBasicMaterial,
  ) {}

  /** 0 off to 1 fully on. */
  setLevel(level: number): void {
    this.bulb.emissiveIntensity = 2.2 * level;
    this.pool.opacity = 0.5 * level;
    this.pool.visible = level > 0.01;
  }
}

/** A soft round falloff, generated in memory so it needs no canvas. */
function poolTexture(): DataTexture {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2);
      const falloff = Math.max(0, 1 - distance) ** 1.6;
      pixels.set([255, 255, 255, Math.round(255 * falloff)], (y * size + x) * 4);
    }
  }
  const texture = new DataTexture(pixels, size, size);
  texture.needsUpdate = true;
  return texture;
}

/** What a member's lamp looks like: its parts, where its light lands, and the light's color. */
interface LampLook {
  parts: Object3D[];
  bulb: MeshStandardMaterial;
  /** How far ahead of the base the pool of light falls, toward the sitter. */
  poolAhead: number;
  light: string;
}

function at(object: Object3D, x: number, y: number, z: number): Object3D {
  object.position.set(x, y, z);
  return object;
}

/** A round bar from one point to another, for arms that have to meet at their joints. */
function rod(from: Vector3, to: Vector3, radius: number, material: Material): Object3D {
  const bar = mesh(new CylinderGeometry(radius, radius, from.distanceTo(to), 8), material);
  bar.position.copy(from).add(to).multiplyScalar(0.5);
  bar.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), to.clone().sub(from).normalize());
  return bar;
}

/**
 * Each member's lamp, picked for who they are: 2B's black architect lamp, Chizuru's mushroom,
 * Rias's brass lamp with a crimson shade, Asuna's LED bar, Kobayashi's dragon-green gooseneck,
 * Yor's dark red bell, Erza's steel lantern, Ruby's pink globe.
 */
function lampLook(member: DeskMember): LampLook {
  const y = deskTop;
  switch (member) {
    case "twob": {
      // Two straight arms at an angle and a cone head: a drafting lamp, precise and dark.
      const black = standard("#16161a", 0.35, 0.2);
      const bulb = glow("#e8f0ff", 0);
      // The arms are drawn joint to joint, so the elbow and the head always meet them.
      const shoulder = new Vector3(0, y + 0.014, 0);
      const elbow = new Vector3(0, y + 0.2, 0.07);
      const head = mesh(new CylinderGeometry(0.018, 0.045, 0.07, 16, 1, true), black);
      // The narrow end tips back toward the arm, the open end down over the desk.
      head.rotation.x = -0.3;
      const headAt = new Vector3(0, y + 0.17, 0.23);
      const neck = headAt.clone().add(new Vector3(0, Math.cos(0.3) * 0.035, -Math.sin(0.3) * 0.035));
      return {
        parts: [
          box(0.08, 0.014, 0.08, black, 0, y, 0),
          rod(shoulder, elbow, 0.006, black),
          at(mesh(new SphereGeometry(0.01, 10, 8), black), elbow.x, elbow.y, elbow.z),
          rod(elbow, neck, 0.006, black),
          at(head, headAt.x, headAt.y, headAt.z),
          at(mesh(new SphereGeometry(0.014, 10, 8), bulb, false), 0, y + 0.155, 0.235),
        ],
        bulb,
        poolAhead: 0.26,
        light: "#dfe9ff",
      };
    }
    case "chizuru": {
      const bulb = glow("#ffc38a", 0);
      const cap = mesh(new SphereGeometry(0.075, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), standard("#f7a86a", 0.6));
      return {
        parts: [
          at(mesh(new CylinderGeometry(0.03, 0.04, 0.11, 14), standard("#f7efe2", 0.7)), 0, y + 0.055, 0),
          at(cap, 0, y + 0.105, 0),
          at(mesh(new SphereGeometry(0.03, 10, 8), bulb, false), 0, y + 0.11, 0),
          // White spots on the cap, the way a toadstool has them.
          at(mesh(new SphereGeometry(0.012, 8, 6), standard("#fff8ee", 0.7)), 0.03, y + 0.165, 0.03),
          at(mesh(new SphereGeometry(0.01, 8, 6), standard("#fff8ee", 0.7)), -0.035, y + 0.16, -0.01),
        ],
        bulb,
        poolAhead: 0.12,
        light: "#ffc38a",
      };
    }
    case "rias": {
      const brass = standard("#c9a24a", 0.3, 0.7);
      const bulb = glow("#ffcf96", 0);
      return {
        parts: [
          at(mesh(new CylinderGeometry(0.045, 0.055, 0.015, 20), brass), 0, y + 0.008, 0),
          at(mesh(new CylinderGeometry(0.007, 0.007, 0.22, 10), brass), 0, y + 0.12, 0),
          at(mesh(new CylinderGeometry(0.055, 0.07, 0.08, 20, 1, true), standard("#8e1f2f", 0.8)), 0, y + 0.22, 0),
          at(mesh(new SphereGeometry(0.02, 10, 8), bulb, false), 0, y + 0.2, 0),
        ],
        bulb,
        poolAhead: 0.12,
        light: "#ffb36b",
      };
    }
    case "asuna": {
      // A slim LED bar: clean and modern, with her orange on the stand.
      const grey = standard("#d8dce3", 0.35, 0.4);
      const bulb = glow("#fff1dc", 0);
      return {
        parts: [
          box(0.1, 0.012, 0.06, grey, 0, y, 0),
          box(0.012, 0.28, 0.012, standard("#f0a35e", 0.5), 0, y, 0),
          box(0.03, 0.014, 0.26, grey, 0, y + 0.28, 0.11),
          box(0.02, 0.004, 0.22, bulb, 0, y + 0.276, 0.12),
        ],
        bulb,
        poolAhead: 0.18,
        light: "#fff1dc",
      };
    }
    case "kobayashi": {
      // A bendy gooseneck in dragon green, the head bent down over the keyboard.
      const green = standard("#4fae6f", 0.5);
      const bulb = glow("#eaffef", 0);
      // Up out of the base, over the top and down toward the keys, ending where the head hangs.
      const curve = new CatmullRomCurve3([
        new Vector3(0, y + 0.02, 0),
        new Vector3(0, y + 0.15, 0.01),
        new Vector3(0, y + 0.22, 0.08),
        new Vector3(0, y + 0.19, 0.185),
      ]);
      const neck = mesh(new TubeGeometry(curve, 20, 0.007, 8, false), green);
      const head = mesh(new CylinderGeometry(0.016, 0.04, 0.06, 14, 1, true), green);
      // The narrow end toward the neck, the open end down at the keys.
      head.rotation.x = -0.6;
      return {
        parts: [
          at(mesh(new CylinderGeometry(0.045, 0.05, 0.02, 18), standard("#2b2b30", 0.5)), 0, y + 0.01, 0),
          neck,
          at(head, 0, y + 0.165, 0.205),
          at(mesh(new SphereGeometry(0.013, 10, 8), bulb, false), 0, y + 0.145, 0.215),
        ],
        bulb,
        poolAhead: 0.24,
        light: "#e6ffe9",
      };
    }
    case "yor": {
      const black = standard("#1a1418", 0.4);
      const bulb = glow("#ffb08a", 0);
      return {
        parts: [
          at(mesh(new CylinderGeometry(0.04, 0.05, 0.014, 18), black), 0, y + 0.007, 0),
          at(mesh(new CylinderGeometry(0.006, 0.006, 0.24, 10), black), 0, y + 0.13, 0),
          at(mesh(new CylinderGeometry(0.02, 0.07, 0.075, 20, 1, true), standard("#6e1420", 0.6)), 0, y + 0.23, 0),
          at(mesh(new SphereGeometry(0.018, 10, 8), bulb, false), 0, y + 0.21, 0),
        ],
        bulb,
        poolAhead: 0.12,
        light: "#ffb08a",
      };
    }
    case "erza": {
      // A steel lantern, armour-like, with a red band.
      const steel = standard("#a9afb8", 0.3, 0.7);
      const bulb = glow("#ffd28a", 0);
      const roof = mesh(new CylinderGeometry(0, 0.06, 0.05, 4), steel);
      roof.rotation.y = Math.PI / 4;
      return {
        parts: [
          box(0.09, 0.014, 0.09, steel, 0, y, 0),
          ...[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => box(0.008, 0.12, 0.008, steel, sx * 0.035, y + 0.014, sz * 0.035)),
          ),
          box(0.05, 0.08, 0.05, bulb, 0, y + 0.03, 0),
          box(0.085, 0.012, 0.085, standard("#c23a3a", 0.5), 0, y + 0.134, 0),
          at(roof, 0, y + 0.17, 0),
        ],
        bulb,
        poolAhead: 0.1,
        light: "#ffd28a",
      };
    }
    case "ruby": {
      // A pink glass globe that glows itself.
      const bulb = glow("#ffb3d1", 0);
      bulb.transparent = true;
      bulb.opacity = 0.9;
      return {
        parts: [
          at(mesh(new CylinderGeometry(0.035, 0.045, 0.02, 18), standard("#f7f1ea", 0.4)), 0, y + 0.01, 0),
          at(mesh(new SphereGeometry(0.07, 20, 14), bulb, false), 0, y + 0.09, 0),
        ],
        bulb,
        poolAhead: 0.1,
        light: "#ffb3d1",
      };
    }
    case "arisu": {
      // A tidy white task lamp with a round head: the planner's desk is always in order.
      const white = standard("#f2f3f6", 0.35);
      const bulb = glow("#f4f8ff", 0);
      const arm = mesh(new CylinderGeometry(0.006, 0.006, 0.24, 8), white);
      arm.rotation.x = 0.3;
      const head = mesh(new CylinderGeometry(0.045, 0.045, 0.014, 20), white);
      return {
        parts: [
          at(mesh(new CylinderGeometry(0.045, 0.05, 0.012, 20), white), 0, y + 0.006, 0),
          at(arm, 0, y + 0.115, 0.035),
          at(head, 0, y + 0.235, 0.08),
          at(mesh(new CylinderGeometry(0.035, 0.035, 0.004, 20), bulb, false), 0, y + 0.227, 0.08),
        ],
        bulb,
        poolAhead: 0.14,
        light: "#eef4ff",
      };
    }
    case "komachi": {
      // A light bar clipped along the top of the screen: an engineer's lamp that lights the keys, not the screen.
      const ink = standard("#20232e", 0.35, 0.3);
      const bulb = glow("#dde4ff", 0);
      return {
        parts: [
          box(0.07, 0.012, 0.07, ink, 0, y, 0),
          box(0.012, 0.3, 0.012, ink, 0, y, 0),
          box(0.32, 0.018, 0.03, ink, 0, y + 0.3, 0.02),
          box(0.3, 0.004, 0.02, bulb, 0, y + 0.297, 0.025),
        ],
        bulb,
        poolAhead: 0.16,
        light: "#dde4ff",
      };
    }
    case "miruku": {
      // A low dome in dark glass with a violet glow, like a status light that is always on watch.
      const bulb = glow("#c9a8ff", 0);
      bulb.transparent = true;
      bulb.opacity = 0.85;
      return {
        parts: [
          at(mesh(new CylinderGeometry(0.05, 0.055, 0.018, 20), standard("#1d1b26", 0.4, 0.3)), 0, y + 0.009, 0),
          at(mesh(new SphereGeometry(0.05, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), bulb, false), 0, y + 0.018, 0),
          at(mesh(new TorusGeometry(0.051, 0.004, 6, 24), standard("#8a5fd0", 0.4, 0.4)), 0, y + 0.02, 0),
        ],
        bulb,
        poolAhead: 0.1,
        light: "#cdb2ff",
      };
    }
    case "huagua": {
      // A wooden lamp with a soft green fabric shade, warm like a sketchbook corner.
      const wood = standard("#a87a52", 0.7);
      const bulb = glow("#fff0d6", 0);
      return {
        parts: [
          at(mesh(new CylinderGeometry(0.04, 0.05, 0.02, 16), wood), 0, y + 0.01, 0),
          at(mesh(new CylinderGeometry(0.008, 0.008, 0.2, 10), wood), 0, y + 0.11, 0),
          at(mesh(new CylinderGeometry(0.05, 0.07, 0.08, 20, 1, true), standard("#7fb894", 0.85)), 0, y + 0.22, 0),
          at(mesh(new SphereGeometry(0.018, 10, 8), bulb, false), 0, y + 0.2, 0),
        ],
        bulb,
        poolAhead: 0.12,
        light: "#ffe9c8",
      };
    }
  }
}

/**
 * The member's lamp at (x, z) in the desk's frame, turned toward the middle of the desk's front
 * edge, with its pool of light on the desk in front of it.
 */
/**
 * How much each lamp grows from where it was drawn for the chibi team, to stand about 0.3 m over
 * the desk like a real one at the room's 0.73 scale. The mushroom and the two light bars already do.
 */
const lampScale: Record<DeskMember, number> = {
  twob: 1.35,
  chizuru: 1,
  rias: 1.25,
  asuna: 1.05,
  kobayashi: 1.35,
  yor: 1.2,
  erza: 1.5,
  ruby: 1.2,
  arisu: 1.3,
  komachi: 1,
  miruku: 1.6,
  huagua: 1.25,
};

function deskLamp(member: DeskMember, x: number, z: number, depth: number): DeskLamp {
  const root = new Group();
  const look = lampLook(member);
  // The parts are drawn from the desk top up; they grow about the desk top so the base stays on it.
  const drawn = new Group();
  drawn.add(...look.parts);
  drawn.position.y = -deskTop;
  const grown = new Group();
  grown.add(drawn);
  grown.scale.setScalar(lampScale[member]);
  grown.position.y = deskTop;
  root.add(grown);
  root.position.set(x, 0, z);
  root.rotation.y = Math.atan2(-x, depth / 2 - z);
  const poolMaterial = new MeshBasicMaterial({
    map: poolTexture(),
    color: new Color(look.light),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const pool = mesh(new PlaneGeometry(0.6, 0.6), poolMaterial, false);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, deskTop + 0.002, look.poolAhead * lampScale[member]);
  root.add(pool);
  const lamp = new DeskLamp(root, look.bulb, poolMaterial);
  lamp.setLevel(0);
  return lamp;
}

const noDeskThings = {
  items: {},
  chessMove: null,
  writingPad: null,
  mugSide: "right",
  drawer: null,
  lid: null,
  gadget: null,
} as const;

/** Each member's own mug, so it is clear whose is on the drying rack, and the laptop they take to meetings. */
export const memberPropLooks: Record<MemberId, PropLook> = {
  twob: { mug: "#3b3f4e", shell: "#b9bec7" },
  chizuru: { mug: "#f2a65a", shell: "#f3d9b8" },
  rias: { mug: "#f7f1ea", shell: "#3b2a33" },
  asuna: { mug: "#7fb2d9", shell: "#b9bec7" },
  kobayashi: { mug: "#8fcf9f", shell: "#b9bec7" },
  yor: { mug: "#2a2a2e", shell: "#b9bec7" },
  erza: { mug: "#e35d5d", shell: "#b9bec7" },
  ruby: { mug: "#f4a6c4", shell: "#d9d4cc" },
  arisu: { mug: "#7fb6dc", shell: "#b9bec7" },
  komachi: { mug: "#3b4466", shell: "#b9bec7" },
  miruku: { mug: "#8a5fd0", shell: "#2c2a33" },
  huagua: { mug: "#9fd2b0", shell: "#e8e2d4" },
};

/** The same mug the member carries, standing on the desk. */
function mugAt(member: MemberId, x: number, z: number): Group {
  // The hand's mug is already at the room's scale, so the desk shows the same size.
  const model = handPropModel("mug", memberPropLooks[member]);
  return deskItem(model, x, deskTop + 0.017, z);
}

/** Opening how far, in meters, toward the sitter. */
export const drawerTravel = 0.18;

/**
 * A drawer unit hung under the desktop on the side away from the PC tower, front flush with the
 * desk edge. Returns the unit and the sliding drawer, whose origin is its handle.
 */
function drawerUnit(width: number, depth: number, side: ArmSide): { unit: Group; drawer: Group } {
  // The sitter faces -z, so their left is -x.
  const x = (side === "left" ? -1 : 1) * (width / 2 - 0.26);
  const top = deskTop - 0.04;
  const height = 0.2;
  const unitDepth = 0.4;
  const front = depth / 2 - 0.01;
  const unit = new Group();
  unit.add(box(0.32, height, unitDepth, standard(palette.ink, 0.6), x, top - height, front - unitDepth / 2 - 0.02));
  const drawer = new Group();
  drawer.add(
    // Its top stays 5 mm under the desktop, inside the slab, so it never shows through on top.
    box(0.3, 0.16, 0.018, standard(palette.inkSoft, 0.5), 0, -0.085, -0.009),
    box(0.12, 0.012, 0.012, standard(palette.steel, 0.3, 0.6), 0, -0.006, 0.006),
    // The tray behind the front, seen when it is pulled out.
    box(0.28, 0.12, 0.3, standard(palette.ink, 0.7), 0, -0.155, -0.17),
  );
  drawer.position.set(x, top - 0.04, front);
  drawer.userData.restZ = front;
  unit.add(drawer);
  return { unit, drawer };
}
/** Front strip of the desk, just past the keyboard's reach line: where things to pick up are kept. */
function nearEdge(depth: number): number {
  return depth / 2 - 0.12;
}

/** Wraps a model so its origin is the grip point at (x, y, z) on the desk. */
function deskItem(model: Object3D, x: number, y: number, z: number): Group {
  const item = new Group();
  item.add(model);
  item.position.set(x, y, z);
  return item;
}

export interface BuiltDesk {
  root: Group;
  workstation: Workstation;
}

/** 16:10 like the canvas textures, so screen text keeps its shape. */
const landscape = { width: 0.42, height: 0.2625 };
const portrait = { width: 0.22, height: 0.352 };
const ultrawideScreen: ScreenSize = { width: 1000, height: 400 };

/** Light laminate top, dark panel legs, and an accent strip under the front edge: the room's gaming cue. */
function deskBase(width: number, depth: number): Group {
  const root = new Group();
  const legs = standard(palette.ink, 0.6);
  root.add(
    box(width, 0.04, depth, standard(palette.laminate, 0.45), 0, deskTop - 0.04, 0),
    box(0.04, deskTop - 0.04, depth - 0.08, legs, -width / 2 + 0.04, 0, 0),
    box(0.04, deskTop - 0.04, depth - 0.08, legs, width / 2 - 0.04, 0, 0),
    box(width - 0.12, 0.012, 0.01, glow(), 0, deskTop - 0.05, depth / 2 - 0.02),
  );
  return root;
}

/** Monitor on a stand, screen facing +z (toward the sitter). `y` is the bottom edge of the panel. */
function monitor(map: Texture, width: number, height: number, x: number, z: number, yaw = 0, y = panelBottom): Group {
  const group = new Group();
  const ink = standard(palette.inkDeep, 0.4, 0.2);
  group.add(
    box(0.17, 0.012, 0.13, ink, 0, deskTop, 0),
    box(0.025, y - deskTop + height * 0.3, 0.02, ink, 0, deskTop, -0.02),
    box(width + 0.02, height + 0.02, 0.02, ink, 0, y - 0.01, 0),
  );
  const panel = mesh(new PlaneGeometry(width, height), unlit(map), false);
  panel.position.set(0, y + height / 2, 0.012);
  // Found by the office so the screen can go to sleep while its owner is away.
  panel.userData.sideScreen = true;
  group.add(panel);
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  return group;
}

/** Desktop tower beside the desk with a glass side and RGB fans: the gaming half of the setup. */
function pcTower(x: number, z: number, glowColor: string = palette.accent, brightness = 1): Group {
  const group = new Group();
  group.add(
    box(0.16, 0.36, 0.34, standard(palette.inkDeep, 0.35, 0.3), 0, 0, 0),
    box(0.005, 0.3, 0.28, glow(glowColor, 1.4 * brightness), 0.082, 0.03, 0),
    box(0.1, 0.012, 0.012, glow(glowColor, 1.8 * brightness), 0, 0.33, 0.171),
  );
  group.position.set(x, 0, z);
  return group;
}

/**
 * Dock for a handheld console with red and blue controllers, the kind that lives on a dev's desk.
 * The console itself is separate: it comes out of the dock to be played.
 */
function handheldDock(x: number, z: number): { dock: Group; console: Group } {
  const dock = new Group();
  dock.add(box(0.12, 0.07, 0.03, standard("#2b2b30", 0.5), 0, deskTop, 0));
  const model = handPropModel("console");
  // Stood on its edge in the dock, screen toward the sitter.
  model.rotation.x = Math.PI / 2;
  const console = deskItem(model, 0, deskTop + 0.058, 0.02);
  dock.add(console);
  dock.position.set(x, 0, z);
  dock.rotation.y = -0.3;
  return { dock, console };
}

/** Headset on a stand, for an SRE who lives on incident calls. */
function headsetStand(x: number, z: number): Group {
  const group = new Group();
  const ink = standard(palette.inkDeep, 0.4);
  // Over-ear headphones wide enough for the members' heads (about 0.15 m across), hung by the top
  // of the band on a 0.24 m stand, the cups hanging down at its sides.
  const standTop = 0.24;
  const bandRadius = 0.075;
  const bandCenter = standTop - bandRadius;
  group.add(box(0.1, 0.012, 0.1, ink, 0, deskTop, 0), box(0.014, standTop, 0.014, ink, 0, deskTop, 0));
  // The band as a half ring from one cup over the top to the other, flattened like a padded band.
  const band = mesh(new TorusGeometry(bandRadius, 0.011, 8, 24, Math.PI), ink);
  band.scale.z = 1.6;
  band.position.set(0, deskTop + bandCenter, 0);
  const cupMaterial = standard(palette.ink, 0.5);
  const leftCup = mesh(new CylinderGeometry(0.042, 0.042, 0.03, 16), cupMaterial);
  leftCup.rotation.z = Math.PI / 2;
  leftCup.position.set(-bandRadius, deskTop + bandCenter - 0.045, 0);
  const rightCup = leftCup.clone();
  rightCup.position.x = bandRadius;
  group.add(
    band,
    leftCup,
    rightCup,
    box(0.005, 0.016, 0.04, glow(), bandRadius + 0.017, deskTop + bandCenter - 0.052, -0.02),
  );
  group.position.set(x, 0, z);
  return group;
}

/** Near the front edge, the way people pull a keyboard close: arms stay relaxed. */
function keyboardZ(deskDepth: number): number {
  return deskDepth / 2 - 0.115;
}

function keyboardFor(member: DeskMember, z: number): Keyboard {
  const keyboard = new Keyboard(palette.accent, palette.inkDeep, palette.inkSoft);
  keyboard.root.position.set(0, deskTop, z);
  keyboard.root.name = `keyboard-${member}`;
  return keyboard;
}

/** Just right of the keyboard, within arm's reach and clear of the mugs at x 0.42 and beyond. */
function mouseBeside(keyboard: Keyboard, accent: string, base: string): DeskMouse {
  const mouse = new DeskMouse(accent, base);
  mouse.root.position.set(keyboard.root.position.x + 0.23, deskTop, keyboard.root.position.z + 0.02);
  return mouse;
}

function placedDesk(piece: Furniture, inner: Group): Group {
  const root = new Group();
  root.position.set(piece.x, 0, piece.z);
  root.rotation.y = piece.yaw;
  root.add(inner);
  return root;
}

function deskSize(piece: Furniture): { width: number; depth: number } {
  return Math.abs(Math.sin(piece.yaw)) > 0.5
    ? { width: piece.depth, depth: piece.width }
    : { width: piece.width, depth: piece.depth };
}

/** Data engineer: SQL in the middle, the pipeline DAG on the left, job runs on a vertical screen. */
function asunaDesk(piece: Furniture): DeskBuild {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.asuna);
  const back = -depth / 2 + 0.16;
  inner.add(
    monitor(screen.texture, landscape.width, landscape.height, 0, back),
    monitor(pipelineTexture(), landscape.width, landscape.height, -0.46, back + 0.06, 0.35),
    monitor(jobRunsTexture(), portrait.width, portrait.height, 0.38, back + 0.05, -0.35),
  );
  const keyboard = keyboardFor("asuna", keyboardZ(depth));
  const mouse = mouseBeside(keyboard, palette.accent, palette.inkDeep);
  const mug = mugAt("asuna", 0.36, nearEdge(depth));
  const { unit, drawer } = drawerUnit(width, depth, "left");
  // A rubber duck for talking a broken pipeline through.
  const duck = deskItem(handPropModel("duck"), -0.33, deskTop + 0.022, nearEdge(depth));
  duck.rotation.y = 0.5;
  inner.add(keyboard.root, mouse.root, mug, duck, unit);
  return {
    root: placedDesk(piece, inner),
    workstation: { screen, keyboard, mouse, mug, ...noDeskThings, items: { duck }, drawer },
  };
}

/** Full stack: an ultrawide for code and preview, a vertical screen for PRs, a docked console and a dragon plush. */
function kobayashiDesk(piece: Furniture): DeskBuild {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.kobayashi, ultrawideScreen);
  const back = -depth / 2 + 0.16;
  inner.add(
    monitor(screen.texture, 0.72, 0.288, 0.05, back),
    monitor(pullRequestsTexture(), portrait.width, portrait.height, -0.5, back + 0.05, 0.35),
    pcTower(-width / 2 + 0.14, 0),
  );
  const { dock, console } = handheldDock(0.42, nearEdge(depth) - 0.02);
  const keyboard = keyboardFor("kobayashi", keyboardZ(depth));
  const mouse = mouseBeside(keyboard, palette.accent, palette.inkDeep);
  // Clear of the mug now that the plush is its real size.
  const plush = deskItem(handPropModel("plush"), -0.53, deskTop + 0.07, nearEdge(depth) - 0.06);
  plush.rotation.y = 0.4;
  // The dock takes the right side, so the mug lives on the left.
  const mug = mugAt("kobayashi", -0.27, nearEdge(depth) + 0.04);
  const { unit, drawer } = drawerUnit(width, depth, "right");
  inner.add(dock, keyboard.root, mouse.root, plush, mug, unit);
  return {
    root: placedDesk(piece, inner),
    workstation: {
      screen,
      keyboard,
      mouse,
      mug,
      ...noDeskThings,
      items: { console, plush },
      mugSide: "left",
      drawer,
    },
  };
}

/** Reviewer: the diff on a wide screen, her checklist on a vertical one, and a slice of strawberry cake. */
function erzaDesk(piece: Furniture): DeskBuild {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.erza);
  const back = -depth / 2 + 0.16;
  inner.add(
    monitor(screen.texture, landscape.width, landscape.height, -0.12, back),
    monitor(checklistTexture(), portrait.width, portrait.height, 0.28, back + 0.03, -0.25),
  );
  const keyboard = keyboardFor("erza", keyboardZ(depth));
  const mouse = mouseBeside(keyboard, palette.accent, palette.inkDeep);
  const cakeX = -0.34;
  const cakeZ = nearEdge(depth) - 0.02;
  const plate = mesh(new CylinderGeometry(0.072, 0.072, 0.006, 20), standard(palette.laminate, 0.4));
  plate.position.set(cakeX, deskTop + 0.003, cakeZ);
  const cake = box(0.07, 0.06, 0.05, standard("#f6efe4", 0.8), cakeX, deskTop + 0.006, cakeZ);
  const berry = mesh(new SphereGeometry(0.012, 10, 8), standard("#d23b4a", 0.5));
  berry.position.set(cakeX, deskTop + 0.077, cakeZ);
  const forkModel = handPropModel("fork");
  const bite = forkModel.getObjectByName("bite");
  if (bite !== undefined) {
    bite.visible = false;
  }
  // Lying flat beside the plate, tines away from her.
  forkModel.rotation.x = -Math.PI / 2;
  const fork = deskItem(forkModel, cakeX + 0.09, deskTop + 0.004, cakeZ);
  const mug = mugAt("erza", 0.36, nearEdge(depth));
  const { unit, drawer } = drawerUnit(width, depth, "left");
  inner.add(keyboard.root, mouse.root, plate, cake, berry, fork, mug, unit);
  return {
    root: placedDesk(piece, inner),
    workstation: { screen, keyboard, mouse, mug, ...noDeskThings, items: { fork }, drawer },
  };
}

/** Platform/SRE: terminal plus monitoring, a headset for incident calls, and a single rose. */
function yorDesk(piece: Furniture): DeskBuild {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.yor);
  const back = -depth / 2 + 0.16;
  inner.add(
    monitor(screen.texture, landscape.width, landscape.height, -0.23, back, 0.1),
    monitor(monitoringTexture(), landscape.width, landscape.height, 0.23, back, -0.1),
    headsetStand(-0.6, back + 0.04),
    pcTower(-width / 2 + 0.14, 0, "#5fd38d"),
  );
  const keyboard = keyboardFor("yor", keyboardZ(depth));
  const mouse = mouseBeside(keyboard, palette.accent, palette.inkDeep);
  const vaseX = -0.32;
  const vaseZ = nearEdge(depth);
  const vase = mesh(new CylinderGeometry(0.025, 0.03, 0.13, 12), standard(palette.glass, 0.1));
  vase.position.set(vaseX, deskTop + 0.065, vaseZ);
  // Held by the stem just above the vase; the stem goes down into the water.
  const rose = deskItem(handPropModel("rose"), vaseX, deskTop + 0.14, vaseZ);
  const mug = mugAt("yor", 0.36, nearEdge(depth));
  const { unit, drawer } = drawerUnit(width, depth, "right");
  inner.add(keyboard.root, mouse.root, vase, rose, mug, unit);
  return {
    root: placedDesk(piece, inner),
    workstation: { screen, keyboard, mouse, mug, ...noDeskThings, items: { rose }, drawer },
  };
}

/** PA: one screen with the plan she is running, and her paper planner. The sprint board is Arisu's now. */
function twobDesk(piece: Furniture): DeskBuild {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.twob);
  inner.add(
    monitor(screen.texture, landscape.width, landscape.height, -0.06, -depth / 2 + 0.15),
    pcTower(width / 2 - 0.14, 0),
  );
  const keyboard = keyboardFor("twob", keyboardZ(depth));
  const mouse = mouseBeside(keyboard, palette.accent, palette.inkDeep);
  const mug = mugAt("twob", 0.36, nearEdge(depth));
  const { unit, drawer } = drawerUnit(width, depth, "left");
  // Her paper planner, for the things that do not go on the board.
  const cover = standard("#2d3a5c", 0.7);
  const plannerModel = new Group();
  plannerModel.add(
    box(0.1, 0.016, 0.13, cover, 0, -0.016, 0),
    box(0.092, 0.012, 0.124, standard("#f7f3ea", 0.9), 0.003, -0.014, 0),
    box(0.006, 0.017, 0.13, standard(palette.accent, 0.6), 0.035, -0.0165, 0),
  );
  const planner = deskItem(plannerModel, -0.33, deskTop + 0.016, nearEdge(depth));
  planner.rotation.y = 0.15;
  inner.add(keyboard.root, mouse.root, mug, planner, unit);
  return {
    root: placedDesk(piece, inner),
    workstation: { screen, keyboard, mouse, mug, ...noDeskThings, items: { planner }, drawer },
  };
}

interface Laptop {
  keyboard: Keyboard;
  mouse: DeskMouse;
  lid: Group;
}

/** A laptop near the front edge: the keyboard is its own, the screen is on the open lid behind it. */
function laptop(
  screen: ScreenSurface,
  depth: number,
  shell: string,
  keys: string,
  model: LaptopModel = "laptop",
): Laptop {
  const keyboard = new Keyboard(palette.accent, shell, keys);
  keyboard.root.position.set(0, deskTop, keyboardZ(depth));
  const mouse = mouseBeside(keyboard, palette.accent, keys);
  // The laptop model's own shell around the keys and behind the screen, in this member's color.
  // The keys and screen stay the office's own, so typing and the screen work as before.
  // From the hinge to the old palm rest's front edge, so the laptop stays on the desk.
  const fromModel = laptopShell(model, { width: 0.34, depth: 0.2, baseHeight: 0.02 }, standard(shell, 0.5));
  if (fromModel !== null) {
    fromModel.base.position.z = -0.07;
    keyboard.root.add(fromModel.base);
    const lid = new Group();
    lid.position.set(0, deskTop + 0.02, keyboardZ(depth) - 0.07);
    lid.rotation.x = 0.25;
    lid.userData.openAngle = 0.25;
    lid.add(fromModel.lid);
    const panelHeight = Math.min(0.185, fromModel.lidHeight * 0.8);
    const panel = mesh(new PlaneGeometry(0.31, panelHeight), unlit(screen.texture), false);
    panel.position.set(0, fromModel.lidHeight * 0.52, fromModel.screenZ + 0.001);
    lid.add(panel);
    return { keyboard, mouse, lid };
  }
  // The laptop's own base around the keys: a palm rest in front and a rim up to the hinge, so the
  // shut lid rests on a closed body instead of floating over bare keys.
  const body = standard(shell, 0.5);
  const rim = 0.03;
  keyboard.root.add(
    // The keys sit a little below the deck, as on a real laptop.
    box(0.34, rim, 0.075, body, 0, 0, 0.095),
    box(0.01, rim, 0.2, body, -0.165, 0, 0.03),
    box(0.01, rim, 0.2, body, 0.165, 0, 0.03),
    box(0.34, rim, 0.01, body, 0, 0, -0.065),
  );
  const lid = new Group();
  // Hinged above the keys, so the shut lid lies on them instead of the keys poking through it.
  lid.position.set(0, deskTop + 0.03, keyboardZ(depth) - 0.07);
  lid.rotation.x = 0.25;
  lid.userData.openAngle = 0.25;
  // A touch wider than the keyboard (0.32) and longer than it is deep, so the shut lid covers every key.
  lid.add(box(0.34, 0.2, 0.012, standard(shell, 0.5), 0, 0, -0.006));
  const panel = mesh(new PlaneGeometry(0.32, 0.185), unlit(screen.texture), false);
  panel.position.set(0, 0.1, 0.001);
  lid.add(panel);
  return { keyboard, mouse, lid };
}

/** Content creator: laptop for drafting, a boom mic for voice-overs. */
function rubyDesk(piece: Furniture): DeskBuild {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.ruby);
  // Video editing wants a GPU: the gaming laptop.
  const { keyboard, mouse, lid } = laptop(screen, depth, "#d9d4cc", "#efebe5", "gamingLaptop");
  const ink = standard(palette.ink, 0.5);
  const boom = new Group();
  boom.add(box(0.016, 0.26, 0.016, ink, 0, deskTop, 0), box(0.016, 0.016, 0.24, ink, 0, deskTop + 0.25, 0.1));
  const mic = mesh(new CylinderGeometry(0.03, 0.03, 0.13, 12), standard(palette.inkDeep, 0.3, 0.3));
  mic.position.set(0, deskTop + 0.22, 0.22);
  boom.add(mic, box(0.01, 0.01, 0.008, glow(), 0, deskTop + 0.245, 0.24));
  boom.position.set(-0.45, 0, -depth / 2 + 0.1);
  const mug = mugAt("ruby", 0.36, nearEdge(depth));
  inner.add(keyboard.root, mouse.root, lid, boom, mug);
  return { root: placedDesk(piece, inner), workstation: { screen, keyboard, mouse, mug, ...noDeskThings, lid } };
}

/** An 8 by 8 board as a tiny texture, sampled without smoothing so the squares stay sharp. */
function chessTexture(): DataTexture {
  const light = [233, 222, 201];
  const dark = [92, 44, 52];
  const pixels = new Uint8Array(8 * 8 * 4);
  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 8; column++) {
      const color = (row + column) % 2 === 0 ? light : dark;
      pixels.set([color[0] ?? 0, color[1] ?? 0, color[2] ?? 0, 255], (row * 8 + column) * 4);
    }
  }
  const texture = new DataTexture(pixels, 8, 8);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** A chess piece with its origin at the top, where fingers take hold of it. */
function chessPiece(color: string, height: number): Group {
  const material = standard(color, 0.35, 0.1);
  const piece = new Group();
  const base = mesh(new CylinderGeometry(0.008, 0.01, 0.006, 12), material);
  base.position.y = -height + 0.003;
  const body = mesh(new CylinderGeometry(0.004, 0.007, height - 0.012, 10), material);
  body.position.y = -height / 2 + 0.002;
  const head = mesh(new SphereGeometry(0.006, 10, 8), material);
  head.position.y = -0.004;
  piece.add(base, body, head);
  return piece;
}

/**
 * Architect: the design doc on a laptop, a game of chess in progress, books and rolled-up
 * blueprints, and tea in a proper cup instead of a mug.
 */
function riasDesk(piece: Furniture): DeskBuild {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.rias);
  const { keyboard, mouse, lid } = laptop(screen, depth, "#3b2a33", "#4b3842");
  const back = -depth / 2 + 0.12;
  // She drafts on the trackpad, so the mouse sits out of the way and the cup can be close at hand.
  mouse.root.position.set(0.55, deskTop, nearEdge(depth) - 0.1);

  const boardX = -0.36;
  const boardZ = nearEdge(depth) - 0.02;
  const boardTop = deskTop + 0.012;
  const board = mesh(
    new PlaneGeometry(0.27, 0.27),
    new MeshStandardMaterial({ map: chessTexture(), roughness: 0.5 }),
    false,
  );
  board.rotation.x = -Math.PI / 2;
  board.position.set(boardX, boardTop + 0.0005, boardZ);
  const square = 0.27 / 8;
  const at = (column: number, row: number, height: number): Vector3 =>
    new Vector3(boardX + (column - 3.5) * square, boardTop + height, boardZ + (row - 3.5) * square);
  const pieces = new Group();
  for (const [color, column, row, height] of [
    ["#b3262f", 2, 6, 0.042],
    ["#b3262f", 5, 7, 0.036],
    ["#1d1a1f", 3, 1, 0.042],
    ["#1d1a1f", 6, 2, 0.036],
    ["#1d1a1f", 1, 0, 0.034],
  ] as const) {
    const placed = chessPiece(color, height);
    placed.position.copy(at(column, row, height));
    pieces.add(placed);
  }
  // Her queen, the piece she keeps moving while she thinks.
  const queenHeight = 0.05;
  // Between two squares on the side nearest her, where her hand reaches.
  const chessMove: [Vector3, Vector3] = [at(6, 7, queenHeight), at(5, 4, queenHeight)];
  const queen = chessPiece("#b3262f", queenHeight);
  queen.position.copy(chessMove[0]);

  const saucer = mesh(new CylinderGeometry(0.052, 0.044, 0.006, 18), standard("#f7f1ea", 0.3));
  saucer.position.set(0.32, deskTop + 0.003, nearEdge(depth) + 0.04);
  const teacup = deskItem(handPropModel("teacup"), 0.32, deskTop + 0.027, nearEdge(depth) + 0.04);

  const books = new Group();
  for (const [index, color] of ["#5c2a35", "#2f3b55", "#c9a24a"].entries()) {
    const book = box(0.15 - index * 0.012, 0.028, 0.2, standard(color, 0.8), 0, deskTop + index * 0.028);
    book.rotation.y = (index - 1) * 0.12;
    books.add(book);
  }
  books.position.set(-0.52, 0, back + 0.04);
  const rolls = new Group();
  for (const [index, color] of ["#4a78b5", "#e9eef5"].entries()) {
    const roll = mesh(new CylinderGeometry(0.02, 0.02, 0.48, 12), standard(color, 0.8));
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, deskTop + 0.018 + index * 0.03, index * 0.012);
    rolls.add(roll);
  }
  // Far enough in that the 0.48 m rolls stay on the desk, turned as they are.
  rolls.position.set(0.3, 0, back + 0.04);
  rolls.rotation.y = 0.35;

  inner.add(keyboard.root, mouse.root, lid, board, pieces, queen, saucer, teacup, books, rolls);
  return {
    root: placedDesk(piece, inner),
    workstation: {
      screen,
      keyboard,
      mouse,
      mug: teacup,
      items: { "chess-piece": queen },
      chessMove,
      writingPad: null,
      mugSide: "right",
      drawer: null,
      lid,
    },
  };
}

/** Brainstormer: a laptop full of half-formed ideas, sticky pads in every color, markers, a little plant. */
function chizuruDesk(piece: Furniture): DeskBuild {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.chizuru);
  const { keyboard, mouse, lid } = laptop(screen, depth, "#f3d9b8", "#fbeedd");
  const back = -depth / 2 + 0.12;
  // Ideas go on paper here, so the pad gets the spot by her hand and the mouse moves aside.
  mouse.root.position.set(0.55, deskTop, nearEdge(depth) - 0.1);

  // Ideas that did not wait for the board, stuck along the lid.
  for (const [index, color] of ["#ffd84d", "#ff9fc2", "#9fe0ff"].entries()) {
    const note = box(0.04, 0.04, 0.002, standard(color, 0.9), -0.16 + index * 0.05, 0.2, 0.001);
    note.rotation.z = (index - 1) * 0.15;
    lid.add(note);
  }

  const padX = 0.33;
  const padZ = nearEdge(depth) + 0.04;
  const pad = box(0.065, 0.012, 0.065, standard("#ffd84d", 0.9), padX, deskTop, padZ);
  pad.rotation.y = -0.2;
  const writingPad = new Group();
  writingPad.position.set(padX, deskTop + 0.012, padZ);
  const spare = new Group();
  spare.add(
    box(0.06, 0.01, 0.06, standard("#ff9fc2", 0.9), 0, deskTop, 0),
    box(0.06, 0.01, 0.06, standard("#9fe0ff", 0.9), 0.005, deskTop + 0.01, 0.004),
  );
  spare.position.set(0.5, 0, nearEdge(depth) - 0.22);
  spare.rotation.y = 0.3;
  const markerModel = handPropModel("marker");
  // Lying on the desk, pointing away from her.
  markerModel.rotation.set(-Math.PI / 2, 0, 0);
  const marker = deskItem(markerModel, padX - 0.08, deskTop + 0.007, padZ);

  const cup = new Group();
  cup.add(mesh(new CylinderGeometry(0.03, 0.026, 0.08, 14), standard("#e8833a", 0.6)));
  cup.children[0]?.position.set(0, deskTop + 0.04, 0);
  for (const [index, color] of ["#2f6fd6", "#d23b4a", "#2e9e5b", "#7a4fd0"].entries()) {
    const stick = mesh(new CylinderGeometry(0.005, 0.005, 0.11, 8), standard(color, 0.5));
    const angle = (index / 4) * Math.PI * 2;
    stick.position.set(Math.cos(angle) * 0.012, deskTop + 0.08, Math.sin(angle) * 0.012);
    stick.rotation.set(Math.sin(angle) * 0.18, 0, -Math.cos(angle) * 0.18);
    cup.add(stick);
  }
  cup.position.set(-0.46, 0, back + 0.06);

  const plant = new Group();
  // Kenney's small desk plant, about 0.17 m tall: a 0.23 m desk plant at the room's scale.
  const kitPlant = kitPiece("plantSmall1", { height: 0.17 }, { wood: "#f4efe6", plant: palette.leaf });
  if (kitPlant !== null) {
    kitPlant.position.y = deskTop;
    plant.add(kitPlant);
  } else {
    const pot = mesh(new CylinderGeometry(0.035, 0.028, 0.06, 14), standard("#f4efe6", 0.6));
    pot.position.y = deskTop + 0.03;
    const crown = leafyCrown(0.035, palette.leaf, palette.leafDark);
    crown.position.y = deskTop + 0.055;
    plant.add(pot, crown);
  }
  plant.position.set(0.5, 0, back + 0.04);

  const mug = mugAt("chizuru", -0.33, nearEdge(depth));
  inner.add(keyboard.root, mouse.root, lid, pad, writingPad, spare, marker, cup, plant, mug);
  return {
    root: placedDesk(piece, inner),
    workstation: {
      screen,
      keyboard,
      mouse,
      mug,
      items: { marker },
      chessMove: null,
      writingPad,
      mugSide: "left",
      drawer: null,
      lid,
    },
  };
}

/** Shared by the newer members' desks: keyboard, mouse, their mug on the left and a drawer with the meeting laptop. */
function deskBasics(member: DeskMember, width: number, depth: number) {
  const keyboard = keyboardFor(member, keyboardZ(depth));
  const mouse = mouseBeside(keyboard, palette.accent, palette.inkDeep);
  const mug = mugAt(member, -0.36, nearEdge(depth));
  const { unit, drawer } = drawerUnit(width, depth, "right");
  return { keyboard, mouse, mug, unit, drawer };
}

/** PM: the plan on one screen and the team's sprint board on the other, her clipboard and an hourglass for timeboxes. */
function arisuDesk(piece: Furniture, kanban: Texture): DeskBuild {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.arisu);
  const back = -depth / 2 + 0.14;
  inner.add(
    monitor(screen.texture, landscape.width, landscape.height, -0.24, back, 0.12),
    monitor(kanban, landscape.width, landscape.height, 0.24, back, -0.12),
  );
  const { keyboard, mouse, mug, unit, drawer } = deskBasics("arisu", width, depth);
  // The clipboard by her left hand, for ticking off the plan away from the screen.
  // Clear of the mug at -0.36: the clipboard is A4 size now, 0.15 by 0.21.
  const clipboard = deskItem(handPropModel("clipboard"), -0.6, deskTop + 0.003, nearEdge(depth) - 0.1);
  clipboard.rotation.y = 0.2;
  // Within arm's reach: things much past the mouse, or far back on the desk, are out of it.
  const hourglass = deskItem(handPropModel("hourglass"), 0.4, deskTop + 0.021, nearEdge(depth) - 0.11);
  inner.add(keyboard.root, mouse.root, mug, clipboard, hourglass, unit);
  return {
    root: placedDesk(piece, inner),
    workstation: {
      screen,
      keyboard,
      mouse,
      mug,
      ...noDeskThings,
      items: { clipboard, hourglass },
      mugSide: "left",
      drawer,
    },
  };
}

/** Tech lead: the steps she writes on one screen, the contract diagram on the other, a notebook and a stack of books. */
function komachiDesk(piece: Furniture): DeskBuild {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.komachi);
  const back = -depth / 2 + 0.14;
  inner.add(
    monitor(screen.texture, landscape.width, landscape.height, -0.22, back, 0.12),
    monitor(contractDiagramTexture(), landscape.width, landscape.height, 0.22, back, -0.12),
  );
  const { keyboard, mouse, mug, unit, drawer } = deskBasics("komachi", width, depth);
  // An open notebook by her right hand, where she sketches interfaces by hand. It takes the
  // mouse's spot, close enough to write on, and the mouse moves aside.
  const padX = 0.34;
  const padZ = nearEdge(depth);
  mouse.root.position.set(0.55, deskTop, nearEdge(depth) - 0.12);
  const paper = standard("#f7f3ea", 0.9);
  const notebook = new Group();
  notebook.add(
    box(0.2, 0.006, 0.145, standard("#3b4466", 0.7), 0, deskTop, 0),
    box(0.092, 0.004, 0.135, paper, -0.049, deskTop + 0.006, 0),
    box(0.092, 0.004, 0.135, paper, 0.049, deskTop + 0.006, 0),
  );
  notebook.position.set(padX, 0, padZ);
  notebook.rotation.y = -0.15;
  const writingPad = new Group();
  writingPad.position.set(padX + 0.03, deskTop + 0.01, padZ);
  const penModel = handPropModel("pen", memberPropLooks.komachi);
  penModel.rotation.set(-Math.PI / 2, 0, 0);
  // Beside the notebook, which is 0.2 m wide now, not sunk into its pages.
  const pen = deskItem(penModel, padX + 0.125, deskTop + 0.004, padZ);
  // Reference books, the top one taken down to read.
  const stack = new Group();
  for (const [index, color] of ["#5a4f78", "#2f6fd6", "#c97b6b"].entries()) {
    const book = box(0.16, 0.025, 0.115, standard(color, 0.8), 0, deskTop + index * 0.025, 0);
    book.rotation.y = (index - 1) * 0.08;
    stack.add(book);
  }
  stack.position.set(-0.44, 0, nearEdge(depth) - 0.12);
  const bookModel = new Group();
  bookModel.add(box(0.15, 0.022, 0.11, standard("#9fb3e8", 0.8), 0, 0, 0));
  const book = deskItem(bookModel, -0.44, deskTop + 0.075, nearEdge(depth) - 0.12);
  inner.add(keyboard.root, mouse.root, mug, notebook, writingPad, pen, stack, book, unit);
  return {
    root: placedDesk(piece, inner),
    workstation: {
      screen,
      keyboard,
      mouse,
      mug,
      ...noDeskThings,
      items: { pen, book },
      writingPad,
      mugSide: "left",
      drawer,
    },
  };
}

/** Security: findings on the main screen, the scan log on a vertical one, a hardware key and a padlock to fidget with. */
function mirukuDesk(piece: Furniture): DeskBuild {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.miruku);
  const back = -depth / 2 + 0.16;
  inner.add(
    monitor(screen.texture, landscape.width, landscape.height, -0.12, back),
    monitor(securityLogTexture(), portrait.width, portrait.height, 0.28, back + 0.03, -0.25),
  );
  const { keyboard, mouse, mug, unit, drawer } = deskBasics("miruku", width, depth);
  // A small hub between the keyboard and her mug with her security key in it, tapped with the left
  // hand to approve each sign-in.
  const hub = box(0.06, 0.016, 0.03, standard(palette.ink, 0.5), 0, 0, 0);
  const keyBody = box(0.018, 0.006, 0.03, standard("#1b1b1f", 0.4), 0, 0.016, 0.02);
  const contact = mesh(new CylinderGeometry(0.005, 0.005, 0.002, 12), standard("#c9a24a", 0.3, 0.8));
  contact.position.set(0, 0.023, 0.026);
  const securityKey = new Group();
  securityKey.add(hub, keyBody, contact);
  securityKey.position.set(-0.25, deskTop, nearEdge(depth) - 0.1);
  securityKey.rotation.y = 0.3;
  const padlock = deskItem(handPropModel("padlock"), 0.38, deskTop + 0.028, nearEdge(depth) - 0.12);
  padlock.rotation.y = 0.4;
  inner.add(keyboard.root, mouse.root, mug, securityKey, padlock, unit);
  return {
    root: placedDesk(piece, inner),
    workstation: {
      screen,
      keyboard,
      mouse,
      mug,
      ...noDeskThings,
      items: { "security-key": securityKey, padlock },
      mugSide: "left",
      drawer,
    },
  };
}

/** UI/UX: the design doc on screen, a drawing tablet with its stylus, a swatch fan and a sketchbook. */
function huaguaDesk(piece: Furniture): DeskBuild {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.huagua);
  inner.add(monitor(screen.texture, landscape.width, landscape.height, -0.08, -depth / 2 + 0.16));
  const { keyboard, mouse, mug, unit, drawer } = deskBasics("huagua", width, depth);
  // The tablet takes the spot by her right hand, angled toward it, and the mouse moves aside.
  const padX = 0.37;
  const padZ = nearEdge(depth) - 0.02;
  mouse.root.position.set(0.62, deskTop, nearEdge(depth) - 0.14);
  const tablet = new Group();
  tablet.add(
    box(0.24, 0.01, 0.16, standard("#1b1b1f", 0.4), 0, deskTop, 0),
    box(0.19, 0.002, 0.12, glow("#3b4a5e", 0.4), -0.01, deskTop + 0.01, 0),
  );
  tablet.position.set(padX, 0, padZ);
  tablet.rotation.y = -0.12;
  const writingPad = new Group();
  writingPad.position.set(padX - 0.01, deskTop + 0.012, padZ);
  const stylusModel = handPropModel("pen", memberPropLooks.huagua);
  stylusModel.rotation.set(-Math.PI / 2, 0, 0);
  const pen = deskItem(stylusModel, padX + 0.105, deskTop + 0.014, padZ);
  const swatchModel = handPropModel("swatch");
  swatchModel.rotation.set(0, 0.6, 0);
  // Clear of the mug at -0.36: the fan is 0.16 m long now.
  const swatch = deskItem(swatchModel, -0.6, deskTop + 0.004, nearEdge(depth) - 0.12);
  const sketchbook = box(0.15, 0.014, 0.11, standard("#9fd2b0", 0.8), -0.58, deskTop, -0.2);
  sketchbook.rotation.y = 0.2;
  inner.add(keyboard.root, mouse.root, mug, tablet, writingPad, pen, swatch, sketchbook, unit);
  return {
    root: placedDesk(piece, inner),
    workstation: {
      screen,
      keyboard,
      mouse,
      mug,
      ...noDeskThings,
      items: { pen, swatch },
      writingPad,
      mugSide: "left",
      drawer,
    },
  };
}

/** A desk as its builder makes it; the lamp and the return's things are added the same way to every desk. */
interface DeskBuild {
  root: Group;
  workstation: Omit<Workstation, "lamp" | "gadget">;
}

function deskParts(member: DeskMember, piece: Furniture, kanban: Texture): DeskBuild {
  switch (member) {
    case "asuna":
      return asunaDesk(piece);
    case "kobayashi":
      return kobayashiDesk(piece);
    case "erza":
      return erzaDesk(piece);
    case "yor":
      return yorDesk(piece);
    case "twob":
      return twobDesk(piece);
    case "ruby":
      return rubyDesk(piece);
    case "rias":
      return riasDesk(piece);
    case "chizuru":
      return chizuruDesk(piece);
    case "arisu":
      return arisuDesk(piece, kanban);
    case "komachi":
      return komachiDesk(piece);
    case "miruku":
      return mirukuDesk(piece);
    case "huagua":
      return huaguaDesk(piece);
  }
}

/** Where the lamp stands on each desk, along its back edge where nothing else is. */
const lampX: Record<DeskMember, number> = {
  asuna: 0.7,
  kobayashi: 0.7,
  erza: 0.7,
  yor: 0.7,
  twob: 0.7,
  ruby: 0.6,
  // Books and blueprints, or markers and a plant, take the corners.
  rias: 0.2,
  chizuru: 0.2,
  // On the planning pod's outer corner, clear of her second screen. Her desk faces the back
  // wall, so the outer (east) corner is on its -x side.
  arisu: -0.55,
  // Past the second screen, on the pod's outer corner.
  komachi: 0.56,
  // Clear of the log screen on the right.
  miruku: -0.62,
  huagua: 0.5,
};

/**
 * `returnSide` is the side of the desk its L-desk return is on, in the desk's frame (+1 the
 * sitter's right), or null for a desk without one.
 */
/**
 * The fan glow in each L-desk member's tower, picked for their work: cyan for data, red for
 * review, teal for planning, violet for the tech lead, green for security, pink for design.
 */
const towerGlow: Partial<Record<DeskMember, string>> = {
  asuna: "#3fd4ff",
  erza: "#ff4d5e",
  arisu: "#2ee6c0",
  komachi: "#9b6bff",
  miruku: "#3dff7a",
  huagua: "#ff5fc8",
};

export function buildDesk(
  member: DeskMember,
  piece: Furniture,
  kanban: Texture,
  returnSide: -1 | 1 | null = null,
): BuiltDesk {
  const built = deskParts(member, piece, kanban);
  const { width, depth } = deskSize(piece);
  // The L-desks' towers stand at the open end, away from the return, where they can be seen.
  const glowColor = towerGlow[member];
  if (glowColor !== undefined) {
    const side = returnSide === null ? 1 : -returnSide;
    // Under the desk at the back, its glass side turned to the sitter and the aisle behind them,
    // and brighter than the open-desk towers, since the desk shades it.
    const tower = pcTower(side * (width / 2 - 0.16), -depth / 2 + 0.22, glowColor, 1.8);
    tower.scale.setScalar(0.88);
    tower.rotation.y = -Math.PI / 2;
    built.root.add(tower);
  }
  const lamp = deskLamp(member, lampX[member], -depth / 2 + 0.1, depth);
  // The desk's root holds the desk frame, so the lamp goes in at desk coordinates.
  built.root.add(lamp.root);
  const onReturn = returnSide === null ? null : returnSetup(member, returnSide, depth, deskTop);
  if (onReturn !== null) {
    built.root.add(onReturn.root);
  }
  return {
    root: built.root,
    workstation: {
      ...built.workstation,
      items: { ...built.workstation.items, ...onReturn?.items },
      lamp,
      gadget: onReturn?.gadget ?? null,
    },
  };
}
