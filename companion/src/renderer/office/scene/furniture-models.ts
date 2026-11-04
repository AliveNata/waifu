import type { Object3D } from "three";
import bookcaseUrl from "../assets/furniture/bookcaseClosedWide.glb?url";
import booksUrl from "../assets/furniture/books.glb?url";
import { loadTemplates } from "./food-models.js";

/**
 * Furniture from Kenney's Furniture Kit (CC0, www.kenney.nl). The kit colors its parts by
 * material, so there is no texture to pack. Loaded once before the office is built.
 */
const urls = {
  bookcase: bookcaseUrl,
  books: booksUrl,
} as const;

export type FurnitureModelName = keyof typeof urls;

const templates = new Map<FurnitureModelName, Object3D>();

export function loadFurnitureModels(): Promise<void> {
  return loadTemplates(urls, templates, "furniture");
}

/** A fresh copy at the kit's own size, or null when it did not load, so the caller can build a stand-in. */
export function furnitureModel(name: FurnitureModelName): Object3D | null {
  return templates.get(name)?.clone(true) ?? null;
}
