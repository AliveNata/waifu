import {
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  type Material,
  PlaneGeometry,
  SphereGeometry,
  type Texture,
  TorusGeometry,
} from "three";
import type { MemberId } from "../../../shared/team.js";
import { type Furniture, surface } from "../office-plan.js";
import { Keyboard } from "../surfaces/keyboard.js";
import { DeskMouse } from "../surfaces/mouse.js";
import { type ScreenSize, ScreenSurface } from "../surfaces/screen.js";
import { screenScripts } from "../surfaces/screen-scripts.js";
import { box, glow, mesh, palette, standard, unlit } from "./palette.js";
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

export type DeskMember = Extract<MemberId, "asuna" | "kobayashi" | "erza" | "yor" | "twob" | "ruby">;

export interface Workstation {
  screen: ScreenSurface;
  keyboard: Keyboard;
  /** To the right of the keyboard, for the typist's occasional mouse work. */
  mouse: DeskMouse;
  /** The member's own mug on the desk. Hidden while they carry it to the pantry and back. */
  mug: Group;
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

/** Docked handheld console with red and blue controllers, the kind that lives on a dev's desk. */
function handheldDock(x: number, z: number): Group {
  const group = new Group();
  group.add(
    box(0.12, 0.07, 0.03, standard("#2b2b30", 0.5), 0, deskTop, 0),
    box(0.14, 0.075, 0.012, standard("#121214", 0.3), 0, deskTop + 0.02, 0.02),
    box(0.022, 0.075, 0.014, standard("#e0453a", 0.5), -0.081, deskTop + 0.02, 0.02),
    box(0.022, 0.075, 0.014, standard("#2f8fd8", 0.5), 0.081, deskTop + 0.02, 0.02),
  );
  group.position.set(x, 0, z);
  group.rotation.y = -0.3;
  return group;
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
function asunaDesk(piece: Furniture): BuiltDesk {
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
  const mug = coffeeMug(0.42, depth / 2 - 0.18);
  inner.add(keyboard.root, mouse.root, mug);
  return { root: placedDesk(piece, inner), workstation: { screen, keyboard, mouse, mug } };
}

/** Full stack: an ultrawide for code and preview, a vertical screen for PRs, a docked console and a dragon plush. */
function kobayashiDesk(piece: Furniture): BuiltDesk {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.kobayashi, ultrawideScreen);
  const back = -depth / 2 + 0.16;
  inner.add(
    monitor(screen.texture, 0.72, 0.288, 0.05, back),
    monitor(pullRequestsTexture(), portrait.width, portrait.height, -0.5, back + 0.05, 0.35),
    handheldDock(0.6, back + 0.08),
    pcTower(-width / 2 + 0.14, 0),
  );
  const keyboard = keyboardFor("kobayashi", keyboardZ(depth));
  const mouse = mouseBeside(keyboard, palette.accent, palette.inkDeep);
  const plush = new Group();
  const body = mesh(new SphereGeometry(0.045, 12, 10), standard("#9fd6b4", 0.9));
  body.scale.set(1, 0.85, 1.1);
  const horn = mesh(new CylinderGeometry(0.003, 0.009, 0.03, 6), standard(palette.laminate, 0.6));
  horn.position.set(0.02, 0.045, 0.008);
  const hornLeft = horn.clone();
  hornLeft.position.x = -0.02;
  plush.add(body, horn, hornLeft);
  plush.position.set(-0.6, deskTop + 0.04, depth / 2 - 0.22);
  const mug = coffeeMug(0.5, depth / 2 - 0.18);
  inner.add(keyboard.root, mouse.root, plush, mug);
  return { root: placedDesk(piece, inner), workstation: { screen, keyboard, mouse, mug } };
}

/** Reviewer: the diff on a wide screen, her checklist on a vertical one, and a slice of strawberry cake. */
function erzaDesk(piece: Furniture): BuiltDesk {
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
  const plate = mesh(new CylinderGeometry(0.05, 0.05, 0.006, 20), standard(palette.laminate, 0.4));
  plate.position.set(-0.55, deskTop + 0.003, depth / 2 - 0.2);
  const cake = box(0.05, 0.045, 0.035, standard("#f6efe4", 0.8), -0.55, deskTop + 0.006, depth / 2 - 0.2);
  const berry = mesh(new SphereGeometry(0.01, 10, 8), standard("#d23b4a", 0.5));
  berry.position.set(-0.55, deskTop + 0.06, depth / 2 - 0.2);
  const mug = coffeeMug(0.45, depth / 2 - 0.18);
  inner.add(keyboard.root, mouse.root, plate, cake, berry, mug);
  return { root: placedDesk(piece, inner), workstation: { screen, keyboard, mouse, mug } };
}

/** Platform/SRE: terminal plus monitoring, a headset for incident calls, and a single rose. */
function yorDesk(piece: Furniture): BuiltDesk {
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
  const vase = mesh(new CylinderGeometry(0.018, 0.022, 0.09, 12), standard(palette.glass, 0.1));
  vase.position.set(0.6, deskTop + 0.045, depth / 2 - 0.25);
  const stem = mesh(new CylinderGeometry(0.003, 0.003, 0.1, 6), standard(palette.leafDark, 0.8));
  stem.position.set(0.6, deskTop + 0.13, depth / 2 - 0.25);
  const rose = mesh(new IcosahedronGeometry(0.018, 1), standard("#b3262f", 0.7));
  rose.position.set(0.6, deskTop + 0.19, depth / 2 - 0.25);
  const mug = coffeeMug(0.42, depth / 2 - 0.18);
  inner.add(keyboard.root, mouse.root, vase, stem, rose, mug);
  return { root: placedDesk(piece, inner), workstation: { screen, keyboard, mouse, mug } };
}

/** PA + PM: the plan she types and the team's sprint, with the printer cabinet at her side. */
function twobDesk(piece: Furniture, kanban: Texture): BuiltDesk {
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
  const mug = coffeeMug(-0.55, depth / 2 - 0.18);
  inner.add(keyboard.root, mouse.root, mug);
  return { root: placedDesk(piece, inner), workstation: { screen, keyboard, mouse, mug } };
}

/** Content creator: laptop for drafting, a boom mic for voice-overs. */
function rubyDesk(piece: Furniture): BuiltDesk {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.ruby);
  const keyboard = new Keyboard(palette.accent, "#d9d4cc", "#efebe5");
  keyboard.root.position.set(0, deskTop, keyboardZ(depth));
  const mouse = mouseBeside(keyboard, palette.accent, "#efebe5");
  const lid = new Group();
  lid.position.set(0, deskTop + 0.01, keyboardZ(depth) - 0.11);
  lid.rotation.x = 0.25;
  lid.add(box(0.38, 0.24, 0.012, standard("#d9d4cc", 0.5), 0, 0, -0.006));
  const panel = mesh(new PlaneGeometry(0.36, 0.225), unlit(screen.texture), false);
  panel.position.set(0, 0.12, 0.001);
  lid.add(panel);
  const ink = standard(palette.ink, 0.5);
  const boom = new Group();
  boom.add(box(0.016, 0.26, 0.016, ink, 0, deskTop, 0), box(0.016, 0.016, 0.24, ink, 0, deskTop + 0.25, 0.1));
  const mic = mesh(new CylinderGeometry(0.022, 0.022, 0.09, 12), standard(palette.inkDeep, 0.3, 0.3));
  mic.position.set(0, deskTop + 0.22, 0.22);
  boom.add(mic, box(0.01, 0.01, 0.008, glow(), 0, deskTop + 0.245, 0.24));
  boom.position.set(-0.45, 0, -depth / 2 + 0.1);
  const mug = coffeeMug(0.42, depth / 2 - 0.18);
  inner.add(keyboard.root, mouse.root, lid, boom, mug);
  return { root: placedDesk(piece, inner), workstation: { screen, keyboard, mouse, mug } };
}

function coffeeMug(x: number, z: number): Group {
  const group = new Group();
  const material: Material = standard(palette.laminate, 0.4);
  const cup = mesh(new CylinderGeometry(0.026, 0.022, 0.06, 12), material);
  cup.position.y = deskTop + 0.03;
  const handle = mesh(new TorusGeometry(0.014, 0.004, 6, 12), material);
  handle.position.set(0.03, deskTop + 0.032, 0);
  group.add(cup, handle);
  group.position.set(x, 0, z);
  return group;
}

export function buildDesk(member: DeskMember, piece: Furniture, kanban: Texture): BuiltDesk {
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
  }
}
