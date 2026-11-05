import { Box3, BufferAttribute, BufferGeometry, Group, Mesh, type MeshStandardMaterial, type Object3D } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { furnitureModel } from "./furniture-models.js";

/**
 * The two laptop models from Sketchfab (CC-BY-4.0, credited in docs/03-companion.md): "Laptop"
 * by senthil123, one mesh with the lid and base together, and "Gaming Laptop" by Blue Lantern,
 * its lid and base already apart. `yaw` turns each to face +z; `lidOf` says which triangles
 * belong to the lid.
 */
const models = {
  // The lid is everything above the base's 1.6 cm deck.
  laptop: { yaw: Math.PI, lidOf: { aboveY: 0.02 } },
  gamingLaptop: { yaw: -Math.PI / 2, lidOf: { node: "Cube001_1" } },
} as const;

export type LaptopModel = keyof typeof models;

/**
 * A laptop model taken apart for the office's own hinge. `base` has its origin at the middle of
 * the back edge on the desk, the deck `baseHeight` high and running toward +z. `lid` has its
 * origin on the hinge, standing upright with the screen side toward +z, so the stage turns it on
 * x exactly as it turned the box lid.
 */
export interface LaptopShell {
  base: Group;
  lid: Group;
  /** How tall the lid stands, for placing the screen on it. */
  lidHeight: number;
  /** The screen side of the lid, along its z, for the screen panel to sit just in front of. */
  screenZ: number;
}

/** Position and normal only: the shell takes one flat color, so nothing else is kept. */
function plain(geometry: BufferGeometry): BufferGeometry {
  const flat = geometry.index === null ? geometry.clone() : geometry.toNonIndexed();
  const kept = new BufferGeometry();
  const position = flat.getAttribute("position");
  if (position !== undefined) {
    kept.setAttribute("position", position);
  }
  const normal = flat.getAttribute("normal");
  if (normal !== undefined) {
    kept.setAttribute("normal", normal);
  } else {
    kept.computeVertexNormals();
  }
  return kept;
}

/** The triangles of a non-indexed geometry whose middle passes `keep`. */
function triangles(geometry: BufferGeometry, keep: (y: number) => boolean): BufferGeometry {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const picked: number[] = [];
  for (let first = 0; first + 2 < position.count; first += 3) {
    const middle = (position.getY(first) + position.getY(first + 1) + position.getY(first + 2)) / 3;
    if (keep(middle)) {
      picked.push(first, first + 1, first + 2);
    }
  }
  const out = new BufferGeometry();
  const copy = (attribute: typeof position): BufferAttribute => {
    const array = new Float32Array(picked.length * 3);
    picked.forEach((vertex, index) => {
      array[index * 3] = attribute.getX(vertex);
      array[index * 3 + 1] = attribute.getY(vertex);
      array[index * 3 + 2] = attribute.getZ(vertex);
    });
    return new BufferAttribute(array, 3);
  };
  out.setAttribute("position", copy(position));
  out.setAttribute("normal", copy(normal));
  return out;
}

function hasAncestor(object: Object3D, name: string): boolean {
  for (let node: Object3D | null = object; node !== null; node = node.parent) {
    if (node.name === name) {
      return true;
    }
  }
  return false;
}

/**
 * The model's shell `width` wide and `depth` from hinge to front edge in `material`, its deck
 * `baseHeight` high, taken apart into base and lid. The depth is the laptop's place on the desk,
 * so its front stays on the desk whatever the model's proportions. Null when the model did not
 * load, so the caller keeps its boxes.
 */
export function laptopShell(
  name: LaptopModel,
  size: { width: number; depth: number; baseHeight: number },
  material: MeshStandardMaterial,
): LaptopShell | null {
  const { width, depth, baseHeight } = size;
  const model = furnitureModel(name);
  if (model === null) {
    return null;
  }
  const spec = models[name];
  model.updateMatrixWorld(true);
  const lidParts: BufferGeometry[] = [];
  const baseParts: BufferGeometry[] = [];
  model.traverse((part) => {
    if (!(part instanceof Mesh)) {
      return;
    }
    const geometry = plain(part.geometry as BufferGeometry);
    geometry.applyMatrix4(part.matrixWorld);
    geometry.rotateY(spec.yaw);
    const split = spec.lidOf;
    if ("node" in split) {
      (hasAncestor(part, split.node) ? lidParts : baseParts).push(geometry);
    } else {
      lidParts.push(triangles(geometry, (y) => y > split.aboveY));
      baseParts.push(triangles(geometry, (y) => y <= split.aboveY));
    }
  });
  const lidGeometry = mergeGeometries(lidParts);
  const baseGeometry = mergeGeometries(baseParts);
  if (lidGeometry === null || baseGeometry === null) {
    console.error(`[office] laptop model "${name}" could not be taken apart; using the box laptop`);
    return null;
  }
  // The hinge: the base's back edge, at its top.
  baseGeometry.computeBoundingBox();
  const baseBounds = baseGeometry.boundingBox ?? new Box3();
  const hingeZ = baseBounds.min.z;
  const hingeY = baseBounds.max.y;
  const middleX = (baseBounds.min.x + baseBounds.max.x) / 2;
  const scale = width / (baseBounds.max.x - baseBounds.min.x);
  baseGeometry.translate(-middleX, -baseBounds.min.y, -hingeZ);
  baseGeometry.scale(
    scale,
    baseHeight / (baseBounds.max.y - baseBounds.min.y),
    depth / (baseBounds.max.z - baseBounds.min.z),
  );
  // Stand the lid up: it leans back past the hinge, so turn it forward by that lean.
  lidGeometry.translate(-middleX, -hingeY, -hingeZ);
  lidGeometry.computeBoundingBox();
  const leaning = lidGeometry.boundingBox ?? new Box3();
  lidGeometry.rotateX(Math.atan2(-leaning.min.z, leaning.max.y));
  lidGeometry.scale(scale, scale, scale);
  lidGeometry.computeBoundingBox();
  const upright = lidGeometry.boundingBox ?? new Box3();
  const base = new Group();
  const lid = new Group();
  for (const [holder, geometry] of [
    [base, baseGeometry],
    [lid, lidGeometry],
  ] as const) {
    const shell = new Mesh(geometry, material);
    shell.castShadow = true;
    shell.receiveShadow = true;
    holder.add(shell);
  }
  return { base, lid, lidHeight: upright.max.y, screenZ: upright.max.z };
}
