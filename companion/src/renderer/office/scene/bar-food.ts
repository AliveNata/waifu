import { Group, type Object3D } from "three";
import type { BarFood, FoodKind } from "../office-food.js";
import { foodModel, kitScale, partsNamed, roomScale } from "./food-models.js";
import { box, palette, standard } from "./palette.js";

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

/** Pieces laid out in a grid of `columns`, `spacing` apart, centered on the box. */
function grid(
  count: number,
  columns: number,
  spacing: [number, number],
  make: (index: number) => Object3D,
  y = 0.012,
): Object3D[] {
  const rows = Math.ceil(count / columns);
  return Array.from({ length: count }, (_, index) => {
    const piece = make(index);
    const column = index % columns;
    const row = Math.floor(index / columns);
    piece.position.set((column - (columns - 1) / 2) * spacing[0], y, (row - (rows - 1) / 2) * spacing[1]);
    return piece;
  });
}

/**
 * A delivery box of `width` by `depth`: cardboard floor and walls, the lid hinged at the back,
 * and the pieces inside.
 */
function boxed(width: number, depth: number, height: number, pieces: Object3D[]): FoodSet {
  const container = new Group();
  container.add(box(width, 0.012, depth, cardboard(), 0, 0, 0));
  boxWalls(container, width, depth, height);
  const open = hingedLid(container, width, depth, height);
  container.add(...pieces);
  return { container, pieces, open };
}

/**
 * Drinks in a cardboard carrier, in the shop's plastic bag until it is taken off and laid flat
 * beside it.
 */
function bagged(width: number, depth: number, height: number, pieces: Object3D[]): FoodSet {
  const container = new Group();
  container.add(box(width, 0.02, depth, cardboard(), 0, 0, 0));
  container.add(...pieces);
  const bagMaterial = standard("#f7f4ee", 0.6);
  bagMaterial.transparent = true;
  bagMaterial.opacity = 0.7;
  const bag = box(width + 0.03, height + 0.02, depth + 0.02, bagMaterial, 0, 0, 0);
  container.add(bag);
  // Positions are the bag's middle: over the drinks, then folded to a tenth beside them.
  const middle = (height + 0.02) / 2;
  const aside = setAside(bag, [0, middle, 0], [width + 0.02, 0.01, 0.02]);
  return {
    container,
    pieces,
    open: (amount) => {
      aside(amount);
      bag.scale.y = 1 - 0.9 * amount;
    },
  };
}

/** The kit's pizza box, its eight slices inside, the lid swinging up on its back hinge. */
function pizza(): FoodSet {
  const container = new Group();
  const boxModel = foodModel("pizza-box");
  // The kit hinges the lid on the box's -x side; turned so the hinge runs along the back.
  boxModel.rotation.y = -Math.PI / 2;
  container.add(boxModel);
  const lid = partsNamed(boxModel, "lid")[0];
  // The kit's lid stands open; the hinge is where its far edge meets the box's back wall.
  const hinge = new Group();
  if (lid?.parent != null) {
    const parent = lid.parent;
    hinge.position.set(-0.471, 0.092, 0);
    parent.add(hinge);
    lid.position.set(-0.457, 0, 0);
    lid.quaternion.identity();
    hinge.add(lid);
  }
  const pizzaModel = foodModel("pizza", kitScale * 0.95);
  pizzaModel.position.y = 0.006;
  container.add(pizzaModel);
  const pieces = partsNamed(pizzaModel, "slice");
  // Shut flat over the box at 0, standing open at the angle the kit models it at 1.
  const shut = -Math.PI;
  const opened = (-2 * Math.PI) / 3;
  return {
    container,
    pieces,
    open: (amount) => {
      hinge.rotation.z = shut + (opened - shut) * amount;
    },
  };
}

function taco(): FoodSet {
  return boxed(
    0.3,
    0.2,
    0.1,
    grid(6, 2, [0.15, 0.06], () => foodModel("taco")),
  );
}

function sandwich(): FoodSet {
  return boxed(
    0.33,
    0.33,
    0.07,
    grid(4, 2, [0.155, 0.155], () => foodModel("sandwich")),
  );
}

function burger(): FoodSet {
  return boxed(
    0.36,
    0.25,
    0.09,
    grid(6, 3, [0.115, 0.115], () => foodModel("burger", kitScale * 0.85)),
  );
}

function waffle(): FoodSet {
  // A stack of six, taken from the top.
  const pieces = Array.from({ length: 6 }, (_, index) => {
    const piece = foodModel("waffle");
    piece.position.y = 0.012 + (5 - index) * 0.014;
    piece.rotation.y = index * 0.4;
    return piece;
  });
  return boxed(0.15, 0.15, 0.1, pieces);
}

function cookies(): FoodSet {
  return boxed(
    0.3,
    0.16,
    0.035,
    grid(8, 4, [0.07, 0.07], (index) => foodModel(index % 2 === 0 ? "cookie" : "cookie-chocolate", kitScale * 0.85)),
  );
}

/** The kit's bamboo steamer, one tier of eight dim sum, its lid set down beside it. */
function dimsum(): FoodSet {
  const container = new Group();
  const steamer = foodModel("steamer", kitScale * 0.8);
  container.add(steamer);
  // One tier is enough for eight; the upper tiers go, and the lid sits on the one left.
  const layers = partsNamed(steamer, "layer");
  for (const layer of layers.slice(1)) {
    layer.removeFromParent();
  }
  const lid = partsNamed(steamer, "lid")[0];
  const pieces = Array.from({ length: 8 }, (_, index) => {
    const piece = foodModel("dim-sum", kitScale * 0.75);
    if (index === 7) {
      piece.position.set(0, 0.012, 0);
    } else {
      const angle = (index / 7) * Math.PI * 2;
      piece.position.set(Math.sin(angle) * 0.07, 0.012, Math.cos(angle) * 0.07);
    }
    return piece;
  });
  container.add(...pieces);
  // The lid's own height in the tier's units: on the tier at 0.18, set down at the side.
  const aside = lid === undefined ? uncovered : setAside(lid, [0, 0.18, 0], [0.62, 0, 0.1]);
  return { container, pieces, open: aside };
}

/** A round board of cheese wedges and sausage, under a clear clamshell lid. */
function platter(): FoodSet {
  const container = new Group();
  container.add(foodModel("board", kitScale * 0.8));
  const pieces = Array.from({ length: 6 }, (_, index) => {
    const angle = (index / 6) * Math.PI * 2;
    const piece = index % 2 === 0 ? foodModel("cheese", kitScale * 0.45) : foodModel("sausage", kitScale * 0.6);
    piece.position.set(Math.sin(angle) * 0.07, 0.02, Math.cos(angle) * 0.07);
    piece.rotation.y = angle;
    return piece;
  });
  container.add(...pieces);
  const clear = standard(palette.glass, 0.1);
  clear.transparent = true;
  clear.opacity = 0.35;
  clear.depthWrite = false;
  boxWalls(container, 0.25, 0.25, 0.07, clear);
  const open = hingedLid(container, 0.25, 0.25, 0.07, clear);
  return { container, pieces, open };
}

function soda(): FoodSet {
  return bagged(
    0.26,
    0.17,
    0.13,
    grid(6, 3, [0.085, 0.085], () => foodModel("soda")),
  );
}

function frappe(): FoodSet {
  return bagged(
    0.2,
    0.2,
    0.18,
    grid(4, 2, [0.095, 0.095], () => foodModel("frappe")),
  );
}

function coffee(): FoodSet {
  return bagged(
    0.2,
    0.2,
    0.06,
    grid(4, 2, [0.09, 0.09], () => foodModel("coffee")),
  );
}

function carton(): FoodSet {
  return bagged(
    0.26,
    0.17,
    0.14,
    grid(6, 3, [0.085, 0.085], () => foodModel("carton")),
  );
}

const builders: Record<FoodKind, () => FoodSet> = {
  pizza,
  taco,
  sandwich,
  burger,
  dimsum,
  waffle,
  cookies,
  platter,
  soda,
  frappe,
  coffee,
  carton,
};

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
    this.root.scale.setScalar(roomScale);
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

/**
 * What the courier brings: the same box, steamer, board or bagged drinks the bar shows, shut, so
 * a pizza arrives in its pizza box and drinks in their bag.
 */
export function shutPackage(kind: FoodKind): Group {
  const set = builders[kind]();
  set.open(0);
  set.container.scale.setScalar(roomScale);
  return set.container;
}
