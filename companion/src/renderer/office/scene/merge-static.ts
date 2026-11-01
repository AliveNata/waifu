import { type BufferGeometry, type Material, Mesh, MeshStandardMaterial, type Object3D } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Everything the running office still reaches into after the room is built. */
export interface LiveParts {
  objects: Set<Object3D>;
  materials: Set<Material>;
}

/** How deep to follow fields when looking for live parts: deep enough for a workstation's lamp's bulb. */
const maxDepth = 6;

/**
 * Collects every object and material reachable from the office's props: the doors, screens,
 * lamps, mugs, laptops and the rest that the stage moves, hides or recolors every frame. Anything
 * found here, or anything inside an object found here, must stay its own mesh.
 */
export function collectLiveParts(props: Record<string, unknown>, skip: readonly unknown[]): LiveParts {
  const live: LiveParts = { objects: new Set(), materials: new Set() };
  const seen = new Set<unknown>(skip);
  const visit = (value: unknown, depth: number): void => {
    if (value === null || typeof value !== "object" || seen.has(value) || depth > maxDepth) {
      return;
    }
    seen.add(value);
    const candidate = value as { isObject3D?: boolean; isMaterial?: boolean; isTexture?: boolean };
    if (candidate.isObject3D === true) {
      live.objects.add(value as Object3D);
      return;
    }
    if (candidate.isMaterial === true) {
      live.materials.add(value as Material);
      return;
    }
    // Page elements (canvases, contexts) and raw buffers hold nothing of the 3D scene.
    if (
      candidate.isTexture === true ||
      (typeof Node !== "undefined" && value instanceof Node) ||
      ArrayBuffer.isView(value)
    ) {
      return;
    }
    const children = value instanceof Map || value instanceof Set ? [...value.values()] : Object.values(value);
    for (const child of children) {
      visit(child, depth + 1);
    }
  };
  for (const value of Object.values(props)) {
    visit(value, 0);
  }
  return live;
}

/** Plain lit surfaces only: no textures that redraw, no see-through glass, no screens. */
function mergeable(material: Material): material is MeshStandardMaterial {
  return (
    material instanceof MeshStandardMaterial &&
    !material.transparent &&
    material.opacity === 1 &&
    material.map === null &&
    material.emissiveMap === null &&
    material.alphaMap === null
  );
}

/** Materials that look the same share one key, so boxes made with separate but identical materials merge. */
function lookKey(mesh: Mesh, material: MeshStandardMaterial, geometry: BufferGeometry): string {
  const attributes = Object.keys(geometry.attributes).sort().join(",");
  return [
    material.color.getHexString(),
    material.roughness,
    material.metalness,
    material.emissive.getHexString(),
    material.emissiveIntensity,
    material.normalMap?.uuid ?? "",
    material.normalScale.x,
    material.side,
    material.flatShading,
    mesh.castShadow,
    mesh.receiveShadow,
    attributes,
    geometry.index === null ? "flat" : "indexed",
  ].join("|");
}

function insideLive(mesh: Object3D, root: Object3D, live: LiveParts): boolean {
  for (let node: Object3D | null = mesh; node !== null && node !== root; node = node.parent) {
    if (live.objects.has(node) || !node.visible) {
      return true;
    }
  }
  return false;
}

/**
 * Bakes the furniture that never moves into one mesh per material look, cutting draw calls from
 * one per box to one per look. The originals are taken out of the scene; the live parts, and
 * anything with a texture, glass or a glow that changes, are left exactly as they were.
 * Returns how many meshes went in and how many came out.
 */
export function mergeStaticMeshes(root: Object3D, live: LiveParts): { merged: number; into: number } {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const groups = new Map<string, Mesh[]>();
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (
      mesh.isMesh !== true ||
      (mesh as { isInstancedMesh?: boolean }).isInstancedMesh === true ||
      (mesh as { isSkinnedMesh?: boolean }).isSkinnedMesh === true ||
      Array.isArray(mesh.material)
    ) {
      return;
    }
    const material = mesh.material;
    if (!mergeable(material) || live.materials.has(material) || insideLive(mesh, root, live)) {
      return;
    }
    // A mirrored transform would turn the faces inside out once baked.
    if (mesh.matrixWorld.determinant() <= 0) {
      return;
    }
    const key = lookKey(mesh, material, mesh.geometry);
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [mesh]);
    } else {
      group.push(mesh);
    }
  });

  let merged = 0;
  let into = 0;
  for (const meshes of groups.values()) {
    const first = meshes[0];
    if (first === undefined || meshes.length < 2) {
      continue;
    }
    const baked = meshes.map((mesh) => mesh.geometry.clone().applyMatrix4(toRoot.clone().multiply(mesh.matrixWorld)));
    const geometry = mergeGeometries(baked, false);
    for (const part of baked) {
      part.dispose();
    }
    if (geometry === null) {
      console.warn(`[office] could not merge ${meshes.length} meshes; leaving them as they are`);
      continue;
    }
    const combined = new Mesh(geometry, first.material);
    combined.castShadow = first.castShadow;
    combined.receiveShadow = first.receiveShadow;
    combined.name = "merged-static";
    root.add(combined);
    for (const mesh of meshes) {
      mesh.removeFromParent();
    }
    merged += meshes.length;
    into += 1;
  }
  return { merged, into };
}
