import type { Object3D } from "three";
import bookcaseUrl from "../assets/furniture/bookcaseClosedWide.glb?url";
import booksUrl from "../assets/furniture/books.glb?url";
import cabinetTelevisionUrl from "../assets/furniture/cabinetTelevision.glb?url";
import ceilingFanUrl from "../assets/furniture/ceilingFan.glb?url";
import coatRackStandingUrl from "../assets/furniture/coatRackStanding.glb?url";
import kitchenCabinetUrl from "../assets/furniture/kitchenCabinet.glb?url";
import kitchenCoffeeMachineUrl from "../assets/furniture/kitchenCoffeeMachine.glb?url";
import kitchenFridgeLargeUrl from "../assets/furniture/kitchenFridgeLarge.glb?url";
import kitchenMicrowaveUrl from "../assets/furniture/kitchenMicrowave.glb?url";
import lampRoundFloorUrl from "../assets/furniture/lampRoundFloor.glb?url";
import loungeSofaUrl from "../assets/furniture/loungeSofa.glb?url";
import plantSmall1Url from "../assets/furniture/plantSmall1.glb?url";
import pottedPlantUrl from "../assets/furniture/pottedPlant.glb?url";
import rugDoormatUrl from "../assets/furniture/rugDoormat.glb?url";
import stoolBarUrl from "../assets/furniture/stoolBar.glb?url";
import tableCoffeeUrl from "../assets/furniture/tableCoffee.glb?url";
import toasterUrl from "../assets/furniture/toaster.glb?url";
import trashcanUrl from "../assets/furniture/trashcan.glb?url";
import { loadTemplates } from "./food-models.js";

/**
 * Furniture from Kenney's Furniture Kit (CC0, www.kenney.nl). The kit colors its parts by
 * material, so there is no texture to pack. Loaded once before the office is built.
 */
const urls = {
  bookcase: bookcaseUrl,
  books: booksUrl,
  loungeSofa: loungeSofaUrl,
  tableCoffee: tableCoffeeUrl,
  cabinetTelevision: cabinetTelevisionUrl,
  pottedPlant: pottedPlantUrl,
  plantSmall1: plantSmall1Url,
  trashcan: trashcanUrl,
  rugDoormat: rugDoormatUrl,
  stoolBar: stoolBarUrl,
  kitchenFridgeLarge: kitchenFridgeLargeUrl,
  kitchenCabinet: kitchenCabinetUrl,
  kitchenCoffeeMachine: kitchenCoffeeMachineUrl,
  kitchenMicrowave: kitchenMicrowaveUrl,
  toaster: toasterUrl,
  ceilingFan: ceilingFanUrl,
  lampRoundFloor: lampRoundFloorUrl,
  coatRackStanding: coatRackStandingUrl,
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
