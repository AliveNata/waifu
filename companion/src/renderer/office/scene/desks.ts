import {
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  type Material,
  PlaneGeometry,
  SphereGeometry,
  type Texture,
} from "three";
import type { MemberId } from "../../../shared/team.js";
import type { Furniture } from "../office-plan.js";
import { Keyboard } from "../surfaces/keyboard.js";
import { type ScreenSize, ScreenSurface } from "../surfaces/screen.js";
import { screenScripts } from "../surfaces/screen-scripts.js";
import { box, glow, mesh, palette, standard, unlit } from "./palette.js";
import { checklistTexture, dashboardTexture, monitoringTexture, pipelineTexture } from "./textures.js";

export const deskTop = 0.55;

export type DeskMember = Extract<MemberId, "asuna" | "kobayashi" | "erza" | "yor" | "twob" | "ruby">;

export interface Workstation {
  screen: ScreenSurface;
  keyboard: Keyboard;
}

export interface BuiltDesk {
  root: Group;
  workstation: Workstation;
}

const portraitScreen: ScreenSize = { width: 400, height: 640 };
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
function monitor(map: Texture, width: number, height: number, x: number, y: number, z: number, yaw = 0): Group {
  const group = new Group();
  const ink = standard(palette.inkDeep, 0.4, 0.2);
  group.add(
    box(0.18, 0.015, 0.12, ink, 0, deskTop, 0),
    box(0.035, y - deskTop + height * 0.3, 0.03, ink, 0, deskTop, -0.02),
    box(width + 0.03, height + 0.03, 0.03, ink, 0, y - 0.015, 0),
  );
  const panel = mesh(new PlaneGeometry(width, height), unlit(map), false);
  panel.position.set(0, y + height / 2, 0.017);
  group.add(panel);
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  return group;
}

function keyboardFor(member: DeskMember, z: number): Keyboard {
  const keyboard = new Keyboard(palette.accent, palette.inkDeep, palette.inkSoft);
  keyboard.root.position.set(0, deskTop, z);
  keyboard.root.name = `keyboard-${member}`;
  return keyboard;
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

/** Data engineer: SQL in the middle, the pipeline DAG and the dashboard she feeds on either side. */
function asunaDesk(piece: Furniture): BuiltDesk {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.asuna);
  const back = -depth / 2 + 0.18;
  inner.add(
    monitor(screen.texture, 0.6, 0.375, 0, 0.78, back),
    monitor(pipelineTexture(), 0.5, 0.31, -0.6, 0.8, back + 0.08, 0.4),
    monitor(dashboardTexture(), 0.5, 0.31, 0.6, 0.8, back + 0.08, -0.4),
  );
  const keyboard = keyboardFor("asuna", depth / 2 - 0.2);
  inner.add(keyboard.root, coffeeMug(0.55, depth / 2 - 0.2));
  return { root: placedDesk(piece, inner), workstation: { screen, keyboard } };
}

/** Full stack: one ultrawide for code and preview side by side, and a small dragon plush. */
function kobayashiDesk(piece: Furniture): BuiltDesk {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.kobayashi, ultrawideScreen);
  inner.add(monitor(screen.texture, 1.1, 0.44, 0, 0.78, -depth / 2 + 0.18));
  const keyboard = keyboardFor("kobayashi", depth / 2 - 0.2);
  const plush = new Group();
  const body = mesh(new SphereGeometry(0.06, 12, 10), standard("#9fd6b4", 0.9));
  body.scale.set(1, 0.85, 1.1);
  const horn = mesh(new CylinderGeometry(0.004, 0.012, 0.04, 6), standard(palette.laminate, 0.6));
  horn.position.set(0.025, 0.06, 0.01);
  const hornLeft = horn.clone();
  hornLeft.position.x = -0.025;
  plush.add(body, horn, hornLeft);
  plush.position.set(-0.62, deskTop + 0.05, depth / 2 - 0.25);
  inner.add(keyboard.root, plush);
  return { root: placedDesk(piece, inner), workstation: { screen, keyboard } };
}

/** Reviewer: two portrait monitors, the diff and her checklist, and a slice of strawberry cake. */
function erzaDesk(piece: Furniture): BuiltDesk {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.erza, portraitScreen);
  const back = -depth / 2 + 0.18;
  inner.add(
    monitor(screen.texture, 0.32, 0.51, -0.2, 0.72, back, 0.12),
    monitor(checklistTexture(), 0.32, 0.51, 0.2, 0.72, back, -0.12),
  );
  const keyboard = keyboardFor("erza", depth / 2 - 0.2);
  const plate = mesh(new CylinderGeometry(0.07, 0.07, 0.008, 20), standard(palette.laminate, 0.4));
  plate.position.set(0.6, deskTop + 0.004, depth / 2 - 0.22);
  const cake = box(0.07, 0.06, 0.05, standard("#f6efe4", 0.8), 0.6, deskTop + 0.008, depth / 2 - 0.22);
  const berry = mesh(new SphereGeometry(0.014, 10, 8), standard("#d23b4a", 0.5));
  berry.position.set(0.6, deskTop + 0.08, depth / 2 - 0.22);
  inner.add(keyboard.root, plate, cake, berry);
  return { root: placedDesk(piece, inner), workstation: { screen, keyboard } };
}

/** Platform/SRE: terminal plus the monitoring view, and a single rose for the Thorn Princess. */
function yorDesk(piece: Furniture): BuiltDesk {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.yor);
  const back = -depth / 2 + 0.18;
  inner.add(
    monitor(screen.texture, 0.56, 0.35, -0.32, 0.78, back, 0.1),
    monitor(monitoringTexture(), 0.56, 0.35, 0.32, 0.78, back, -0.1),
  );
  const keyboard = keyboardFor("yor", depth / 2 - 0.2);
  const vase = mesh(new CylinderGeometry(0.025, 0.03, 0.12, 12), standard(palette.glass, 0.1));
  vase.position.set(0.66, deskTop + 0.06, depth / 2 - 0.25);
  const stem = mesh(new CylinderGeometry(0.004, 0.004, 0.14, 6), standard(palette.leafDark, 0.8));
  stem.position.set(0.66, deskTop + 0.18, depth / 2 - 0.25);
  const rose = mesh(new IcosahedronGeometry(0.025, 1), standard("#b3262f", 0.7));
  rose.position.set(0.66, deskTop + 0.26, depth / 2 - 0.25);
  inner.add(keyboard.root, vase, stem, rose);
  return { root: placedDesk(piece, inner), workstation: { screen, keyboard } };
}

/** PA + PM: two monitors facing her, the plan she types and the team's sprint. */
function twobDesk(piece: Furniture, kanban: Texture): BuiltDesk {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.twob);
  const back = -depth / 2 + 0.16;
  inner.add(
    monitor(screen.texture, 0.52, 0.325, -0.3, 0.78, back, 0.12),
    monitor(kanban, 0.52, 0.325, 0.3, 0.78, back, -0.12),
  );
  const keyboard = keyboardFor("twob", depth / 2 - 0.18);
  inner.add(keyboard.root, coffeeMug(-0.66, depth / 2 - 0.2));
  return { root: placedDesk(piece, inner), workstation: { screen, keyboard } };
}

/** Content creator: laptop for drafting, a boom mic for voice-overs. */
function rubyDesk(piece: Furniture): BuiltDesk {
  const { width, depth } = deskSize(piece);
  const inner = deskBase(width, depth);
  const screen = new ScreenSurface(screenScripts.ruby);
  const keyboard = new Keyboard(palette.accent, "#d9d4cc", "#efebe5");
  keyboard.root.position.set(0, deskTop, depth / 2 - 0.2);
  const lid = new Group();
  lid.position.set(0, deskTop + 0.01, depth / 2 - 0.33);
  lid.rotation.x = 0.25;
  lid.add(box(0.46, 0.3, 0.015, standard("#d9d4cc", 0.5), 0, 0, -0.008));
  const panel = mesh(new PlaneGeometry(0.44, 0.275), unlit(screen.texture), false);
  panel.position.set(0, 0.15, 0.001);
  lid.add(panel);
  const ink = standard(palette.ink, 0.5);
  const boom = new Group();
  boom.add(box(0.02, 0.35, 0.02, ink, 0, deskTop, 0), box(0.02, 0.02, 0.32, ink, 0, deskTop + 0.34, 0.14));
  const mic = mesh(new CylinderGeometry(0.03, 0.03, 0.12, 12), standard(palette.inkDeep, 0.3, 0.3));
  mic.position.set(0, deskTop + 0.3, 0.3);
  boom.add(mic, box(0.012, 0.012, 0.01, glow(), 0, deskTop + 0.33, 0.33));
  boom.position.set(-0.5, 0, -depth / 2 + 0.12);
  inner.add(keyboard.root, lid, boom);
  return { root: placedDesk(piece, inner), workstation: { screen, keyboard } };
}

function coffeeMug(x: number, z: number): Group {
  const group = new Group();
  const material: Material = standard(palette.laminate, 0.4);
  const cup = mesh(new CylinderGeometry(0.035, 0.03, 0.08, 12), material);
  cup.position.y = deskTop + 0.04;
  group.add(cup);
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
