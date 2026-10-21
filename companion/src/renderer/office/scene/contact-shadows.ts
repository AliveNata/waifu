import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Texture } from "three";
import { type Furniture, room } from "../office-plan.js";
import { sceneQuality } from "./palette.js";

/*
 * Cheap ambient occlusion: soft dark patches where things meet the floor and where the walls meet
 * it. Real-time AO (high quality) deepens corners further; these stay on at every quality, because
 * they are the main thing that stops furniture from looking pasted onto the floor.
 */

/** Things on the walls or flat on the floor cast no contact shadow. */
const noContactShadow: ReadonlySet<Furniture["kind"]> = new Set(["whiteboard", "idea-board", "tv-wall", "rug"]);

function blurredRect(): CanvasTexture {
  const size = 128;
  const element = document.createElement("canvas");
  element.width = size;
  element.height = size;
  const ctx = element.getContext("2d");
  if (ctx === null) {
    throw new Error("2D canvas is not available");
  }
  ctx.filter = "blur(14px)";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(26, 26, size - 52, size - 52);
  const texture = new CanvasTexture(element);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** White at one edge fading to clear at the other, for the seams along the walls. */
function fadeStrip(): CanvasTexture {
  const element = document.createElement("canvas");
  element.width = 4;
  element.height = 128;
  const ctx = element.getContext("2d");
  if (ctx === null) {
    throw new Error("2D canvas is not available");
  }
  const gradient = ctx.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.35)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 128);
  const texture = new CanvasTexture(element);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * The opacities are tuned by eye on the plain renderer, which blends after converting to sRGB. With
 * post-processing (high quality) blending happens in linear light first, where the same opacity
 * darkens visibly less, so it is raised to the linear value that lands on the same sRGB shade.
 */
function blendOpacity(opacity: number): number {
  return sceneQuality() === "high" ? 1 - (1 - opacity) ** 2.2 : opacity;
}

function shadowMaterial(map: Texture, opacity: number): MeshBasicMaterial {
  // Black tinted by the texture's alpha; never written to depth, so it cannot hide anything.
  return new MeshBasicMaterial({
    color: "#000000",
    map,
    transparent: true,
    opacity: blendOpacity(opacity),
    depthWrite: false,
  });
}

export function buildContactShadows(pieces: readonly Furniture[]): Group {
  const group = new Group();
  group.name = "contact-shadows";
  const material = shadowMaterial(blurredRect(), 0.32);
  for (const piece of pieces) {
    if (noContactShadow.has(piece.kind)) {
      continue;
    }
    // The blurred rectangle fills the middle 60% of its texture, so the plane is sized up to match.
    const plane = new Mesh(new PlaneGeometry((piece.width + 0.06) / 0.6, (piece.depth + 0.06) / 0.6), material);
    plane.rotation.x = -Math.PI / 2;
    const holder = new Group();
    holder.position.set(piece.x, 0.004, piece.z);
    holder.rotation.y = piece.yaw;
    holder.add(plane);
    group.add(holder);
  }

  const seam = fadeStrip();
  const floorSeam = shadowMaterial(seam, 0.28);
  const wallSeam = shadowMaterial(seam, 0.22);
  const width = room.maxX - room.minX;
  const depth = room.maxZ - room.minZ;
  const reach = 0.55;
  const rise = 0.4;

  // Along the back wall: on the floor, dark at the wall; on the wall, dark at the floor.
  const backFloor = new Mesh(new PlaneGeometry(width, reach), floorSeam);
  // Laid flat, the texture's dark top edge points to -z, the back wall.
  backFloor.rotation.x = -Math.PI / 2;
  backFloor.position.set((room.minX + room.maxX) / 2, 0.005, room.minZ + reach / 2);
  const backWall = new Mesh(new PlaneGeometry(width, rise), wallSeam);
  // Upside down so the dark edge sits at the floor.
  backWall.rotation.z = Math.PI;
  backWall.position.set((room.minX + room.maxX) / 2, rise / 2, room.minZ + 0.004);

  // Along the left wall.
  const leftFloor = new Mesh(new PlaneGeometry(depth, reach), floorSeam);
  // A quarter turn first so the dark edge points to -x, the left wall, then laid flat.
  leftFloor.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  leftFloor.position.set(room.minX + reach / 2, 0.005, (room.minZ + room.maxZ) / 2);
  const leftWall = new Mesh(new PlaneGeometry(depth, rise), wallSeam);
  leftWall.rotation.set(0, Math.PI / 2, Math.PI);
  leftWall.position.set(room.minX + 0.004, rise / 2, (room.minZ + room.maxZ) / 2);

  group.add(backFloor, backWall, leftFloor, leftWall);
  return group;
}
