import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  type Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type Texture,
} from "three";
import { furniture, room } from "../office-plan.js";
import { entryDoorHeight } from "./furniture.js";
import { NeonStrips } from "./neon.js";
import { mesh, palette, standard } from "./palette.js";
import { quoteTexture } from "./textures.js";

/**
 * The parts of the room the overview leaves off so it can look in: the right and front walls and
 * the ceiling, with a short hall behind the glass door. Only Alyx, inside the room at eye height,
 * sees them; from anywhere else they would only block the view.
 */
const thickness = 0.12;
/** Past the door: a hall this deep, so the glass shows a corridor instead of the void. */
const hallDepth = 1.8;
/** The ceiling's light panels, in a grid over the whole floor. */
const panelColumns = [-5.6, -2.6, 0.4, 3.4, 6.4, 9.2] as const;
const panelRows = [-3.4, -0.4, 2.6] as const;

/** A box by its center, without casting a shadow: the sun has to keep reaching the floor. */
function slab(width: number, height: number, depth: number, color: string, x: number, y: number, z: number): Mesh {
  const part = mesh(new BoxGeometry(width, height, depth), standard(color, 0.95), false);
  part.position.set(x, y, z);
  return part;
}

export interface Enclosure {
  root: Group;
  /** Running light along the new walls and across the ceiling, like the room's own strips. */
  neon: NeonStrips;
  /** How bright the room's lights are, 1 by day, lower as the office empties out at night. */
  setLight(level: number): void;
}

/** The lines on the walls, in neon lettering: two on the front wall, two on the right. */
export const wallQuotes = [
  "Ship it. Then make it better.",
  "GG. Next sprint.",
  "No bugs, only side quests.",
  "Respawn. Retry. Release.",
] as const;

/** The ceiling only gets light bounced off the floor, which reads brown; this keeps it a lit white. */
const ceilingGlow = 0.45;
const panelGlow = 0.9;

/** `lettering` draws a quote; it paints on a canvas, so tests without a DOM pass their own. */
export function buildEnclosure(lettering: (text: string) => Texture = quoteTexture): Enclosure {
  const root = new Group();
  root.name = "enclosure";
  const { minX, maxX, minZ, maxZ, wallHeight } = room;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  // The front wall, across the whole room, and its skirting.
  root.add(
    slab(width + 2 * thickness, wallHeight, thickness, palette.sideWall, centerX, wallHeight / 2, maxZ + thickness / 2),
    slab(width, 0.1, 0.03, palette.skirting, centerX, 0.05, maxZ - 0.015),
  );

  // The right wall, open where the glass door stands, with a lintel over it.
  const door = furniture.find((piece) => piece.id === "entry-door");
  const doorFrom = door === undefined ? -0.9 : door.z - door.depth / 2;
  const doorTo = door === undefined ? 0.9 : door.z + door.depth / 2;
  const header = entryDoorHeight + 0.1;
  const wallX = maxX + thickness / 2;
  const southLength = doorFrom - minZ;
  const northLength = maxZ - doorTo;
  root.add(
    slab(thickness, wallHeight, southLength, palette.sideWall, wallX, wallHeight / 2, minZ + southLength / 2),
    slab(thickness, wallHeight, northLength, palette.sideWall, wallX, wallHeight / 2, doorTo + northLength / 2),
    // Into the walls on both sides and a hair thinner, so no crack shows at the joins and the
    // overlapping faces never fight over the same depth.
    slab(
      thickness - 0.004,
      wallHeight - header,
      doorTo - doorFrom + 0.1,
      palette.sideWall,
      wallX,
      (wallHeight + header) / 2,
      (doorFrom + doorTo) / 2,
    ),
    slab(0.03, 0.1, southLength, palette.skirting, maxX - 0.015, 0.05, minZ + southLength / 2),
    slab(0.03, 0.1, northLength, palette.skirting, maxX - 0.015, 0.05, doorTo + northLength / 2),
  );

  // The hall behind the door: floor, end wall, two side walls and a low ceiling, a shade darker
  // than the office so the room stays the brighter place.
  const hallFrom = maxX + thickness;
  const hallX = hallFrom + hallDepth / 2;
  const hallZ = (doorFrom + doorTo) / 2;
  const hallWidth = doorTo - doorFrom + 0.4;
  root.add(
    slab(hallDepth, 0.02, hallWidth, palette.inkSoft, hallX, -0.01, hallZ),
    slab(
      thickness,
      wallHeight,
      hallWidth,
      palette.skirting,
      hallFrom + hallDepth + thickness / 2,
      wallHeight / 2,
      hallZ,
    ),
    slab(
      hallDepth,
      wallHeight,
      thickness,
      palette.skirting,
      hallX,
      wallHeight / 2,
      hallZ - hallWidth / 2 - thickness / 2,
    ),
    slab(
      hallDepth,
      wallHeight,
      thickness,
      palette.skirting,
      hallX,
      wallHeight / 2,
      hallZ + hallWidth / 2 + thickness / 2,
    ),
    slab(hallDepth, thickness, hallWidth, palette.sideWall, hallX, wallHeight + thickness / 2, hallZ),
  );

  // The ceiling, over the walls' tops.
  const ceiling = slab(
    width + 2 * thickness,
    thickness,
    depth + 2 * thickness,
    palette.backWall,
    centerX,
    wallHeight + thickness / 2,
    centerZ,
  );
  const ceilingMaterial = ceiling.material as MeshStandardMaterial;
  ceilingMaterial.emissive.set(palette.backWall);
  ceilingMaterial.emissiveIntensity = ceilingGlow;
  root.add(ceiling);

  // Light panels flush under the ceiling: one draw for all of them. They glow on their own, the
  // way office lights look from below.
  const panelMaterial = new MeshStandardMaterial({
    color: "#ffffff",
    emissive: "#fff4e2",
    emissiveIntensity: panelGlow,
  });
  const panels = new InstancedMesh(
    new PlaneGeometry(1.2, 0.6),
    panelMaterial,
    panelColumns.length * panelRows.length + 1,
  );
  const place = new Matrix4();
  const faceDown = new Matrix4().makeRotationX(Math.PI / 2);
  let index = 0;
  for (const x of panelColumns) {
    for (const z of panelRows) {
      panels.setMatrixAt(index, place.makeTranslation(x, wallHeight - 0.005, z).multiply(faceDown));
      index += 1;
    }
  }
  panels.setMatrixAt(index, place.makeTranslation(hallX, wallHeight - 0.005, hallZ).multiply(faceDown));
  panels.castShadow = false;
  root.add(panels);

  // Neon: along the top and the skirting of the two new walls (the skirting stops at the door),
  // a frame round the ceiling's edge, and two lines down its length between the light panels.
  const top = wallHeight - 0.1;
  const low = 0.12;
  const front = maxZ - 0.03;
  const right = maxX - 0.03;
  const ceilingY = wallHeight - 0.02;
  const inset = 0.25;
  const neon = new NeonStrips([
    { from: { x: minX, z: front }, to: { x: maxX, z: front }, y: top },
    { from: { x: right, z: maxZ }, to: { x: right, z: minZ }, y: top },
    { from: { x: minX, z: front }, to: { x: maxX, z: front }, y: low, direction: -1 },
    { from: { x: right, z: maxZ }, to: { x: right, z: doorTo }, y: low, direction: -1 },
    { from: { x: right, z: doorFrom }, to: { x: right, z: minZ }, y: low, direction: -1 },
    { from: { x: minX + inset, z: minZ + inset }, to: { x: maxX - inset, z: minZ + inset }, y: ceilingY },
    { from: { x: maxX - inset, z: minZ + inset }, to: { x: maxX - inset, z: maxZ - inset }, y: ceilingY },
    { from: { x: maxX - inset, z: maxZ - inset }, to: { x: minX + inset, z: maxZ - inset }, y: ceilingY },
    { from: { x: minX + inset, z: maxZ - inset }, to: { x: minX + inset, z: minZ + inset }, y: ceilingY },
    { from: { x: minX + 1, z: -1.9 }, to: { x: maxX - 1, z: -1.9 }, y: ceilingY, direction: -1 },
    { from: { x: maxX - 1, z: 1.1 }, to: { x: minX + 1, z: 1.1 }, y: ceilingY, direction: -1 },
  ]);
  root.add(neon.mesh);

  // The quotes, above head height so desks and screens never cover them.
  const quoteSpots: [number, number, number][] = [
    // x, z, turn about y so the lettering faces into the room
    [-2.6, maxZ - 0.012, Math.PI],
    [4.6, maxZ - 0.012, Math.PI],
    [maxX - 0.012, -3.2, -Math.PI / 2],
    [maxX - 0.012, 2.3, -Math.PI / 2],
  ];
  wallQuotes.forEach((text, index) => {
    const spot = quoteSpots[index];
    if (spot === undefined) {
      return;
    }
    const [x, z, yaw] = spot;
    const material = new MeshBasicMaterial({
      map: lettering(text),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const plane = mesh(new PlaneGeometry(2, 0.39), material, false);
    plane.position.set(x, 1.62, z);
    plane.rotation.y = yaw;
    root.add(plane);
  });

  return {
    root,
    neon,
    setLight(level) {
      const clamped = Math.max(0, Math.min(1, level));
      ceilingMaterial.emissiveIntensity = ceilingGlow * clamped;
      panelMaterial.emissiveIntensity = panelGlow * clamped;
    },
  };
}
