import { CylinderGeometry, Group, type MeshStandardMaterial, type Object3D, Vector3 } from "three";
import type { MemberId } from "../../../shared/team.js";
import {
  type ActiveDeskBit,
  calendarStep,
  type DeskBit,
  type DeskItem,
  moodboardStep,
  piStep,
  safeStep,
  stampStep,
} from "../desk-habits.js";
import { handPropModel } from "./hand-props.js";
import { box, glow, mesh, palette, printed, standard } from "./palette.js";
import { approvedTexture, calendarTexture, moodboardTexture } from "./textures.js";

/**
 * Something on an L-desk's short leg with parts that move while its owner works it: a page that
 * flips, a door that opens, a card that moves, a plug that comes out.
 */
export interface DeskGadget {
  /** The desk bit that works it. */
  readonly bit: DeskBit;
  /** Touched with a fingertip, or (the stamp) with what the hand holds, so the wrist is aimed. */
  readonly tip: "fingertip" | "wrist";
  /** Every frame. `bit` is the gadget's own bit while it runs, otherwise null. */
  update(bit: ActiveDeskBit | null, time: number): void;
  /** Where the hand goes right now, in world space, or null to leave the arm to the pose. */
  handTarget(bit: ActiveDeskBit): Vector3 | null;
}

export interface ReturnSetup {
  /** Everything on the return, in the desk's frame. Only the moving parts are kept by the gadget. */
  root: Group;
  items: Partial<Record<DeskItem, Object3D>>;
  gadget: DeskGadget | null;
}

/**
 * Where the things on the return stand, in the desk's frame (the sitter at +z): next to the
 * sitter's hip, near the return's inner edge, so an arm reaches them by leaning over.
 */
const spotFromCenter = 0.47;
const spotPastFrontEdge = 0.12;
/** Turned to face the sitter, angled a little back toward the chair. */
const turnTowardChair = 0.25;

function wrap(model: Object3D, x: number, y: number, z: number): Group {
  const group = new Group();
  group.add(model);
  group.position.set(x, y, z);
  return group;
}

// The calendar: a tent of two leaves hanging from a ringed ridge, plus the page that flips.
const calendarSlope = 0.35;
const leafWidth = 0.15;
const leafHeight = 0.115;

class DeskCalendar implements DeskGadget {
  readonly bit = "calendar";
  readonly tip = "fingertip";

  constructor(
    private readonly page: Group,
    private readonly face: Group,
  ) {}

  update(bit: ActiveDeskBit | null): void {
    // Over the top and down the back; once the bit ends it is back on the front, which shows the
    // same picture as the leaf under it, so the reset cannot be seen.
    const flip = bit === null ? 0 : calendarStep(bit.elapsed).flip;
    this.page.rotation.x = -calendarSlope - flip * (Math.PI * 2 - 2 * calendarSlope);
  }

  handTarget(bit: ActiveDeskBit): Vector3 | null {
    const step = calendarStep(bit.elapsed);
    if (step.hand === "page") {
      return this.page.localToWorld(new Vector3(0, -leafHeight + 0.008, 0.008));
    }
    if (step.hand === "face") {
      return this.face.localToWorld(new Vector3(0.025, -0.06, 0.004 + 0.016 * (1 - step.press)));
    }
    return null;
  }
}

function calendarSetup(): ReturnSetup {
  const root = new Group();
  const paper = printed(calendarTexture());
  const ridgeY = leafHeight * Math.cos(calendarSlope) + 0.004;
  const leaf = (rotation: number, material: MeshStandardMaterial, offset = 0): Group => {
    const group = new Group();
    group.position.y = ridgeY;
    group.rotation.x = rotation;
    group.add(box(leafWidth, leafHeight, 0.003, material, 0, -leafHeight, offset));
    return group;
  };
  const face = leaf(-calendarSlope, paper);
  const page = leaf(-calendarSlope, paper, 0.0035);
  root.add(
    leaf(calendarSlope, standard("#2d3a5c", 0.7)),
    face,
    page,
    box(leafWidth * 0.8, 0.008, 0.008, standard(palette.steel, 0.3, 0.7), 0, ridgeY - 0.004, 0),
  );
  return { root, items: {}, gadget: new DeskCalendar(page, face) };
}

// The stamp hangs this far under the hand, from the grip to the rubber face.
const stampHeight = 0.063;

class StampSet implements DeskGadget {
  readonly bit = "stamp";
  readonly tip = "wrist";

  constructor(
    private readonly pad: Object3D,
    private readonly paper: Object3D,
    private readonly mark: Object3D,
  ) {}

  update(bit: ActiveDeskBit | null): void {
    // A fresh sheet for every run, which gets its mark from the press. The last mark stays.
    if (bit !== null) {
      this.mark.visible = stampStep(bit.elapsed).stamped;
    }
  }

  handTarget(bit: ActiveDeskBit): Vector3 | null {
    const step = stampStep(bit.elapsed);
    if (step.hand === null) {
      return null;
    }
    const anchor = step.hand === "pad" ? this.pad : this.paper;
    return anchor.localToWorld(new Vector3(0, stampHeight + 0.025 * (1 - step.press), 0));
  }
}

function stampSetup(side: -1 | 1): ReturnSetup {
  const root = new Group();
  // Toward the main desk is -side along the spot's x: the pad and stamp go there, nearer the hand.
  const towardDesk = -side;
  const padTop = 0.012;
  const pad = new Group();
  pad.position.set(towardDesk * 0.075, padTop, 0.01);
  const paperTop = 0.01;
  const paper = new Group();
  // Nearest the hand, so the press lands on the sheet rather than its edge.
  // A sheet at the room's scale, about A4, lying beside the pad rather than under it.
  paper.position.set(-towardDesk * 0.045, paperTop, 0.02);
  paper.rotation.y = 0.12;
  const mark = box(0.05, 0.0008, 0.022, printed(approvedTexture()), 0, 0, 0.012);
  mark.rotation.y = -0.08;
  mark.visible = false;
  paper.add(mark);
  root.add(
    box(0.06, padTop, 0.045, standard(palette.ink, 0.6), pad.position.x, 0, pad.position.z),
    box(0.05, 0.002, 0.035, standard("#8e2a2a", 0.9), pad.position.x, padTop - 0.0015, pad.position.z),
    box(0.15, paperTop, 0.2, standard("#f7f3ea", 0.9), paper.position.x, 0, paper.position.z),
    pad,
    paper,
  );
  const stamp = wrap(handPropModel("stamp"), towardDesk * 0.075, stampHeight + 0.002, -0.05);
  root.add(stamp);
  return { root, items: { stamp }, gadget: new StampSet(pad, paper, mark) };
}

const safeSize = 0.1;
const safeWall = 0.008;

class MiniSafe implements DeskGadget {
  readonly bit = "safe";
  readonly tip = "fingertip";

  constructor(
    private readonly door: Group,
    private readonly dial: Group,
    private readonly handle: Object3D,
  ) {}

  update(bit: ActiveDeskBit | null): void {
    const step = bit === null ? null : safeStep(bit.elapsed);
    this.door.rotation.y = -1.5 * (step?.door ?? 0);
    if (step !== null) {
      this.dial.rotation.z = step.dial;
    }
  }

  handTarget(bit: ActiveDeskBit): Vector3 | null {
    const step = safeStep(bit.elapsed);
    if (step.hand === "dial") {
      return this.dial.localToWorld(new Vector3(0.008, 0.006, 0.012));
    }
    if (step.hand === "handle") {
      return this.handle.localToWorld(new Vector3(0, 0, 0.01));
    }
    return null;
  }
}

function safeSetup(): ReturnSetup {
  const root = new Group();
  const steel = standard("#3a3f4a", 0.35, 0.6);
  const half = safeSize / 2;
  const inner = safeSize - 2 * safeWall;
  root.add(
    box(safeSize, safeWall, safeSize, steel, 0, 0, 0),
    box(safeSize, safeWall, safeSize, steel, 0, safeSize - safeWall, 0),
    box(safeWall, inner, safeSize, steel, -half + safeWall / 2, safeWall, 0),
    box(safeWall, inner, safeSize, steel, half - safeWall / 2, safeWall, 0),
    box(inner, inner, safeWall, steel, 0, safeWall, -half + safeWall / 2),
    // What a security engineer keeps locked up: two gold bars and a spare hardware key.
    box(0.032, 0.012, 0.02, standard("#d4af37", 0.3, 0.8), -0.012, safeWall, -0.012),
    box(0.032, 0.012, 0.02, standard("#d4af37", 0.3, 0.8), -0.012, safeWall + 0.012, -0.012),
    box(0.01, 0.004, 0.026, glow(palette.accent, 1.2), 0.022, safeWall, 0.0),
  );
  const door = new Group();
  door.position.set(-half, safeWall, half);
  door.add(box(safeSize - 0.004, inner, safeWall, standard("#4a505c", 0.3, 0.6), half - 0.002, 0, -safeWall / 2));
  const dial = new Group();
  dial.position.set(half - 0.018, inner * 0.6, 0.002);
  const knob = mesh(new CylinderGeometry(0.013, 0.013, 0.007, 16), standard(palette.steel, 0.3, 0.7));
  knob.rotation.x = Math.PI / 2;
  dial.add(knob, box(0.002, 0.008, 0.002, standard("#c0392b", 0.5), 0, 0.006, 0.004));
  const handle = new Group();
  handle.position.set(safeSize - 0.016, inner * 0.3, 0.004);
  handle.add(box(0.005, 0.024, 0.006, standard(palette.steel, 0.3, 0.7), 0, -0.012, 0));
  door.add(dial, handle);
  root.add(door);
  return { root, items: {}, gadget: new MiniSafe(door, dial, handle) };
}

function phoneStandSetup(): ReturnSetup {
  const root = new Group();
  const lean = -0.3;
  const back = new Group();
  back.position.set(0, 0.006, -0.013);
  back.rotation.x = lean;
  back.add(box(0.07, 0.112, 0.004, standard(palette.inkSoft, 0.5), 0, 0, -0.004));
  root.add(
    box(0.08, 0.006, 0.072, standard(palette.ink, 0.5), 0, 0, 0),
    box(0.07, 0.01, 0.006, standard(palette.ink, 0.5), 0, 0.006, 0.021),
    back,
  );
  // The build under test, propped up with its screen on: the same phone model as in the hand.
  const phone = wrap(handPropModel("phone"), 0, 0.067, 0.003);
  phone.rotation.x = lean;
  root.add(phone);
  return { root, items: { "test-phone": phone }, gadget: null };
}

class MoodEasel implements DeskGadget {
  readonly bit = "moodboard";
  readonly tip = "fingertip";
  private spot: 0 | 1 = 0;
  private movedBy: number | null = null;

  constructor(
    private readonly card: Object3D,
    private readonly spots: readonly [Vector3, Vector3],
  ) {}

  update(bit: ActiveDeskBit | null): void {
    const from = this.spots[this.spot];
    const to = this.spots[this.spot === 0 ? 1 : 0];
    if (bit === null || this.movedBy === bit.startedAt) {
      this.card.position.copy(from);
      return;
    }
    const { along } = moodboardStep(bit.elapsed);
    this.card.position.lerpVectors(from, to, along);
    // Lifted off the cork on the way over.
    this.card.position.z = from.z + 0.008 * Math.sin(Math.PI * along);
    if (along >= 1) {
      this.spot = this.spot === 0 ? 1 : 0;
      this.movedBy = bit.startedAt;
    }
  }

  handTarget(bit: ActiveDeskBit): Vector3 | null {
    const step = moodboardStep(bit.elapsed);
    if (!step.hand) {
      return null;
    }
    return this.card.localToWorld(new Vector3(0, 0, 0.004 + 0.012 * (1 - step.press)));
  }
}

function easelSetup(): ReturnSetup {
  const root = new Group();
  const wood = standard(palette.oak, 0.6);
  const legHeight = 0.18;
  const leg = (x: number, z: number, tiltX: number, tiltZ: number): Group => {
    const group = new Group();
    group.position.set(x, 0, z);
    group.rotation.set(tiltX, 0, tiltZ);
    group.add(box(0.006, legHeight, 0.006, wood, 0, 0, 0));
    return group;
  };
  const board = new Group();
  board.position.set(0, 0.05, 0.006);
  board.rotation.x = -0.2;
  board.add(
    box(0.13, 0.1, 0.004, printed(moodboardTexture()), 0, 0, 0),
    box(0.14, 0.006, 0.016, wood, 0, -0.006, 0.004),
  );
  const card = new Group();
  card.add(box(0.026, 0.026, 0.002, standard("#f2c94c", 0.8), 0, -0.013, 0));
  board.add(card);
  const spots: [Vector3, Vector3] = [new Vector3(-0.032, 0.075, 0.003), new Vector3(0.036, 0.04, 0.003)];
  root.add(leg(-0.05, 0.02, -0.12, 0.12), leg(0.05, 0.02, -0.12, -0.12), leg(0, -0.03, 0.35, 0), board);
  return { root, items: {}, gadget: new MoodEasel(card, spots) };
}

function printoutSetup(): ReturnSetup {
  const root = new Group();
  const sheet = standard("#f7f3ea", 0.9);
  const under = box(0.138, 0.0015, 0.196, sheet, 0.008, 0, -0.006);
  under.rotation.y = -0.15;
  root.add(under, box(0.138, 0.0015, 0.196, sheet, -0.006, 0.0015, 0.004));
  const printout = wrap(handPropModel("printout"), 0, 0.0035, 0);
  printout.rotation.y = 0.1;
  root.add(printout);
  return { root, items: { printout }, gadget: null };
}

/** The node whose cable Yor reseats. */
const reseatedNode = 1;
const piNodes = 4;
const plugTravel = 0.022;

class PiCluster implements DeskGadget {
  readonly bit = "pi-reseat";
  readonly tip = "fingertip";

  constructor(
    private readonly leds: readonly MeshStandardMaterial[],
    private readonly plug: Group,
    private readonly plugRestZ: number,
  ) {}

  update(bit: ActiveDeskBit | null, time: number): void {
    const step = bit === null ? null : piStep(bit.elapsed);
    this.plug.position.z = this.plugRestZ + plugTravel * (step?.out ?? 0);
    this.leds.forEach((led, index) => {
      let on: boolean;
      if (index === reseatedNode && step !== null && !step.linkUp) {
        on = false;
      } else if (index === reseatedNode && step?.booting === true) {
        on = Math.sin(time * 30) > 0;
      } else {
        // Mostly lit, with the short dark flickers of network traffic, each node at its own pace.
        on = Math.sin(time * (5 + index * 1.3) + index * 1.9) > -0.85;
      }
      led.emissiveIntensity = on ? 2 : 0.15;
    });
  }

  handTarget(bit: ActiveDeskBit): Vector3 | null {
    if (!piStep(bit.elapsed).hand) {
      return null;
    }
    return this.plug.localToWorld(new Vector3(0, 0.006, 0.006));
  }
}

function piClusterSetup(side: -1 | 1): ReturnSetup {
  const root = new Group();
  const board = standard("#2f7d4f", 0.6);
  const brass = standard("#c9a24a", 0.35, 0.6);
  const port = standard(palette.steel, 0.3, 0.6);
  const cable = standard("#5fa8d3", 0.6);
  const spacing = 0.022;
  const base = 0.006;
  root.add(box(0.1, base, 0.075, standard(palette.ink, 0.6), 0, 0, 0));
  for (const x of [-0.038, 0.038]) {
    for (const z of [-0.024, 0.024]) {
      root.add(box(0.004, spacing * piNodes, 0.004, brass, x, base, z));
    }
  }
  const leds: MeshStandardMaterial[] = [];
  let plug: Group | null = null;
  let plugRestZ = 0;
  for (let node = 0; node < piNodes; node++) {
    const y = base + 0.006 + node * spacing;
    const led = glow("#5fd38d", 2);
    leds.push(led);
    root.add(
      box(0.085, 0.003, 0.056, board, 0, y, 0),
      box(0.016, 0.012, 0.014, port, 0.022, y + 0.003, 0.021),
      box(0.004, 0.003, 0.004, led, -0.03, y + 0.003, 0.025),
    );
    const plugGroup = new Group();
    plugGroup.position.set(0.022, y + 0.004, 0.03);
    plugGroup.add(box(0.012, 0.009, 0.01, cable, 0, 0, 0), box(0.004, 0.004, 0.03, cable, 0, 0.0025, 0.018));
    root.add(plugGroup);
    if (node === reseatedNode) {
      plug = plugGroup;
      plugRestZ = plugGroup.position.z;
    }
  }
  // The small switch the nodes are cabled to, on the far side from the main desk.
  const switchX = side * 0.085;
  root.add(box(0.05, 0.02, 0.06, standard(palette.inkDeep, 0.5), switchX, 0, 0));
  for (let index = 0; index < 4; index++) {
    root.add(box(0.004, 0.003, 0.002, glow("#f2c46d", 1.4), switchX - 0.015 + index * 0.01, 0.014, 0.031));
  }
  if (plug === null) {
    throw new Error("the Pi cluster has no node to reseat");
  }
  return { root, items: {}, gadget: new PiCluster(leds, plug, plugRestZ) };
}

/** The whole setup grown or shrunk about its base, moving parts and hand targets with it. */
function scaled(setup: ReturnSetup, factor: number): ReturnSetup {
  setup.root.scale.multiplyScalar(factor);
  return setup;
}

function setupFor(member: MemberId, side: -1 | 1): ReturnSetup | null {
  switch (member) {
    case "twob":
      return calendarSetup();
    case "erza":
      return stampSetup(side);
    case "miruku":
      // A real small safe is about 0.2 m a side; 0.15 at the room's scale.
      return scaled(safeSetup(), 1.5);
    case "kobayashi":
      return phoneStandSetup();
    case "huagua":
      return easelSetup();
    case "asuna":
      return printoutSetup();
    case "yor":
      // Drawn at a real Pi's size, which is a size too big at the room's 0.73 scale.
      return scaled(piClusterSetup(side), 0.75);
    default:
      return null;
  }
}

/**
 * The things on a member's L-desk return, placed in the desk's frame. `side` is which side of the
 * desk the return is on, in the desk's frame (+1 is the sitter's right); `deskTop` is its height.
 */
export function returnSetup(member: MemberId, side: -1 | 1, deskDepth: number, deskTop: number): ReturnSetup | null {
  const setup = setupFor(member, side);
  if (setup === null) {
    return null;
  }
  const spot = new Group();
  spot.position.set(side * spotFromCenter, deskTop, deskDepth / 2 + spotPastFrontEdge);
  // The spot's +z faces the sitter, who is toward the desk's center line and a little behind.
  spot.rotation.y = -side * (Math.PI / 2 - turnTowardChair);
  spot.add(setup.root);
  return { ...setup, root: spot };
}
