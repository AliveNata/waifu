import {
  CanvasTexture,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  type Texture,
} from "three";
import { furnitureModel } from "./furniture-models.js";
import { box, mesh, palette, standard, unlit } from "./palette.js";

/**
 * The team's hackathon awards in the display cabinet. Hackathons hand out acrylic and glass rather
 * than sports cups, so each one carries the AlyxLabs logo and its category, printed on the front in
 * the brand's purple and ink: frosted white lines would vanish against the pale wall behind.
 */
export interface AwardText {
  /** The big line: the place or the category. */
  title: string;
  /** Smaller lines under it, such as the event and the year. */
  lines: readonly string[];
}

const font = "'Segoe UI', system-ui, sans-serif";
const titleColor = "#8a3fd6";
const lineColor = "#2b2440";

/** The words of an award as a transparent texture, centered, two to one. */
export function engravingTexture(text: AwardText): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    console.error("[office] no 2D canvas for an award's engraving");
  } else {
    ctx.clearRect(0, 0, 512, 256);
    ctx.fillStyle = titleColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 64px ${font}`;
    ctx.fillText(text.title, 256, 70, 480);
    ctx.font = `600 38px ${font}`;
    ctx.fillStyle = lineColor;
    text.lines.forEach((line, index) => {
      ctx.fillText(line, 256, 150 + index * 50, 480);
    });
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * The logo above the words, on a face `width` wide at its middle, laid just in front of it (+z).
 * `top` is how high the face goes, measured from the group's origin.
 */
export function engraving(logo: Texture, text: AwardText, width: number, top: number): Group {
  const group = new Group();
  const logoSize = width * 0.42;
  const mark = mesh(new PlaneGeometry(logoSize, logoSize), unlit(logo, true), false);
  mark.position.y = top - width * 0.12 - logoSize / 2;
  const wordsWidth = width * 0.86;
  const words = mesh(new PlaneGeometry(wordsWidth, wordsWidth / 2), unlit(engravingTexture(text), true), false);
  words.position.y = mark.position.y - logoSize / 2 - wordsWidth / 4;
  group.add(mark, words);
  return group;
}

/** Clear acrylic: barely there except where light catches it. */
function acrylicMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: "#cfe8ff",
    roughness: 0.05,
    metalness: 0,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
}

/** Every material of `model` that `pick` chooses becomes `replacement`. */
function swapMaterials(model: Object3D, pick: (material: Material) => boolean, replacement: Material): void {
  model.traverse((part) => {
    if (part instanceof Mesh && !Array.isArray(part.material) && pick(part.material)) {
      part.material = replacement;
    }
  });
}

const slabWidth = 0.1;
const slabThickness = 0.014;
const baseHeight = 0.028;

/**
 * A clear acrylic slab standing in a black base, `height` tall overall, the logo and the words
 * engraved on its front.
 */
export function acrylicAward(logo: Texture, text: AwardText, height: number): Group {
  const award = new Group();
  const slabHeight = height - baseHeight;
  const acrylic = acrylicMaterial();
  // Clear acrylic shows mostly at its cut edges, which catch the light a little blue.
  const edge = new MeshStandardMaterial({ color: "#a9d4f5", roughness: 0.1, transparent: true, opacity: 0.7 });
  const bottom = baseHeight - 0.004;
  const rim = 0.003;
  award.add(
    box(slabWidth * 1.25, baseHeight, slabThickness * 3.2, standard(palette.inkDeep, 0.35), 0, 0, 0),
    box(slabWidth, slabHeight, slabThickness, acrylic, 0, bottom, 0),
    box(slabWidth, rim, slabThickness, edge, 0, bottom + slabHeight - rim, 0),
    box(rim, slabHeight, slabThickness, edge, -(slabWidth - rim) / 2, bottom, 0),
    box(rim, slabHeight, slabThickness, edge, (slabWidth - rim) / 2, bottom, 0),
  );
  const front = engraving(logo, text, slabWidth, height - 0.004);
  front.position.z = slabThickness / 2 + 0.0008;
  award.add(front);
  return award;
}

/**
 * A round crystal award on its own block, both clear ("Award 4" by MDgraphicLAB, CC-BY-4.0). The
 * disc is 12 cm across, its middle 10.5 cm up and its face 6 mm in front. Without the model it is
 * an acrylic slab of the same height.
 */
export function discAward(logo: Texture, text: AwardText): Group {
  const model = furnitureModel("awardDisc");
  if (model === null) {
    return acrylicAward(logo, text, 0.165);
  }
  const award = new Group();
  swapMaterials(model, () => true, acrylicMaterial());
  award.add(model);
  const width = 0.075;
  const front = engraving(logo, text, width, 0.105 + width * 0.49);
  front.position.z = 0.0068;
  award.add(front);
  return award;
}

/**
 * A glass blade standing in a gold-trimmed base ("Glass Trophy" by ikhwanulnull, CC-BY-4.0), 17.6
 * cm tall, its glass 6 cm wide and its face 9 mm in front. The printing goes below the dark name
 * plate at its top. Without the model it is an acrylic slab of the same height.
 */
export function glassAward(logo: Texture, text: AwardText): Group {
  const model = furnitureModel("awardGlass");
  if (model === null) {
    return acrylicAward(logo, text, 0.176);
  }
  const award = new Group();
  swapMaterials(model, (material) => material.name === "Material.003", acrylicMaterial());
  award.add(model);
  const front = engraving(logo, text, 0.05, 0.128);
  front.position.z = 0.0098;
  award.add(front);
  return award;
}

/**
 * A wooden plaque on its stand ("Plaque" by omccartan, CC-BY-4.0). Its brass panel already reads
 * "BEST DEMO, AlyxLabs Demo Day 2025" with the logo: the words were painted into its texture in
 * place of the original engraving. Without the model it is an acrylic slab.
 */
export function plaqueAward(logo: Texture): Group {
  const model = furnitureModel("awardPlaque");
  if (model === null) {
    return acrylicAward(logo, { title: "BEST DEMO", lines: ["AlyxLabs Demo Day 2025"] }, 0.16);
  }
  const award = new Group();
  award.add(model);
  return award;
}
