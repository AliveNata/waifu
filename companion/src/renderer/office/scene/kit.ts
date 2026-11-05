import { Box3, Group, type Material, Mesh, type MeshStandardMaterial, type Object3D, Vector3 } from "three";
import { type FurnitureModelName, furnitureModel } from "./furniture-models.js";
import { standard } from "./palette.js";

/** One material per kit material name and color, shared across every copy. */
const tinted = new Map<string, MeshStandardMaterial>();

/**
 * The kit colors its parts by material name ("wood", "carpet", "metal"...), in light pastel
 * tones; this swaps the named ones for the office's palette, leaving the rest as they are.
 */
export function recolorKit(model: Object3D, colors: Readonly<Record<string, string>>, roughness = 0.7): void {
  model.traverse((part) => {
    if (!(part instanceof Mesh)) {
      return;
    }
    const swap = (material: Material): Material => {
      const color = colors[material.name];
      if (color === undefined) {
        return material;
      }
      const key = `${material.name}:${color}:${roughness}`;
      let replacement = tinted.get(key);
      if (replacement === undefined) {
        replacement = standard(color, roughness);
        replacement.name = material.name;
        tinted.set(key, replacement);
      }
      return replacement;
    };
    part.material = Array.isArray(part.material) ? part.material.map(swap) : swap(part.material);
    part.castShadow = true;
    part.receiveShadow = true;
  });
}

/** How a kit model is fitted: to an exact box, or uniformly to a height with its own proportions. */
export type KitFit = { width: number; height: number; depth: number } | { height: number };

/**
 * A kit model fitted into the piece's local frame: its footprint centered on the origin, its base
 * on the floor, facing +Z like the kit draws it. Null when the model did not load, so the caller
 * builds its own stand-in. A uniform fit keeps moving parts (doors) from shearing as they turn.
 */
export function kitPiece(
  name: FurnitureModelName,
  fit: KitFit,
  colors: Readonly<Record<string, string>> = {},
): Group | null {
  const model = furnitureModel(name);
  if (model === null) {
    return null;
  }
  recolorKit(model, colors);
  return fitModel(model, fit);
}

/**
 * Any loaded model fitted the way `kitPiece` fits a kit model: its footprint centered on the
 * origin and its base on the floor, wrapped in a holder that can be turned and placed.
 */
export function fitModel(model: Object3D, fit: KitFit): Group {
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  if ("width" in fit) {
    model.scale.set(fit.width / size.x, fit.height / size.y, fit.depth / size.z);
  } else {
    model.scale.setScalar(fit.height / size.y);
  }
  model.position.set(-center.x * model.scale.x, -bounds.min.y * model.scale.y, -center.z * model.scale.z);
  const holder = new Group();
  holder.add(model);
  return holder;
}

/** The fitted size of a kit piece, for placing things on or beside it. */
export function kitSize(piece: Object3D): Vector3 {
  piece.updateMatrixWorld(true);
  return new Box3().setFromObject(piece).getSize(new Vector3());
}
