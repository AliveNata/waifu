import { CylinderGeometry, Group, type Object3D, SphereGeometry, TorusGeometry } from "three";
import type { BarFood, FoodKind } from "../office-food.js";
import { box, mesh, palette, standard } from "./palette.js";

/**
 * One kind of food on the bar: its box or board, and the pieces in it, taken from the end. `open`
 * moves its lid or cover from shut (0) to open (1); a board with no cover ignores it.
 */
interface FoodSet {
  container: Group;
  pieces: Object3D[];
  open(amount: number): void;
}

/** Nothing to open: the board is set out uncovered. */
const uncovered = (): void => {};

const cardboard = (): ReturnType<typeof standard> => standard("#c8a57a", 0.9);

/** Lid opening angle, from lying shut to standing a little past upright, leaning back. */
const lidOpen = 1.9;

/**
 * A box lid hinged along the back edge of a box `depth` deep: lying shut over the box at 0,
 * standing open behind it at 1.
 */
function hingedLid(
  container: Group,
  width: number,
  depth: number,
  hingeY: number,
  material = cardboard(),
): (amount: number) => void {
  const hinge = new Group();
  hinge.position.set(0, hingeY, -depth / 2);
  // The walls the lid rests on when shut, so the shut box reads as a box, not a tray.
  hinge.add(box(width, 0.012, depth, material, 0, 0, depth / 2));
  container.add(hinge);
  return (amount) => {
    hinge.rotation.x = -lidOpen * amount;
  };
}

/**
 * A cover that comes off and is set down beside the food: from `on` over the food at 0 to `off`
 * at 1, lifted clear on the way so it never cuts through what it covered.
 */
function setAside(
  cover: Object3D,
  on: [number, number, number],
  off: [number, number, number],
): (amount: number) => void {
  return (amount) => {
    const lift = Math.sin(Math.min(1, amount) * Math.PI) * 0.08;
    cover.position.set(
      on[0] + (off[0] - on[0]) * amount,
      on[1] + (off[1] - on[1]) * amount + lift,
      on[2] + (off[2] - on[2]) * amount,
    );
  };
}

/** Shut boxes stand a little taller: pieces sit under the lid until it opens. */
function boxWalls(container: Group, width: number, depth: number, height: number, material = cardboard()): void {
  container.add(
    box(width, height, 0.008, material, 0, 0, depth / 2),
    box(width, height, 0.008, material, 0, 0, -depth / 2),
    box(0.008, height, depth, material, width / 2, 0, 0),
    box(0.008, height, depth, material, -width / 2, 0, 0),
  );
}

/** An open pizza box with eight slices, each with a little pepperoni. */
function pizza(): FoodSet {
  const container = new Group();
  container.add(box(0.3, 0.012, 0.3, cardboard(), 0, 0, 0));
  boxWalls(container, 0.3, 0.3, 0.04);
  const open = hingedLid(container, 0.3, 0.3, 0.04);
  const cheese = standard("#f2c35a", 0.7);
  const pepperoni = standard("#b8392b", 0.6);
  const pieces = Array.from({ length: 8 }, (_, index) => {
    const slice = new Group();
    const wedge = mesh(
      new CylinderGeometry(0.13, 0.13, 0.012, 6, 1, false, (index * Math.PI) / 4, Math.PI / 4),
      cheese,
    );
    wedge.position.y = 0.018;
    const angle = ((index + 0.5) * Math.PI) / 4;
    const dot = mesh(new CylinderGeometry(0.016, 0.016, 0.004, 10), pepperoni, false);
    dot.position.set(Math.sin(angle) * 0.075, 0.026, Math.cos(angle) * 0.075);
    slice.add(wedge, dot);
    return slice;
  });
  container.add(...pieces);
  return { container, pieces, open };
}

/** A round board with cheese cubes and slices of sausage, round the edge. */
function platter(): FoodSet {
  const container = new Group();
  const board = mesh(new CylinderGeometry(0.15, 0.15, 0.018, 24), standard(palette.oak, 0.6));
  board.position.y = 0.009;
  container.add(board);
  const cheese = standard("#f3d26b", 0.7);
  const sausage = standard("#a8413a", 0.6);
  const pieces = Array.from({ length: 6 }, (_, index) => {
    const angle = (index / 6) * Math.PI * 2;
    const x = Math.sin(angle) * 0.09;
    const z = Math.cos(angle) * 0.09;
    if (index % 2 === 0) {
      return box(0.035, 0.035, 0.035, cheese, x, 0.018, z);
    }
    const slice = mesh(new CylinderGeometry(0.022, 0.022, 0.02, 12), sausage);
    slice.position.set(x, 0.028, z);
    return slice;
  });
  container.add(...pieces);
  return { container, pieces, open: uncovered };
}

/** An open box of six donuts, two rows of three, in three frostings. */
function donuts(): FoodSet {
  const container = new Group();
  container.add(box(0.28, 0.012, 0.19, cardboard(), 0, 0, 0));
  boxWalls(container, 0.28, 0.19, 0.05);
  const open = hingedLid(container, 0.28, 0.19, 0.05);
  const dough = standard("#d9a05b", 0.8);
  const frostings = ["#f4a6c4", "#5a3a24", "#f7f1ea"].map((color) => standard(color, 0.5));
  const pieces = Array.from({ length: 6 }, (_, index) => {
    const donut = new Group();
    const ring = mesh(new TorusGeometry(0.03, 0.014, 8, 16), dough);
    ring.rotation.x = Math.PI / 2;
    const top = mesh(new TorusGeometry(0.03, 0.011, 8, 16), frostings[index % 3] ?? dough, false);
    top.rotation.x = Math.PI / 2;
    top.position.y = 0.006;
    donut.add(ring, top);
    donut.position.set(((index % 3) - 1) * 0.085, 0.026, (Math.floor(index / 3) - 0.5) * 0.085);
    return donut;
  });
  container.add(...pieces);
  return { container, pieces, open };
}

/** A black tray of eight nigiri, salmon and tuna. */
function sushi(): FoodSet {
  const container = new Group();
  container.add(box(0.3, 0.014, 0.14, standard("#1d1a1f", 0.4), 0, 0, 0));
  const rice = standard("#f7f4ec", 0.9);
  const fish = [standard("#f08a5d", 0.5), standard("#c8323c", 0.5)];
  const pieces = Array.from({ length: 8 }, (_, index) => {
    const nigiri = new Group();
    nigiri.add(box(0.026, 0.018, 0.045, rice, 0, 0, 0), box(0.03, 0.007, 0.05, fish[index % 2] ?? rice, 0, 0.018, 0));
    nigiri.position.set(((index % 4) - 1.5) * 0.065, 0.014, (Math.floor(index / 4) - 0.5) * 0.06);
    return nigiri;
  });
  container.add(...pieces);
  // A clear clamshell lid over the tray, as sushi comes from the shop.
  const clear = standard(palette.glass, 0.1);
  clear.transparent = true;
  clear.opacity = 0.35;
  clear.depthWrite = false;
  boxWalls(container, 0.3, 0.14, 0.05, clear);
  const open = hingedLid(container, 0.3, 0.14, 0.05, clear);
  return { container, pieces, open };
}

/** Sweet martabak cut in eight squares in its white box: crust, chocolate and cheese on top. */
function martabak(): FoodSet {
  const container = new Group();
  const white = standard("#ece6da", 0.9);
  container.add(box(0.3, 0.012, 0.3, white, 0, 0, 0));
  boxWalls(container, 0.3, 0.3, 0.05, white);
  const open = hingedLid(container, 0.3, 0.3, 0.05, white);
  const crust = standard("#d99a4e", 0.8);
  const chocolate = standard("#4a2c1c", 0.6);
  const cheese = standard("#f3d26b", 0.7);
  const pieces = Array.from({ length: 8 }, (_, index) => {
    const square = new Group();
    square.add(
      box(0.06, 0.026, 0.12, crust, 0, 0.006, 0),
      // Spread over the top, the way a cut martabak shows its chocolate and grated cheese.
      box(0.05, 0.004, 0.105, chocolate, 0, 0.032, 0),
      box(0.034, 0.004, 0.07, cheese, 0, 0.036, 0),
    );
    square.position.set(((index % 4) - 1.5) * 0.066, 0, (Math.floor(index / 4) - 0.5) * 0.128);
    return square;
  });
  container.add(...pieces);
  return { container, pieces, open };
}

/** A striped bucket of fried chicken, drumsticks poking out; its lid comes off beside it. */
function chicken(): FoodSet {
  const container = new Group();
  const bucket = mesh(new CylinderGeometry(0.1, 0.08, 0.16, 24), standard("#c8323c", 0.6));
  bucket.position.y = 0.08;
  const band = mesh(new CylinderGeometry(0.093, 0.088, 0.05, 24), standard("#f7f1ea", 0.6), false);
  band.position.y = 0.09;
  container.add(bucket, band);
  const meat = standard("#b8742e", 0.85);
  const bone = standard("#f1e7d6", 0.6);
  const pieces = Array.from({ length: 6 }, (_, index) => {
    const piece = new Group();
    const angle = (index / 6) * Math.PI * 2;
    const lump = mesh(new SphereGeometry(0.03, 10, 8), meat);
    lump.scale.set(1, 1.2, 1);
    const stick = mesh(new CylinderGeometry(0.006, 0.007, 0.05, 6), bone, false);
    stick.position.y = 0.045;
    piece.add(lump, stick);
    piece.position.set(Math.sin(angle) * 0.05, 0.16, Math.cos(angle) * 0.05);
    piece.rotation.set(Math.cos(angle) * 0.35, 0, -Math.sin(angle) * 0.35);
    return piece;
  });
  container.add(...pieces);
  // A domed lid tall enough to cover the drumsticks standing up out of the bucket.
  const lid = mesh(new CylinderGeometry(0.07, 0.102, 0.09, 24), standard("#f7f1ea", 0.6));
  container.add(lid);
  return { container, pieces, open: setAside(lid, [0, 0.205, 0], [0.2, 0.045, 0.02]) };
}

/** A bamboo steamer of eight siomay; the steamer lid is set down beside it. */
function dimsum(): FoodSet {
  const container = new Group();
  const bamboo = standard("#c9a46a", 0.85);
  const basket = mesh(new CylinderGeometry(0.12, 0.12, 0.05, 28, 1, true), bamboo);
  basket.position.y = 0.025;
  const floor = mesh(new CylinderGeometry(0.118, 0.118, 0.006, 28), standard("#e9dcc0", 0.9));
  floor.position.y = 0.006;
  container.add(basket, floor);
  const wrap = standard("#f1dfb0", 0.8);
  const filling = standard("#e07a52", 0.6);
  const pieces = Array.from({ length: 8 }, (_, index) => {
    const piece = new Group();
    const angle = (index / 8) * Math.PI * 2;
    const body = mesh(new CylinderGeometry(0.022, 0.019, 0.03, 12), wrap);
    body.position.y = 0.024;
    const top = mesh(new CylinderGeometry(0.017, 0.017, 0.004, 12), filling, false);
    top.position.y = 0.04;
    piece.add(body, top);
    piece.position.set(Math.sin(angle) * 0.07, 0, Math.cos(angle) * 0.07);
    return piece;
  });
  container.add(...pieces);
  const lid = new Group();
  const lidRim = mesh(new CylinderGeometry(0.124, 0.124, 0.03, 28, 1, true), bamboo);
  const lidTop = mesh(new CylinderGeometry(0.122, 0.122, 0.006, 28), bamboo);
  lidTop.position.y = 0.014;
  lid.add(lidRim, lidTop);
  container.add(lid);
  return { container, pieces, open: setAside(lid, [0, 0.065, 0], [0.24, 0.015, 0.02]) };
}

/** Six cups of boba in a cardboard carrier, in the shop's bag until it is taken off. */
function boba(): FoodSet {
  const container = new Group();
  container.add(box(0.26, 0.02, 0.17, cardboard(), 0, 0, 0));
  const tea = [standard("#c9a27e", 0.5), standard("#8a5a3c", 0.5), standard("#d8b4d8", 0.5)];
  const pearls = standard("#2b1d16", 0.4);
  const lid = standard("#f4f1ec", 0.3);
  const straw = standard("#d9468c", 0.5);
  const pieces = Array.from({ length: 6 }, (_, index) => {
    const cup = new Group();
    const body = mesh(new CylinderGeometry(0.03, 0.025, 0.11, 14), tea[index % 3] ?? lid);
    body.position.y = 0.065;
    const bottom = mesh(new CylinderGeometry(0.026, 0.025, 0.02, 14), pearls, false);
    bottom.position.y = 0.022;
    const top = mesh(new CylinderGeometry(0.031, 0.031, 0.006, 14), lid, false);
    top.position.y = 0.122;
    const stick = mesh(new CylinderGeometry(0.004, 0.004, 0.07, 8), straw, false);
    stick.position.set(0.008, 0.15, 0);
    cup.add(body, bottom, top, stick);
    cup.position.set(((index % 3) - 1) * 0.08, 0, (Math.floor(index / 3) - 0.5) * 0.08);
    return cup;
  });
  container.add(...pieces);
  // The shop's plastic bag over the lot; once off it lies folded flat beside the carrier.
  const bagMaterial = standard("#f7f4ee", 0.6);
  bagMaterial.transparent = true;
  bagMaterial.opacity = 0.7;
  const bag = box(0.29, 0.2, 0.19, bagMaterial, 0, 0, 0);
  container.add(bag);
  // Positions are the bag's middle: full height over the cups, folded to a tenth beside them.
  const aside = setAside(bag, [0, 0.1, 0], [0.27, 0.01, 0.02]);
  return {
    container,
    pieces,
    open: (amount) => {
      aside(amount);
      bag.scale.y = 1 - 0.9 * amount;
    },
  };
}

const builders: Record<FoodKind, () => FoodSet> = { pizza, platter, donuts, sushi, martabak, chicken, dimsum, boba };

/** Seconds to open a lid or take a cover off. */
const openSeconds = 0.8;

/**
 * The food on the bar: whichever box is there, with as many pieces as are left, so the box
 * empties one piece at a time and disappears when it is binned.
 */
export class BarFoodDisplay {
  readonly root = new Group();
  private readonly sets: Record<FoodKind, FoodSet>;
  /** How far open the box on the bar is, eased toward shut or open. */
  private opened = 0;
  private showing: FoodKind | null = null;

  constructor() {
    this.sets = Object.fromEntries(
      (Object.entries(builders) as [FoodKind, () => FoodSet][]).map(([kind, build]) => [kind, build()]),
    ) as Record<FoodKind, FoodSet>;
    for (const set of Object.values(this.sets)) {
      set.container.visible = false;
      set.open(0);
      this.root.add(set.container);
    }
  }

  update(food: BarFood, delta: number): void {
    const now = food.boxOnBar ? food.kind : null;
    if (now !== this.showing) {
      // A new box arrives shut and opens from there, whoever brought it.
      this.showing = now;
      this.opened = 0;
    }
    const goal = food.open ? 1 : 0;
    this.opened = goal > this.opened ? Math.min(goal, this.opened + delta / openSeconds) : goal;
    const eased = this.opened * this.opened * (3 - 2 * this.opened);
    for (const [kind, set] of Object.entries(this.sets) as [FoodKind, FoodSet][]) {
      const shown = food.boxOnBar && food.kind === kind;
      set.container.visible = shown;
      if (shown) {
        set.open(eased);
        // The first pieces go first, so the box empties from one side.
        set.pieces.forEach((piece, index) => {
          piece.visible = index >= set.pieces.length - food.left;
        });
      }
    }
  }
}
