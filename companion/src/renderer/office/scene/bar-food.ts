import { CylinderGeometry, Group, type Object3D, TorusGeometry } from "three";
import type { BarFood, FoodKind } from "../office-food.js";
import { box, mesh, palette, standard } from "./palette.js";

/** One kind of food on the bar: its box or board, and the pieces in it, taken from the end. */
interface FoodSet {
  container: Group;
  pieces: Object3D[];
}

const cardboard = (): ReturnType<typeof standard> => standard("#c8a57a", 0.9);

/** Lid opening angle, from lying shut to standing up a little past upright. */
const lidOpen = 1.2;

/** A box lid hinged along the back edge of a box `depth` deep, standing open behind it. */
function openLid(width: number, depth: number, hingeY: number): Object3D {
  const lid = box(width, 0.012, depth, cardboard(), 0, 0, 0);
  lid.rotation.x = lidOpen;
  // Turned about its middle, so it is moved out to where its near edge meets the hinge.
  lid.position.set(0, hingeY + (depth / 2) * Math.sin(lidOpen), -depth / 2 - (depth / 2) * Math.cos(lidOpen));
  return lid;
}

/** An open pizza box with eight slices, each with a little pepperoni. */
function pizza(): FoodSet {
  const container = new Group();
  container.add(box(0.3, 0.012, 0.3, cardboard(), 0, 0, 0));
  container.add(openLid(0.3, 0.3, 0.012));
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
  return { container, pieces };
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
  return { container, pieces };
}

/** An open box of six donuts, two rows of three, in three frostings. */
function donuts(): FoodSet {
  const container = new Group();
  container.add(box(0.28, 0.012, 0.19, cardboard(), 0, 0, 0));
  container.add(openLid(0.28, 0.19, 0.012));
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
  return { container, pieces };
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
  return { container, pieces };
}

const builders: Record<FoodKind, () => FoodSet> = { pizza, platter, donuts, sushi };

/**
 * The food on the bar: whichever box is there, with as many pieces as are left, so the box
 * empties one piece at a time and disappears when it is binned.
 */
export class BarFoodDisplay {
  readonly root = new Group();
  private readonly sets: Record<FoodKind, FoodSet>;

  constructor() {
    this.sets = {
      pizza: builders.pizza(),
      platter: builders.platter(),
      donuts: builders.donuts(),
      sushi: builders.sushi(),
    };
    for (const set of Object.values(this.sets)) {
      set.container.visible = false;
      this.root.add(set.container);
    }
  }

  update(food: BarFood): void {
    for (const [kind, set] of Object.entries(this.sets) as [FoodKind, FoodSet][]) {
      const shown = food.boxOnBar && food.kind === kind;
      set.container.visible = shown;
      if (shown) {
        // The first pieces go first, so the box empties from one side.
        set.pieces.forEach((piece, index) => {
          piece.visible = index >= set.pieces.length - food.left;
        });
      }
    }
  }
}
