import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DataTexture,
  Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  type Object3D,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
  TorusGeometry,
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
import { handPropModel, type PropLook } from "./hand-props.js";
import { box, glow, mesh, palette, standard, unlit } from "./palette.js";
import { leafyCrown } from "./plant.js";
import {
  checklistTexture,
  jobRunsTexture,
  monitoringTexture,
  pipelineTexture,
  pullRequestsTexture,
} from "./textures.js";

export const deskTop = surface.desk;
/**
 * Bottom edge of a monitor panel: a short stand above the desk, so a seated chibi
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
      const lower = mesh(new CylinderGeometry(0.006, 0.006, 0.2, 8), black);
      lower.rotation.x = 0.35;
      const upper = mesh(new CylinderGeometry(0.006, 0.006, 0.18, 8), black);
      upper.rotation.x = 1.9;
      const head = mesh(new CylinderGeometry(0.018, 0.045, 0.07, 16, 1, true), black);
      head.rotation.x = 0.3;
      return {
        parts: [
          box(0.08, 0.014, 0.08, black, 0, y, 0),
          at(lower, 0, y + 0.1, 0.035),
          at(upper, 0, y + 0.2 + 0.0, 0.14),
          at(head, 0, y + 0.17, 0.23),
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
      const neck = mesh(new TorusGeometry(0.12, 0.007, 8, 20, Math.PI * 0.75), green);
      neck.rotation.y = -Math.PI / 2;
      const head = mesh(new CylinderGeometry(0.016, 0.04, 0.06, 14, 1, true), green);
      head.rotation.x = -0.4;
      return {
        parts: [
          at(mesh(new CylinderGeometry(0.045, 0.05, 0.02, 18), standard("#2b2b30", 0.5)), 0, y + 0.01, 0),
          at(neck, 0, y + 0.02, 0.12),
          at(head, 0, y + 0.115, 0.215),
          at(mesh(new SphereGeometry(0.013, 10, 8), bulb, false), 0, y + 0.1, 0.22),
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
  }
}

/**
 * The member's lamp at (x, z) in the desk's frame, turned toward the middle of the desk's front
 * edge, with its pool of light on the desk in front of it.
 */
function deskLamp(member: DeskMember, x: number, z: number, depth: number): DeskLamp {
  const root = new Group();
  const look = lampLook(member);
  root.add(...look.parts);
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
  pool.position.set(0, deskTop + 0.002, look.poolAhead);
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
};

/** The same mug the member carries, a size up on the desk so it reads from the room camera. */
function mugAt(member: MemberId, x: number, z: number): Group {
  const model = handPropModel("mug", memberPropLooks[member]);
  model.scale.setScalar(1.15);
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
    box(0.3, 0.17, 0.018, standard(palette.inkSoft, 0.5), 0, -0.085, -0.009),
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
const portrait = { width: 0.2, height: 0.32 };
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
    box(0.12, 0.012, 0.09, ink, 0, deskTop, 0),
    box(0.025, y - deskTop + height * 0.3, 0.02, ink, 0, deskTop, -0.02),
    box(width + 0.02, height + 0.02, 0.02, ink, 0, y - 0.01, 0),
  );
  const panel = mesh(new PlaneGeometry(width, height), unlit(map), false);
  panel.position.set(0, y + height / 2, 0.012);
  group.add(panel);
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  return group;
}

/** Desktop tower beside the desk with a glass side and RGB fans: the gaming half of the setup. */
function pcTower(x: number, z: number, glowColor: string = palette.accent): Group {
  const group = new Group();
  group.add(
    box(0.16, 0.36, 0.34, standard(palette.inkDeep, 0.35, 0.3), 0, 0, 0),
    box(0.005, 0.3, 0.28, glow(glowColor, 1.4), 0.082, 0.03, 0),
    box(0.1, 0.012, 0.012, glow(glowColor, 1.8), 0, 0.33, 0.171),
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
  group.add(box(0.07, 0.01, 0.07, ink, 0, deskTop, 0), box(0.012, 0.16, 0.012, ink, 0, deskTop, 0));
  const band = mesh(new CylinderGeometry(0.05, 0.05, 0.02, 16, 1, true, -Math.PI / 2, Math.PI), ink);
  band.rotation.z = Math.PI / 2;
  band.rotation.y = Math.PI / 2;
  band.position.set(0, deskTop + 0.16, 0);
  const cupMaterial = standard(palette.ink, 0.5);
  const leftCup = mesh(new CylinderGeometry(0.025, 0.025, 0.02, 12), cupMaterial);
  leftCup.rotation.z = Math.PI / 2;
  leftCup.position.set(-0.05, deskTop + 0.13, 0);
  const rightCup = leftCup.clone();
  rightCup.position.x = 0.05;
  group.add(band, leftCup, rightCup, box(0.004, 0.012, 0.03, glow(), 0.062, deskTop + 0.125, -0.015));
  group.position.set(x, 0, z);
  return group;
}

/** Near the front edge, the way people pull a keyboard close: chibi arms are short. */
function keyboardZ(deskDepth: number): number {
  return deskDepth / 2 - 0.115;
}

function keyboardFor(member: DeskMember, z: number): Keyboard {
  const keyboard = new Keyboard(palette.accent, palette.inkDeep, palette.inkSoft);
  keyboard.root.position.set(0, deskTop, z);
  keyboard.root.name = `keyboard-${member}`;
  return keyboard;
}

/** Just right of the keyboard, within a chibi arm's reach and clear of the mugs at x 0.42 and beyond. */
function mouseBeside(keyboard: Keyboard, accent: string, base: string): DeskMouse {
  const mouse = new DeskMouse(accent, base);
  mouse.root.position.set(keyboard.root.position.x + 0.26, deskTop, keyboard.root.position.z + 0.02);
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
    pcTower(width / 2 - 0.14, 0, "#5fa8d3"),
  );
  const keyboard = keyboardFor("asuna", keyboardZ(depth));
  const mouse = mouseBeside(keyboard, palette.accent, palette.inkDeep);
  const mug = mugAt("asuna", 0.36, nearEdge(depth));
  const { unit, drawer } = drawerUnit(width, depth, "left");
  // A rubber duck for talking a broken pipeline through.
  const duck = deskItem(handPropModel("duck"), -0.33, deskTop + 0.018, nearEdge(depth));
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
  const plush = deskItem(handPropModel("plush"), -0.4, deskTop + 0.04, nearEdge(depth) - 0.03);
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
    pcTower(width / 2 - 0.14, 0, "#e35d5d"),
  );
  const keyboard = keyboardFor("erza", keyboardZ(depth));
  const mouse = mouseBeside(keyboard, palette.accent, palette.inkDeep);
  const cakeX = -0.34;
  const cakeZ = nearEdge(depth) - 0.02;
  const plate = mesh(new CylinderGeometry(0.05, 0.05, 0.006, 20), standard(palette.laminate, 0.4));
  plate.position.set(cakeX, deskTop + 0.003, cakeZ);
  const cake = box(0.05, 0.045, 0.035, standard("#f6efe4", 0.8), cakeX, deskTop + 0.006, cakeZ);
  const berry = mesh(new SphereGeometry(0.01, 10, 8), standard("#d23b4a", 0.5));
  berry.position.set(cakeX, deskTop + 0.06, cakeZ);
  const forkModel = handPropModel("fork");
  const bite = forkModel.getObjectByName("bite");
  if (bite !== undefined) {
    bite.visible = false;
  }
  // Lying flat beside the plate, tines away from her.
  forkModel.rotation.x = -Math.PI / 2;
  const fork = deskItem(forkModel, cakeX + 0.07, deskTop + 0.004, cakeZ);
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
  const vase = mesh(new CylinderGeometry(0.018, 0.022, 0.09, 12), standard(palette.glass, 0.1));
  vase.position.set(vaseX, deskTop + 0.045, vaseZ);
  // Held by the stem just above the vase; the stem goes down into the water.
  const rose = deskItem(handPropModel("rose"), vaseX, deskTop + 0.1, vaseZ);
  const mug = mugAt("yor", 0.36, nearEdge(depth));
  const { unit, drawer } = drawerUnit(width, depth, "right");
  inner.add(keyboard.root, mouse.root, vase, rose, mug, unit);
  return {
    root: placedDesk(piece, inner),
    workstation: { screen, keyboard, mouse, mug, ...noDeskThings, items: { rose }, drawer },
  };
}

/** PA + PM: the plan she types and the team's sprint, with the printer cabinet at her side. */
function twobDesk(piece: Furniture, kanban: Texture): DeskBuild {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.twob);
  const back = -depth / 2 + 0.15;
  inner.add(
    monitor(screen.texture, landscape.width, landscape.height, -0.24, back, 0.12),
    monitor(kanban, landscape.width, landscape.height, 0.24, back, -0.12),
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
function laptop(screen: ScreenSurface, depth: number, shell: string, keys: string): Laptop {
  const keyboard = new Keyboard(palette.accent, shell, keys);
  keyboard.root.position.set(0, deskTop, keyboardZ(depth));
  const mouse = mouseBeside(keyboard, palette.accent, keys);
  const lid = new Group();
  lid.position.set(0, deskTop + 0.01, keyboardZ(depth) - 0.11);
  lid.rotation.x = 0.25;
  lid.userData.openAngle = 0.25;
  lid.add(box(0.38, 0.24, 0.012, standard(shell, 0.5), 0, 0, -0.006));
  const panel = mesh(new PlaneGeometry(0.36, 0.225), unlit(screen.texture), false);
  panel.position.set(0, 0.12, 0.001);
  lid.add(panel);
  return { keyboard, mouse, lid };
}

/** Content creator: laptop for drafting, a boom mic for voice-overs. */
function rubyDesk(piece: Furniture): DeskBuild {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.ruby);
  const { keyboard, mouse, lid } = laptop(screen, depth, "#d9d4cc", "#efebe5");
  const ink = standard(palette.ink, 0.5);
  const boom = new Group();
  boom.add(box(0.016, 0.26, 0.016, ink, 0, deskTop, 0), box(0.016, 0.016, 0.24, ink, 0, deskTop + 0.25, 0.1));
  const mic = mesh(new CylinderGeometry(0.022, 0.022, 0.09, 12), standard(palette.inkDeep, 0.3, 0.3));
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
    new PlaneGeometry(0.15, 0.15),
    new MeshStandardMaterial({ map: chessTexture(), roughness: 0.5 }),
    false,
  );
  board.rotation.x = -Math.PI / 2;
  board.position.set(boardX, boardTop + 0.0005, boardZ);
  const square = 0.15 / 8;
  const at = (column: number, row: number, height: number): Vector3 =>
    new Vector3(boardX + (column - 3.5) * square, boardTop + height, boardZ + (row - 3.5) * square);
  const pieces = new Group();
  for (const [color, column, row, height] of [
    ["#b3262f", 2, 6, 0.03],
    ["#b3262f", 5, 7, 0.026],
    ["#1d1a1f", 3, 1, 0.03],
    ["#1d1a1f", 6, 2, 0.026],
    ["#1d1a1f", 1, 0, 0.034],
  ] as const) {
    const placed = chessPiece(color, height);
    placed.position.copy(at(column, row, height));
    pieces.add(placed);
  }
  // Her queen, the piece she keeps moving while she thinks.
  const queenHeight = 0.036;
  // Between two squares on the side nearest her, where her hand reaches.
  const chessMove: [Vector3, Vector3] = [at(6, 7, queenHeight), at(5, 4, queenHeight)];
  const queen = chessPiece("#b3262f", queenHeight);
  queen.position.copy(chessMove[0]);

  const saucer = mesh(new CylinderGeometry(0.036, 0.03, 0.006, 18), standard("#f7f1ea", 0.3));
  saucer.position.set(0.32, deskTop + 0.003, nearEdge(depth) + 0.04);
  const teacup = deskItem(handPropModel("teacup"), 0.32, deskTop + 0.021, nearEdge(depth) + 0.04);

  const books = new Group();
  for (const [index, color] of ["#5c2a35", "#2f3b55", "#c9a24a"].entries()) {
    const book = box(0.15 - index * 0.012, 0.028, 0.2, standard(color, 0.8), 0, deskTop + index * 0.028);
    book.rotation.y = (index - 1) * 0.12;
    books.add(book);
  }
  books.position.set(-0.52, 0, back + 0.04);
  const rolls = new Group();
  for (const [index, color] of ["#4a78b5", "#e9eef5"].entries()) {
    const roll = mesh(new CylinderGeometry(0.018, 0.018, 0.34, 12), standard(color, 0.8));
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, deskTop + 0.018 + index * 0.03, index * 0.012);
    rolls.add(roll);
  }
  rolls.position.set(0.5, 0, back + 0.04);
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
  const pot = mesh(new CylinderGeometry(0.035, 0.028, 0.06, 14), standard("#f4efe6", 0.6));
  pot.position.y = deskTop + 0.03;
  const crown = leafyCrown(0.035, palette.leaf, palette.leafDark);
  crown.position.y = deskTop + 0.055;
  plant.add(pot, crown);
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

/** A desk as its builder makes it; the lamp is added the same way to every desk. */
interface DeskBuild {
  root: Group;
  workstation: Omit<Workstation, "lamp">;
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
      return twobDesk(piece, kanban);
    case "ruby":
      return rubyDesk(piece);
    case "rias":
      return riasDesk(piece);
    case "chizuru":
      return chizuruDesk(piece);
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
};

export function buildDesk(member: DeskMember, piece: Furniture, kanban: Texture): BuiltDesk {
  const built = deskParts(member, piece, kanban);
  const { depth } = deskSize(piece);
  const lamp = deskLamp(member, lampX[member], -depth / 2 + 0.1, depth);
  // The desk's root holds the desk frame, so the lamp goes in at desk coordinates.
  built.root.add(lamp.root);
  return { root: built.root, workstation: { ...built.workstation, lamp } };
}
