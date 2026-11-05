import type { Object3D } from "three";
import arcadePacmanUrl from "../assets/furniture/arcadePacman.glb?url";
import bearUrl from "../assets/furniture/bear.glb?url";
import benchCushionLowUrl from "../assets/furniture/benchCushionLow.glb?url";
import bookcaseUrl from "../assets/furniture/bookcaseClosedWide.glb?url";
import bookcaseOpenLowUrl from "../assets/furniture/bookcaseOpenLow.glb?url";
import booksUrl from "../assets/furniture/books.glb?url";
import cabinetTelevisionUrl from "../assets/furniture/cabinetTelevision.glb?url";
import cameraTripodUrl from "../assets/furniture/cameraTripod.glb?url";
import coatRackStandingUrl from "../assets/furniture/coatRackStanding.glb?url";
import gamingLaptopUrl from "../assets/furniture/gamingLaptop.glb?url";
import kitchenCabinetUrl from "../assets/furniture/kitchenCabinet.glb?url";
import kitchenCoffeeMachineUrl from "../assets/furniture/kitchenCoffeeMachine.glb?url";
import kitchenFridgeLargeUrl from "../assets/furniture/kitchenFridgeLarge.glb?url";
import lampRoundFloorUrl from "../assets/furniture/lampRoundFloor.glb?url";
import laptopUrl from "../assets/furniture/laptop.glb?url";
import loungeChairUrl from "../assets/furniture/loungeChair.glb?url";
import loungeSofaUrl from "../assets/furniture/loungeSofa.glb?url";
import mouseM310Url from "../assets/furniture/mouseM310.glb?url";
import officeChairUrl from "../assets/furniture/officeChair.glb?url";
import pcFuturisticUrl from "../assets/furniture/pcFuturistic.glb?url";
import pcGamingUrl from "../assets/furniture/pcGaming.glb?url";
import pcMonitorsUrl from "../assets/furniture/pcMonitors.glb?url";
import pingpongUrl from "../assets/furniture/pingpong.glb?url";
import plantSmall1Url from "../assets/furniture/plantSmall1.glb?url";
import pottedPlantUrl from "../assets/furniture/pottedPlant.glb?url";
import printerUrl from "../assets/furniture/printer.glb?url";
import radioUrl from "../assets/furniture/radio.glb?url";
import ringLightUrl from "../assets/furniture/ringLight.glb?url";
import roseUrl from "../assets/furniture/rose.glb?url";
import rugDoormatUrl from "../assets/furniture/rugDoormat.glb?url";
import serverRackUrl from "../assets/furniture/serverRack.glb?url";
import sideTableUrl from "../assets/furniture/sideTable.glb?url";
import speakerSmallUrl from "../assets/furniture/speakerSmall.glb?url";
import stoolBarUrl from "../assets/furniture/stoolBar.glb?url";
import tableCoffeeUrl from "../assets/furniture/tableCoffee.glb?url";
import televisionModernUrl from "../assets/furniture/televisionModern.glb?url";
import toasterUrl from "../assets/furniture/toaster.glb?url";
import treadmillUrl from "../assets/furniture/treadmill.glb?url";
import { loadTemplates } from "./food-models.js";

/**
 * Furniture from Kenney's Furniture Kit (CC0, www.kenney.nl). The kit colors its parts by
 * material, so there is no texture to pack. Loaded once before the office is built.
 */
const urls = {
  bookcase: bookcaseUrl,
  books: booksUrl,
  loungeChair: loungeChairUrl,
  sideTable: sideTableUrl,
  bookcaseOpenLow: bookcaseOpenLowUrl,
  bear: bearUrl,
  radio: radioUrl,
  // Not Kenney: a rose by M Smith Jonn from Poly Pizza, credited in rose.CREDIT.txt.
  rose: roseUrl,
  // From Sketchfab, CC-BY-4.0: credited in docs/03-companion.md.
  officeChair: officeChairUrl,
  mouseM310: mouseM310Url,
  laptop: laptopUrl,
  printer: printerUrl,
  pcMonitors: pcMonitorsUrl,
  pcGaming: pcGamingUrl,
  pcFuturistic: pcFuturisticUrl,
  arcadePacman: arcadePacmanUrl,
  treadmill: treadmillUrl,
  pingpong: pingpongUrl,
  serverRack: serverRackUrl,
  ringLight: ringLightUrl,
  cameraTripod: cameraTripodUrl,
  // Kenney Furniture Kit, CC0.
  televisionModern: televisionModernUrl,
  speakerSmall: speakerSmallUrl,
  benchCushionLow: benchCushionLowUrl,
  gamingLaptop: gamingLaptopUrl,
  loungeSofa: loungeSofaUrl,
  tableCoffee: tableCoffeeUrl,
  cabinetTelevision: cabinetTelevisionUrl,
  pottedPlant: pottedPlantUrl,
  plantSmall1: plantSmall1Url,
  rugDoormat: rugDoormatUrl,
  stoolBar: stoolBarUrl,
  kitchenFridgeLarge: kitchenFridgeLargeUrl,
  kitchenCabinet: kitchenCabinetUrl,
  kitchenCoffeeMachine: kitchenCoffeeMachineUrl,
  toaster: toasterUrl,
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
