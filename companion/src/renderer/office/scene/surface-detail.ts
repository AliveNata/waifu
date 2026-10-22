import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

/**
 * Procedural surface detail: tileable bump patterns turned into normal maps, so wood shows its
 * grain, fabric its weave and walls their plaster under the room's lights. Generated once per
 * kind on a canvas; nothing is downloaded.
 */
export type SurfaceKind = "wood" | "fabric" | "metal" | "plaster" | "satin" | "planks";

const size = 256;

/** A stable pseudo-random value per lattice point, so every run makes the same texture. */
function hash(x: number, y: number, seed: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Smooth value noise over one tile, `cellsX` by `cellsY` lattice cells, wrapping per axis so the
 * texture tiles without seams. Unequal counts stretch it, which is how brushed metal gets streaks.
 */
function valueNoise(u: number, v: number, cellsX: number, cellsY: number, seed: number): number {
  const x = u * cellsX;
  const y = v * cellsY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const wrapX = (value: number) => ((value % cellsX) + cellsX) % cellsX;
  const wrapY = (value: number) => ((value % cellsY) + cellsY) % cellsY;
  const a = hash(wrapX(x0), wrapY(y0), seed);
  const b = hash(wrapX(x0 + 1), wrapY(y0), seed);
  const c = hash(wrapX(x0), wrapY(y0 + 1), seed);
  const d = hash(wrapX(x0 + 1), wrapY(y0 + 1), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function wrappedDistance(a: number, b: number): number {
  const apart = Math.abs(a - b) % size;
  return Math.min(apart, size - apart);
}

/** Height in 0..1 for a pixel of each surface kind. Every pattern repeats exactly across the tile. */
export function surfaceHeight(kind: SurfaceKind, x: number, y: number): number {
  const u = x / size;
  const v = y / size;
  switch (kind) {
    case "wood": {
      // Long grain lines along x that wander a little, plus fine pores.
      const wander = valueNoise(u, v, 4, 8, 1) * 3;
      const grain = 0.5 + 0.35 * Math.sin((v * 22 + wander) * Math.PI * 2);
      return grain * 0.8 + valueNoise(u, v, 64, 64, 2) * 0.2;
    }
    case "planks": {
      // Grooves on the same plank layout floorTexture paints (8 rows, two staggered joints per
      // row, on a 512 px canvas), so the light catches the seams instead of a pattern beside them.
      const plankRows = 8;
      const rowHeight = size / plankRows;
      const row = Math.floor(y / rowHeight);
      const jointA = ((row * 173) % 512) / 2;
      const jointB = (jointA + size / 2) % size;
      const fromJoint = Math.min(wrappedDistance(x, jointA), wrappedDistance(x, jointB));
      if (y % rowHeight < 1 || fromJoint < 1) {
        return 0;
      }
      const grain = Math.sin((v * plankRows * 2 + valueNoise(u, v, 4, 8, 3) * 0.5 + row * 0.37) * Math.PI * 2);
      return 0.8 + 0.06 * grain + valueNoise(u, v, 48, 48, 4) * 0.04;
    }
    case "fabric": {
      // Over-under threads: the weave flips every thread, the way plain cloth does.
      const threads = 48;
      const tu = (u * threads) % 1;
      const tv = (v * threads) % 1;
      const over = (Math.floor(u * threads) + Math.floor(v * threads)) % 2 === 0;
      const ridge = over ? Math.sin(tu * Math.PI) : Math.sin(tv * Math.PI);
      return 0.35 + 0.45 * ridge + valueNoise(u, v, 32, 32, 5) * 0.2;
    }
    case "metal":
      // Brushed: fine streaks along x, almost no variation across them.
      return valueNoise(u, v, 4, 160, 6) * 0.8 + valueNoise(u, v, 96, 96, 7) * 0.2;
    case "plaster":
      return valueNoise(u, v, 8, 8, 8) * 0.5 + valueNoise(u, v, 24, 24, 9) * 0.3 + valueNoise(u, v, 64, 64, 10) * 0.2;
    case "satin":
      return valueNoise(u, v, 32, 32, 11) * 0.6 + valueNoise(u, v, 96, 96, 12) * 0.4;
  }
}

function canvas2d(): { element: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const element = document.createElement("canvas");
  element.width = size;
  element.height = size;
  const ctx = element.getContext("2d");
  if (ctx === null) {
    throw new Error("2D canvas is not available");
  }
  return { element, ctx };
}

function tiled(texture: CanvasTexture, repeat: number): CanvasTexture {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 4;
  return texture;
}

/** How bumpy each kind looks, and how often its tile repeats across a face. */
const settings: Record<SurfaceKind, { strength: number; repeat: number }> = {
  wood: { strength: 2.2, repeat: 1 },
  planks: { strength: 1.2, repeat: 1 },
  fabric: { strength: 3.0, repeat: 2 },
  metal: { strength: 1.2, repeat: 1 },
  plaster: { strength: 1.4, repeat: 3 },
  satin: { strength: 0.8, repeat: 2 },
};

/** Normal map from the height field with a Sobel-like slope at each pixel, wrapping at the edges. */
function normalMap(kind: SurfaceKind): CanvasTexture {
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      heights[y * size + x] = surfaceHeight(kind, x, y);
    }
  }
  const at = (x: number, y: number) => heights[((y + size) % size) * size + ((x + size) % size)] ?? 0;
  const { element, ctx } = canvas2d();
  const image = ctx.createImageData(size, size);
  const strength = settings[kind].strength;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const length = Math.hypot(dx, dy, 1);
      const index = (y * size + x) * 4;
      image.data[index] = Math.round(((-dx / length) * 0.5 + 0.5) * 255);
      image.data[index + 1] = Math.round(((dy / length) * 0.5 + 0.5) * 255);
      image.data[index + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255);
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new CanvasTexture(element);
  // Normal maps hold directions, not colors.
  texture.colorSpace = NoColorSpace;
  return tiled(texture, settings[kind].repeat);
}

/** A light grain tint for wood, multiplied over the base color so oak keeps its tone. */
function woodTint(): CanvasTexture {
  const { element, ctx } = canvas2d();
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const shade = 0.86 + 0.14 * surfaceHeight("wood", x, y);
      const index = (y * size + x) * 4;
      const value = Math.round(shade * 255);
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new CanvasTexture(element);
  texture.colorSpace = SRGBColorSpace;
  return tiled(texture, settings.wood.repeat);
}

export interface SurfaceMaps {
  normalMap: Texture;
  normalScale: number;
  map: Texture | null;
}

const cache = new Map<SurfaceKind, SurfaceMaps>();

export function surfaceMaps(kind: SurfaceKind): SurfaceMaps {
  let maps = cache.get(kind);
  if (maps === undefined) {
    maps = { normalMap: normalMap(kind), normalScale: 1, map: kind === "wood" ? woodTint() : null };
    cache.set(kind, maps);
  }
  return maps;
}
