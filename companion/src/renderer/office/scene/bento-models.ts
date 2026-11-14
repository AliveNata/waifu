import { Box3, Group, type Object3D, Vector3 } from "three";
import type { MemberId } from "../../../shared/team.js";
import gyudonUrl from "../assets/food/bento/gyudon.glb?url";
import halabaloUrl from "../assets/food/bento/halabalo.glb?url";
import jerkChickenUrl from "../assets/food/bento/jerk-chicken.glb?url";
import katsuUrl from "../assets/food/bento/katsu.glb?url";
import lunchComboUrl from "../assets/food/bento/lunch-combo.glb?url";
import nasiLemakUrl from "../assets/food/bento/nasi-lemak.glb?url";
import sushiUrl from "../assets/food/bento/sushi.glb?url";
import teishokuUrl from "../assets/food/bento/teishoku.glb?url";
import unagyuUrl from "../assets/food/bento/unagyu.glb?url";
import unajuUrl from "../assets/food/bento/unaju.glb?url";
import unajuKobaxUrl from "../assets/food/bento/unaju-kobax.glb?url";
import yakinikuUrl from "../assets/food/bento/yakiniku.glb?url";
import { loadTemplates, roomScale } from "./food-models.js";
import { box, standard } from "./palette.js";

/**
 * Lunches from Sketchfab, CC-BY-4.0, credited in docs/03-companion.md. Most are photo scans; each
 * was cut off its table, straightened, simplified and saved at its real size in meters, the long
 * side along x and the base at y 0.
 */
const urls = {
  halabalo: halabaloUrl,
  sushi: sushiUrl,
  unagyu: unagyuUrl,
  teishoku: teishokuUrl,
  unaju: unajuUrl,
  gyudon: gyudonUrl,
  "nasi-lemak": nasiLemakUrl,
  katsu: katsuUrl,
  yakiniku: yakinikuUrl,
  "jerk-chicken": jerkChickenUrl,
  "lunch-combo": lunchComboUrl,
  "unaju-kobax": unajuKobaxUrl,
} as const;

export type BentoName = keyof typeof urls;

/** What each member usually has for lunch, so the table is never twelve of the same box. */
export const bentoOf: Readonly<Record<MemberId, BentoName>> = {
  twob: "teishoku",
  chizuru: "sushi",
  rias: "yakiniku",
  asuna: "halabalo",
  kobayashi: "gyudon",
  yor: "katsu",
  erza: "unaju",
  ruby: "lunch-combo",
  arisu: "jerk-chicken",
  komachi: "unagyu",
  miruku: "unaju-kobax",
  huagua: "nasi-lemak",
};

/**
 * Scans that caught the food but not all of the box around it: the box is built here instead,
 * a lacquered one, black outside and red inside, as unaju is served in.
 */
const rebuiltBox: ReadonlySet<BentoName> = new Set(["unaju-kobax"]);

const templates = new Map<BentoName, Object3D>();

export function loadBentoModels(): Promise<void> {
  return loadTemplates(urls, templates, "bento");
}

/** A fresh copy at the office's size, or null when it did not load, so the caller keeps its stand-in. */
export function bentoModel(name: BentoName): Object3D | null {
  const template = templates.get(name);
  if (template === undefined) {
    return null;
  }
  const lunch = new Group();
  const copy = template.clone(true);
  copy.scale.setScalar(roomScale);
  lunch.add(copy);
  if (rebuiltBox.has(name)) {
    lunch.add(lacquerBox(new Box3().setFromObject(copy)));
  }
  return lunch;
}

const wall = 0.004;

/** Four walls around the food's footprint, a little lower than its top so the eel shows. */
function lacquerBox(bounds: Box3): Group {
  const walls = new Group();
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const height = size.y * 0.8;
  const outside = standard("#1b1311", 0.35);
  const inside = standard("#7a1a16", 0.4);
  const width = size.x + 2 * wall;
  const depth = size.z + 2 * wall;
  for (const side of [-1, 1]) {
    walls.add(
      box(width, height, wall, outside, center.x, 0, center.z + (side * (depth - wall)) / 2),
      box(wall, height, depth, outside, center.x + (side * (width - wall)) / 2, 0, center.z),
      box(size.x, height - 0.002, wall / 2, inside, center.x, 0, center.z + side * (size.z / 2 - wall / 4)),
      box(wall / 2, height - 0.002, size.z, inside, center.x + side * (size.x / 2 - wall / 4), 0, center.z),
    );
  }
  return walls;
}
