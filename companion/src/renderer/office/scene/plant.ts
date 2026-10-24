import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshStandardMaterial } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** One leaf blade, measured from where it leaves the soil. */
export interface LeafShape {
  length: number;
  /** Widest point across the blade. */
  width: number;
  /** Which way round the pot it points, in radians about the vertical. */
  azimuth: number;
  /** Tilt away from vertical at the base, in radians. */
  lift: number;
  /** Extra tilt reached at the tip, so the blade arches over instead of sticking out straight. */
  droop: number;
  baseColor: Color;
  tipColor: Color;
}

/** Enough segments along the blade for the arch to read as a curve, not a fold. */
const lengthSegments = 7;
/** How far the blade's edges rise above the midrib, as a share of its half width. */
const midribFold = 0.35;

/** Half width at `t` (0 at the base, 1 at the tip): narrow stalk, broad middle, pointed tip. */
export function leafHalfWidth(width: number, t: number): number {
  return (width / 2) * Math.sin(Math.PI * t) ** 0.7 * (1 - 0.25 * t);
}

/**
 * A blade arching out of the soil: three vertices across (edge, midrib, edge) so it has a crease
 * down the middle, the edges lifted a little, and color shading from base to tip.
 */
export function leafGeometry(shape: LeafShape): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const color = new Color();
  // Walk the midrib in the plane of the leaf: `out` away from the stem, `up` toward the ceiling.
  let out = 0;
  let up = 0;
  const step = shape.length / lengthSegments;
  for (let index = 0; index <= lengthSegments; index++) {
    const t = index / lengthSegments;
    const tilt = shape.lift + shape.droop * t * t;
    if (index > 0) {
      out += step * Math.sin(tilt);
      up += step * Math.cos(tilt);
    }
    const half = leafHalfWidth(shape.width, t);
    // The blade's upper face points along (-cos, sin) of the tilt; raised edges go that way.
    const raise = half * midribFold;
    const edgeOut = out - Math.cos(tilt) * raise;
    const edgeUp = up + Math.sin(tilt) * raise;
    positions.push(edgeOut, edgeUp, -half, out, up, 0, edgeOut, edgeUp, half);
    color.copy(shape.baseColor).lerp(shape.tipColor, t);
    for (let vertex = 0; vertex < 3; vertex++) {
      colors.push(color.r, color.g, color.b);
    }
    if (index > 0) {
      const row = index * 3;
      const previous = row - 3;
      indices.push(previous, row, previous + 1, previous + 1, row, row + 1);
      indices.push(previous + 1, row + 1, previous + 2, previous + 2, row + 1, row + 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.rotateY(shape.azimuth);
  geometry.computeVertexNormals();
  return geometry;
}

/** A stable pseudo-random 0..1 per leaf, so every plant looks the same on every load. */
function jitter(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

const goldenAngle = Math.PI * (3 - Math.sqrt(5));

/**
 * The leaves of a potted plant, as one mesh. Inner leaves stand up, outer ones arch over the rim,
 * and each one turns by the golden angle from the last, the way leaves spread to find light.
 */
export function leafyCrown(potRadius: number, light: string, dark: string): Mesh {
  const count = Math.round(14 + potRadius * 30);
  const lightColor = new Color(light);
  const darkColor = new Color(dark);
  const blades: BufferGeometry[] = [];
  for (let index = 0; index < count; index++) {
    // 0 for the first, innermost leaf, 1 for the last, outermost one.
    const ring = index / (count - 1);
    const length = potRadius * (2.6 - ring * 0.9) * (0.85 + jitter(index, 1) * 0.3);
    const tip = darkColor.clone().lerp(lightColor, 0.6 + jitter(index, 2) * 0.4);
    blades.push(
      leafGeometry({
        length,
        width: length * (0.3 + jitter(index, 3) * 0.08),
        azimuth: index * goldenAngle,
        lift: 0.12 + ring * 0.75,
        droop: 0.5 + ring * 0.7 + jitter(index, 4) * 0.3,
        baseColor: darkColor,
        tipColor: tip,
      }),
    );
  }
  const merged = mergeGeometries(blades);
  if (merged === null) {
    throw new Error("could not merge the plant's leaves");
  }
  for (const blade of blades) {
    blade.dispose();
  }
  // Both faces: an arching leaf shows its underside from most angles.
  const crown = new Mesh(merged, new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.7 }));
  crown.castShadow = true;
  crown.receiveShadow = true;
  return crown;
}
