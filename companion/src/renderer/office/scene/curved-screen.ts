import { type BufferGeometry, PlaneGeometry } from "three";

/**
 * A screen `width` by `height`, bent round a vertical axis `radius` away so it follows the face of
 * a curved monitor: its middle stays at z 0 and its sides come forward, toward +z and the viewer.
 * The picture keeps its width along the curve, so screen text keeps its shape.
 */
export function curvedScreenGeometry(width: number, height: number, radius: number): BufferGeometry {
  // Enough columns that the facets do not show at the room's viewing distance.
  const columns = 24;
  const geometry = new PlaneGeometry(width, height, columns, 1);
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index++) {
    const along = position.getX(index);
    const angle = along / radius;
    position.setXYZ(index, radius * Math.sin(angle), position.getY(index), radius * (1 - Math.cos(angle)));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** The radius of the circle through a curved face `chord` wide whose sides stand `sag` forward of its middle. */
export function radiusOfCurve(chord: number, sag: number): number {
  return (chord * chord) / (8 * sag) + sag / 2;
}
