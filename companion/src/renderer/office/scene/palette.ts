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

export function standard(color: string, roughness = 0.8, metalness = 0): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: new Color(color), roughness, metalness });
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

/** Box positioned by its bottom face, which keeps furniture math readable. */
export function box(width: number, height: number, depth: number, material: Material, x = 0, y = 0, z = 0): Mesh {
  const part = mesh(new BoxGeometry(width, height, depth), material);
  part.position.set(x, y + height / 2, z);
  return part;
}
