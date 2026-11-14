import { Box3, Group, type Object3D, Vector3 } from "three";
import type { MemberId } from "../../../shared/team.js";
import type { HandPropKind } from "../office-director.js";
import { bentoModel, bentoOf } from "./bento-models.js";
import { memberPropLooks } from "./desks.js";
import { handPropModel } from "./hand-props.js";
import { box, palette, standard } from "./palette.js";

/** Between the box's near edge and the table's edge, so it is in reach and not on the brink. */
const edgeMargin = 0.03;
/** Between the box and the drink beside it. */
const drinkGap = 0.03;

/**
 * How far toward the chair a lunch `depth` deep sits from the seat's laptop spot, when the table's
 * edge is `reach` from that spot: as near the sitter as the margin allows, never behind the spot.
 */
export function lunchOffset(reach: number, depth: number): number {
  return Math.max(0, reach - edgeMargin - depth / 2);
}

export type LunchDrink = Extract<HandPropKind, "mug" | "teacup" | "coffee-cup" | "soda-can" | "frappe-cup" | "carton">;

/** What each member drinks with lunch. The mug is their own, in its color. */
export const drinkOf: Readonly<Record<MemberId, LunchDrink>> = {
  twob: "coffee-cup",
  chizuru: "teacup",
  rias: "mug",
  asuna: "frappe-cup",
  kobayashi: "soda-can",
  yor: "mug",
  erza: "carton",
  ruby: "frappe-cup",
  arisu: "coffee-cup",
  komachi: "mug",
  miruku: "carton",
  huagua: "teacup",
};

/** One member's lunch as laid out: the box, and the drink at their right hand. */
interface Setting {
  root: Group;
  /** Where the chopsticks go: the box alone, not the taller drink. */
  box: Object3D;
}

/**
 * The lunch at one meeting chair: whoever sits down to eat gets their own usual box and drink, and
 * the plain code-built bento stands in when their model did not load. Its frame is the seat's
 * laptop spot, +z toward the chair, so the sitter faces -z and their right hand is toward +x.
 */
export class LunchBox {
  readonly root = new Group();
  private readonly settings = new Map<MemberId, Setting>();
  private shown: Setting | null = null;
  private topAt: Vector3 | null = null;

  constructor(
    private readonly tableTop: number,
    /** From the laptop spot to the table's edge on the chair's side. */
    private readonly reach: number,
  ) {
    this.root.visible = false;
  }

  /** Sets out `memberId`'s lunch, or clears the place with null. */
  serve(memberId: MemberId | null): void {
    const next = memberId === null ? null : this.settingFor(memberId);
    this.root.visible = next !== null;
    if (next === this.shown) {
      return;
    }
    if (this.shown !== null) {
      this.shown.root.visible = false;
    }
    if (next !== null) {
      next.root.visible = true;
    }
    this.shown = next;
    this.topAt = null;
  }

  /** The middle of the shown box's top, in world space, where the chopsticks go. */
  top(): Vector3 {
    if (this.topAt === null) {
      const bounds = new Box3().setFromObject(this.shown?.box ?? this.root);
      this.topAt = bounds.getCenter(new Vector3()).setY(bounds.max.y);
    }
    return this.topAt.clone();
  }

  private settingFor(memberId: MemberId): Setting {
    let setting = this.settings.get(memberId);
    if (setting === undefined) {
      setting = this.lay(bentoModel(bentoOf[memberId]) ?? codeBento(), drinkOf[memberId], memberId);
      this.settings.set(memberId, setting);
    }
    return setting;
  }

  /** The box toward the chair as far as its depth allows, the drink beside it on the right. */
  private lay(lunch: Object3D, drinkKind: LunchDrink, memberId: MemberId): Setting {
    const root = new Group();
    // Measured on their own, before they join the table, so sizes are along the seat's axes.
    const boxBounds = measured(lunch);
    const middle = lunchOffset(this.reach, boxBounds.max.z - boxBounds.min.z);
    lunch.position.set(
      -(boxBounds.min.x + boxBounds.max.x) / 2,
      this.tableTop,
      middle - (boxBounds.min.z + boxBounds.max.z) / 2,
    );
    const drink = handPropModel(drinkKind, memberPropLooks[memberId]);
    const drinkBounds = measured(drink);
    root.add(lunch);
    // A drink whose model did not load is an empty group: lunch goes on without it.
    if (!drinkBounds.isEmpty()) {
      const halfWidth = (boxBounds.max.x - boxBounds.min.x) / 2;
      drink.position.set(
        halfWidth + drinkGap - drinkBounds.min.x,
        this.tableTop - drinkBounds.min.y,
        middle - (drinkBounds.min.z + drinkBounds.max.z) / 2,
      );
      root.add(drink);
    }
    root.visible = false;
    this.root.add(root);
    return { root, box: lunch };
  }
}

function measured(object: Object3D): Box3 {
  object.updateMatrixWorld(true);
  return new Box3().setFromObject(object);
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
