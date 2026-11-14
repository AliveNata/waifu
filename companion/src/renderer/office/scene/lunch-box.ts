import { Box3, Group, type Object3D, Vector3 } from "three";
import type { MemberId } from "../../../shared/team.js";
import { type BentoName, bentoModel, bentoOf } from "./bento-models.js";
import { box, palette, standard } from "./palette.js";

/** Between the box's near edge and the table's edge, so it is in reach and not on the brink. */
const edgeMargin = 0.03;

/**
 * How far toward the chair a lunch `depth` deep sits from the seat's laptop spot, when the table's
 * edge is `reach` from that spot: as near the sitter as the margin allows, never behind the spot.
 */
export function lunchOffset(reach: number, depth: number): number {
  return Math.max(0, reach - edgeMargin - depth / 2);
}

/**
 * The lunch at one meeting chair: whoever sits down to eat gets their own usual box, and the
 * plain code-built bento stands in when that model did not load. Its frame is the seat's laptop
 * spot, +z toward the chair.
 */
export class LunchBox {
  readonly root = new Group();
  private readonly fallback: Group;
  private readonly made = new Map<BentoName, Object3D | null>();
  private shown: Object3D | null = null;
  private topAt: Vector3 | null = null;

  constructor(
    private readonly tableTop: number,
    /** From the laptop spot to the table's edge on the chair's side. */
    private readonly reach: number,
  ) {
    this.fallback = codeBento();
    this.place(this.fallback);
    this.root.visible = false;
  }

  /** Sets out `memberId`'s lunch, or clears the place with null. */
  serve(memberId: MemberId | null): void {
    const next = memberId === null ? null : this.lunchFor(bentoOf[memberId]);
    this.root.visible = next !== null;
    if (next === this.shown) {
      return;
    }
    for (const child of this.root.children) {
      child.visible = child === next;
    }
    this.shown = next;
    this.topAt = null;
  }

  /** The middle of the shown lunch's top, in world space, where the chopsticks go. */
  top(): Vector3 {
    if (this.topAt === null) {
      const bounds = new Box3().setFromObject(this.shown ?? this.fallback);
      this.topAt = bounds.getCenter(new Vector3()).setY(bounds.max.y);
    }
    return this.topAt.clone();
  }

  private lunchFor(name: BentoName): Object3D {
    let lunch = this.made.get(name);
    if (lunch === undefined) {
      lunch = bentoModel(name);
      if (lunch !== null) {
        this.place(lunch);
      }
      this.made.set(name, lunch);
    }
    return lunch ?? this.fallback;
  }

  /** On the table, toward the chair as far as its depth allows. */
  private place(lunch: Object3D): void {
    // Measured on its own, before it joins the table, so the depth is along the seat's z.
    lunch.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(lunch);
    const depth = bounds.max.z - bounds.min.z;
    lunch.position.set(0, this.tableTop, lunchOffset(this.reach, depth) - (bounds.min.z + bounds.max.z) / 2);
    lunch.visible = false;
    this.root.add(lunch);
  }
}

/** An open bento: rice on one side, salmon, egg and greens on the other. */
function codeBento(): Group {
  const lunch = new Group();
  lunch.add(
    box(0.13, 0.03, 0.09, standard(palette.inkDeep, 0.5), 0, 0, 0),
    box(0.058, 0.006, 0.078, standard("#f7f3ea", 0.9), -0.03, 0.026, 0),
    box(0.03, 0.012, 0.03, standard("#f2a65a", 0.7), 0.03, 0.026, -0.018),
    box(0.024, 0.01, 0.022, standard("#f2c94c", 0.7), 0.026, 0.026, 0.022),
    box(0.016, 0.012, 0.02, standard(palette.leaf, 0.8), 0.05, 0.026, 0.02),
  );
  return lunch;
}
