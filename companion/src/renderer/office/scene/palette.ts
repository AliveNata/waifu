import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Texture,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { type SurfaceKind, surfaceMaps } from "./surface-detail.js";

/*
 * AlyxLabs palette (antislop R-29/R-31), read as: a bright, warm office with
 * gaming accents, dial ENERGY 2 / RHYTHM 2 / MOTION 2.
 * - Warm white walls and light oak floor: daylight office, easy to look at all day.
 * - Ink: the logo's deep violet, used for furniture so the room shares the brand's dark tone.
 * - Leaf green: plants, the "green flag" calm that balances the gaming gear.
 * - Accent: the logo's bright purple, the only glowing color (LED strips, keys, sign).
 *   Glow is reserved for gear and the sign, never for walls or furniture bodies.
 */
export const palette = {
  floor: "#dcc6a2",
  floorSeam: "#c9b28c",
  backWall: "#f3efe9",
  sideWall: "#e8e2d9",
  skirting: "#bfae92",
  ink: "#2a2140",
  inkSoft: "#3a3058",
  inkDeep: "#1b0f2e",
  laminate: "#f4f1ec",
  oak: "#c9a47a",
  steel: "#c9ccd3",
  leaf: "#5b8c4a",
  leafDark: "#3f6e35",
  pot: "#ece6dc",
  fabric: "#5a4f78",
  cushion: "#e9e1d4",
  rug: "#d9d1c4",
  accent: "#b45cff",
  accentSoft: "#cfa0ff",
  frame: "#9aa0aa",
  glass: "#dfe9f2",
} as const;

export type SceneQuality = "high" | "low";

let quality: SceneQuality = "high";

/** Set before the office is built: "high" adds rounded edges and surface detail, "low" keeps plain boxes. */
export function setSceneQuality(next: SceneQuality): void {
  quality = next;
}

export function sceneQuality(): SceneQuality {
  return quality;
}

/**
 * Each palette color stands for one material in the room, so its surface detail follows the color:
 * oak is wood, fabric and cushion are cloth, steel is brushed metal, walls are plaster, and the
 * ink furniture is a satin finish.
 */
const surfaceByColor: Readonly<Record<string, SurfaceKind>> = {
  [palette.oak]: "wood",
  [palette.fabric]: "fabric",
  [palette.cushion]: "fabric",
  [palette.rug]: "fabric",
  [palette.inkSoft]: "fabric",
  [palette.steel]: "metal",
  [palette.frame]: "metal",
  [palette.backWall]: "plaster",
  [palette.sideWall]: "plaster",
  [palette.ink]: "satin",
  [palette.inkDeep]: "satin",
  [palette.laminate]: "satin",
};

export function standard(color: string, roughness = 0.8, metalness = 0): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ color: new Color(color), roughness, metalness });
  const kind = quality === "high" ? surfaceByColor[color] : undefined;
  if (kind !== undefined) {
    const maps = surfaceMaps(kind);
    material.normalMap = maps.normalMap;
    material.normalScale.set(maps.normalScale, maps.normalScale);
    if (maps.map !== null) {
      material.map = maps.map;
    }
  }
  return material;
}

/** The single accent glow. Emissive so it reads as light even in shade, toned down to stay an accent. */
export function glow(color: string = palette.accent, intensity = 1.6): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color(color),
    emissive: new Color(color),
    emissiveIntensity: intensity,
    roughness: 0.4,
  });
}

/** Unlit plane material for screens and signs, so their content stays readable in any light. */
export function unlit(map: Texture, transparent = false): MeshBasicMaterial {
  return new MeshBasicMaterial({ map, toneMapped: false, transparent });
}

/**
 * Printed or written surfaces (boards, sticky notes): lit by the room like paper, with a faint
 * self-glow so the writing stays legible in shade. Unlike screens they dim when the room goes dark.
 */
export function printed(map: Texture): MeshStandardMaterial {
  return new MeshStandardMaterial({
    map,
    roughness: 0.85,
    emissive: new Color("#ffffff"),
    emissiveMap: map,
    emissiveIntensity: 0.3,
  });
}

export function mesh(geometry: BufferGeometry, material: Material, castShadow = true): Mesh {
  const part = new Mesh(geometry, material);
  part.castShadow = castShadow;
  part.receiveShadow = true;
  return part;
}

/** Edges round off to at most 2 cm, never more than a fifth of the thinnest side. */
const maxEdgeRadius = 0.02;
const minRoundedSide = 0.012;

/**
 * Box positioned by its bottom face, which keeps furniture math readable. On high quality the
 * edges are rounded: real furniture has no knife edges, and the highlight along a soft edge is
 * much of what makes a shape read as solid.
 */
export function box(width: number, height: number, depth: number, material: Material, x = 0, y = 0, z = 0): Mesh {
  const thinnest = Math.min(width, height, depth);
  const geometry =
    quality === "high" && thinnest >= minRoundedSide
      ? new RoundedBoxGeometry(width, height, depth, 2, Math.min(maxEdgeRadius, thinnest * 0.2))
      : new BoxGeometry(width, height, depth);
  const part = mesh(geometry, material);
  part.position.set(x, y + height / 2, z);
  return part;
}
