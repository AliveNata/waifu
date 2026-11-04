import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  type Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type Texture,
} from "three";
import { furniture, room } from "../office-plan.js";
import { entryDoorHeight } from "./furniture.js";
import { NeonStrips } from "./neon.js";
import { mesh, palette, standard } from "./palette.js";
import { paintWallArt, type WallArt, wallArtSize } from "./textures.js";

/**
 * The parts of the room the overview leaves off so it can look in: the right and front walls and
 * the ceiling, with a short hall behind the glass door. Only Alyx, inside the room at eye height,
 * sees them; from anywhere else they would only block the view.
 */
const thickness = 0.12;
/** Past the door: a hall this deep, so the glass shows a corridor instead of the void. */
const hallDepth = 1.8;

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

/**
 * The painted lettering, one piece per stretch of wall: the sentence chain right of the door's
 * south side, the script line north of it, and the manifesto across the front wall.
 */
export const wallArts: readonly WallArt[] = ["block", "script", "manifesto"];

/** The open ceiling is dark; the hanging discs carry the light, a soft glow plus their downlights. */
const discGlow = 0.35;
const downlightGlow = 1.4;

/**
 * Suspended light discs, as [x, z, radius]: two staggered rows clear of the neon bundle that runs
 * down the middle, the way the reference office hangs them.
 */
const discs: readonly [number, number, number][] = [
  [-5.4, -3.1, 1.0],
  [-1.8, -3.1, 0.85],
  [1.8, -3.1, 1.0],
  [5.4, -3.1, 0.85],
  [8.8, -3.1, 0.95],
  [-3.6, 1.9, 0.9],
  [0, 1.9, 1.05],
  [3.6, 1.9, 0.9],
  [7.2, 1.9, 1.0],
];
/** How far below the ceiling the discs hang. */
const discDrop = 0.2;
const downlightsPerDisc = 7;
/** Vines per disc, and the most leaves one vine carries from the rim downward. */
const vinesPerDisc = 22;
const leavesPerVine = 6;
const leavesPerDisc = vinesPerDisc * leavesPerVine;

/** A small seeded random, so the plants hang the same way every time the office opens. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** `paint` draws a piece of wall lettering; it paints on a canvas, so tests without a DOM pass their own. */
export function buildEnclosure(paint: (art: WallArt) => Texture = paintWallArt): Enclosure {
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

  // The ceiling over the walls' tops, dark like an open services ceiling, so the discs read.
  root.add(
    slab(
      width + 2 * thickness,
      thickness,
      depth + 2 * thickness,
      "#3a3644",
      centerX,
      wallHeight + thickness / 2,
      centerZ,
    ),
  );

  // The discs, their hanging rods, downlights round their underside and trailing plants round the
  // rim: one instanced mesh each, so the whole ceiling is a handful of draws.
  const spots: [number, number, number][] = [...discs, [hallX, hallZ, 0.45]];
  const discY = wallHeight - discDrop;
  const discMaterial = new MeshStandardMaterial({ color: "#f4f2ee", emissive: "#ffffff", emissiveIntensity: discGlow });
  const discMesh = new InstancedMesh(new CylinderGeometry(1, 1, 0.06, 40), discMaterial, spots.length);
  const rods = new InstancedMesh(
    new CylinderGeometry(0.006, 0.006, discDrop, 6),
    standard(palette.steel, 0.4, 0.6),
    spots.length * 3,
  );
  const downlightMaterial = new MeshStandardMaterial({
    color: "#ffffff",
    emissive: "#fff6e6",
    emissiveIntensity: downlightGlow,
  });
  const downlights = new InstancedMesh(
    new CircleGeometry(0.035, 16),
    downlightMaterial,
    spots.length * downlightsPerDisc,
  );
  // Small flattened leaves, so a vine reads as foliage rather than a string of stones.
  const leaves = new InstancedMesh(
    new IcosahedronGeometry(0.022, 0),
    standard(palette.leaf, 0.8),
    discs.length * leavesPerDisc,
  );
  const darkLeaves = new InstancedMesh(
    new IcosahedronGeometry(0.02, 0),
    standard(palette.leafDark, 0.8),
    discs.length * leavesPerDisc,
  );
  const place = new Matrix4();
  const turn = new Matrix4();
  const size = new Matrix4();
  const faceDown = new Matrix4().makeRotationX(Math.PI / 2);
  const random = seeded(17);
  spots.forEach(([x, z, radius], index) => {
    discMesh.setMatrixAt(index, place.makeTranslation(x, discY, z).multiply(size.makeScale(radius, 1, radius)));
    for (let rod = 0; rod < 3; rod++) {
      const angle = (rod / 3) * Math.PI * 2;
      rods.setMatrixAt(
        index * 3 + rod,
        place.makeTranslation(
          x + Math.sin(angle) * radius * 0.6,
          discY + discDrop / 2,
          z + Math.cos(angle) * radius * 0.6,
        ),
      );
    }
    for (let light = 0; light < downlightsPerDisc; light++) {
      const angle = (light / downlightsPerDisc) * Math.PI * 2;
      downlights.setMatrixAt(
        index * downlightsPerDisc + light,
        place
          .makeTranslation(x + Math.sin(angle) * radius * 0.62, discY - 0.032, z + Math.cos(angle) * radius * 0.62)
          .multiply(faceDown),
      );
    }
  });
  // Vines round each rim: a leaf every few centimeters down a strand, strands of different
  // lengths, alternating the two greens; unused slots stay folded away to nothing.
  const hidden = new Matrix4().makeScale(0, 0, 0);
  discs.forEach(([x, z, radius], index) => {
    for (let vine = 0; vine < vinesPerDisc; vine++) {
      const angle = (vine / vinesPerDisc) * Math.PI * 2 + random() * 0.15;
      const length = 1 + Math.floor(random() ** 1.3 * leavesPerVine);
      const out = radius + 0.01 + random() * 0.03;
      for (let leaf = 0; leaf < leavesPerVine; leaf++) {
        const slot = index * leavesPerDisc + vine * leavesPerVine + leaf;
        const strand = leaf % 2 === 0 ? leaves : darkLeaves;
        const other = strand === leaves ? darkLeaves : leaves;
        other.setMatrixAt(slot, hidden);
        if (leaf >= length) {
          strand.setMatrixAt(slot, hidden);
          continue;
        }
        const sway = (random() - 0.5) * 0.03;
        strand.setMatrixAt(
          slot,
          place
            .makeTranslation(
              x + Math.sin(angle) * (out + sway),
              discY + 0.02 - leaf * 0.045,
              z + Math.cos(angle) * (out + sway),
            )
            .multiply(turn.makeRotationY(random() * Math.PI))
            .multiply(size.makeScale(1.4, 0.5, 0.9)),
        );
      }
    }
  });
  for (const part of [discMesh, rods, downlights, leaves, darkLeaves]) {
    part.castShadow = false;
    root.add(part);
  }

  // Neon: along the top and the skirting of the two new walls (the skirting stops at the door),
  // and a bundle of three colored lines down the length of the ceiling.
  const top = wallHeight - 0.1;
  const low = 0.12;
  const front = maxZ - 0.03;
  const right = maxX - 0.03;
  const ceilingY = wallHeight - 0.02;
  const neon = new NeonStrips([
    { from: { x: minX, z: front }, to: { x: maxX, z: front }, y: top },
    { from: { x: right, z: maxZ }, to: { x: right, z: minZ }, y: top },
    { from: { x: minX, z: front }, to: { x: maxX, z: front }, y: low, direction: -1 },
    { from: { x: right, z: maxZ }, to: { x: right, z: doorTo }, y: low, direction: -1 },
    { from: { x: right, z: doorFrom }, to: { x: right, z: minZ }, y: low, direction: -1 },
    // The bundle down the ceiling's middle: teal, pink and the brand's purple side by side.
    ...(
      [
        [-0.88, ["#2fd6c8", "#5ce0ff"]],
        [-0.76, ["#ff5fa8", "#ff8fc8"]],
        [-0.64, ["#b45cff", "#6f7fdc"]],
      ] as const
    ).map(([z, colors], line) => ({
      from: { x: minX + 0.4, z },
      to: { x: maxX - 0.4, z },
      y: ceilingY,
      direction: line % 2 === 0 ? (1 as const) : (-1 as const),
      colors,
    })),
  ]);
  root.add(neon.mesh);

  // The lettering, painted on above the furniture: [art, x, z, turn about y, plane width, center height].
  const artSpots: Record<WallArt, [number, number, number, number, number]> = {
    block: [maxX - 0.012, (minZ + doorFrom) / 2, -Math.PI / 2, 2.0, 1.42],
    // High enough to clear the cabinet standing against this stretch of wall.
    script: [maxX - 0.012, (doorTo + maxZ) / 2 + 0.2, -Math.PI / 2, 2.0, 1.68],
    manifesto: [1.75, maxZ - 0.012, Math.PI, 6.4, 1.5],
  };
  for (const art of wallArts) {
    const [x, z, yaw, planeWidth, y] = artSpots[art];
    const { width: pixelsWide, height: pixelsHigh } = wallArtSize[art];
    // Lit like the wall it is painted on, so it dims with the room at night.
    const material = new MeshStandardMaterial({
      map: paint(art),
      transparent: true,
      depthWrite: false,
      roughness: 0.9,
    });
    const plane = mesh(new PlaneGeometry(planeWidth, (planeWidth * pixelsHigh) / pixelsWide), material, false);
    plane.position.set(x, y, z);
    plane.rotation.y = yaw;
    root.add(plane);
  }

  return {
    root,
    neon,
    setLight(level) {
      const clamped = Math.max(0, Math.min(1, level));
      discMaterial.emissiveIntensity = discGlow * clamped;
      downlightMaterial.emissiveIntensity = downlightGlow * clamped;
    },
  };
}
