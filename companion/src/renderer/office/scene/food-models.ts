import { Group, type Material, Mesh, MeshStandardMaterial, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import appleUrl from "../assets/food/apple.glb?url";
import burgerUrl from "../assets/food/burger-cheese.glb?url";
import milkUrl from "../assets/food/carton.glb?url";
import cartonUrl from "../assets/food/carton-small.glb?url";
import cheeseBlockUrl from "../assets/food/cheese.glb?url";
import cheeseUrl from "../assets/food/cheese-cut.glb?url";
import cookieUrl from "../assets/food/cookie.glb?url";
import cookieChocolateUrl from "../assets/food/cookie-chocolate.glb?url";
import coffeeUrl from "../assets/food/cup-coffee.glb?url";
import boardUrl from "../assets/food/cutting-board-round.glb?url";
import dimSumUrl from "../assets/food/dim-sum.glb?url";
import frappeUrl from "../assets/food/frappe.glb?url";
import grapesUrl from "../assets/food/grapes.glb?url";
import iceCreamCupUrl from "../assets/food/ice-cream-cup.glb?url";
import orangeUrl from "../assets/food/orange.glb?url";
import pizzaUrl from "../assets/food/pizza.glb?url";
import pizzaBoxUrl from "../assets/food/pizza-box.glb?url";
import puddingUrl from "../assets/food/pudding.glb?url";
import sandwichUrl from "../assets/food/sandwich.glb?url";
import sausageUrl from "../assets/food/sausage-half.glb?url";
import sodaBottleUrl from "../assets/food/soda-bottle.glb?url";
import sodaUrl from "../assets/food/soda-can.glb?url";
import steamerUrl from "../assets/food/steamer.glb?url";
import tacoUrl from "../assets/food/taco.glb?url";
import waffleUrl from "../assets/food/waffle.glb?url";

/**
 * Food models from Kenney's Food Kit (CC0, www.kenney.nl), each a GLB with the kit's one color map
 * packed inside. They are loaded once before the office is built; every box on the bar and every
 * piece in a hand is a copy.
 */
const urls = {
  burger: burgerUrl,
  carton: cartonUrl,
  cheese: cheeseUrl,
  "cookie-chocolate": cookieChocolateUrl,
  cookie: cookieUrl,
  coffee: coffeeUrl,
  board: boardUrl,
  "dim-sum": dimSumUrl,
  frappe: frappeUrl,
  pizza: pizzaUrl,
  "pizza-box": pizzaBoxUrl,
  sandwich: sandwichUrl,
  sausage: sausageUrl,
  soda: sodaUrl,
  steamer: steamerUrl,
  taco: tacoUrl,
  waffle: waffleUrl,
  // The fridge's groceries.
  apple: appleUrl,
  "cheese-block": cheeseBlockUrl,
  grapes: grapesUrl,
  "ice-cream-cup": iceCreamCupUrl,
  milk: milkUrl,
  orange: orangeUrl,
  pudding: puddingUrl,
  "soda-bottle": sodaBottleUrl,
} as const;

export type FoodModelName = keyof typeof urls;

/**
 * The kit is modeled about three times life size (a soda can is 0.35 tall); this brings it to
 * real size in meters.
 */
export const kitScale = 0.35;

/**
 * The office is built at 0.73 of life size; food at its real size looks a size too big in it, so
 * the bar, the parcels and food in a hand are shrunk by this much.
 */
export const roomScale = 0.73;

const templates = new Map<FoodModelName, Object3D>();

/**
 * Every distinct material setup is one more shader to compile before the room's first frame,
 * which on software rendering costs seconds. Models from different authors bring physical
 * materials and normal, roughness, metalness and occlusion maps that the room's look does not
 * need, so each is cut down to a standard material with its color and glow textures: the
 * setups the room already compiles.
 */
export function simplifyMaterials(model: Object3D): void {
  const simpler = new Map<Material, MeshStandardMaterial>();
  const simplify = (material: Material): Material => {
    if (!(material instanceof MeshStandardMaterial)) {
      return material;
    }
    let replacement = simpler.get(material);
    if (replacement === undefined) {
      replacement = new MeshStandardMaterial({
        name: material.name,
        color: material.color,
        map: material.map,
        roughness: material.roughness,
        metalness: material.metalness,
        emissive: material.emissive,
        // Some models paint their art into the glow map (the Pac-Man cabinet), so it stays.
        emissiveMap: material.emissiveMap,
        emissiveIntensity: material.emissiveIntensity,
        transparent: material.transparent,
        opacity: material.opacity,
        alphaTest: material.alphaTest,
        side: material.side,
      });
      simpler.set(material, replacement);
      material.dispose();
    }
    return replacement;
  };
  model.traverse((part) => {
    if (part instanceof Mesh) {
      part.material = Array.isArray(part.material) ? part.material.map(simplify) : simplify(part.material);
    }
  });
}

/** Loads each GLB into `into` by name. One that fails is logged and left out, for a stand-in to take its place. */
export async function loadTemplates<Name extends string>(
  sources: Record<Name, string>,
  into: Map<Name, Object3D>,
  what: string,
): Promise<void> {
  const loader = new GLTFLoader();
  await Promise.all(
    (Object.entries(sources) as [Name, string][]).map(async ([name, url]) => {
      try {
        const gltf = await loader.loadAsync(url);
        gltf.scene.traverse((part) => {
          part.castShadow = false;
          part.receiveShadow = true;
        });
        simplifyMaterials(gltf.scene);
        into.set(name, gltf.scene);
      } catch (error) {
        console.error(`[office] ${what} model "${name}" could not be loaded`, error);
      }
    }),
  );
}

/** Loads every model. One that fails is logged and left out; its food shows as a plain stand-in. */
export function loadFoodModels(): Promise<void> {
  return loadTemplates(urls, templates, "food");
}

/** A fresh copy of a model at `scale` times the kit's size, or an empty group when it is not loaded. */
export function foodModel(name: FoodModelName, scale = kitScale): Group {
  const group = new Group();
  const template = templates.get(name);
  if (template !== undefined) {
    const copy = template.clone(true);
    copy.scale.setScalar(scale);
    group.add(copy);
  }
  return group;
}

/** The named parts of a model, such as the pizza's slices or the box's lid, in model order. */
export function partsNamed(model: Object3D, prefix: string): Object3D[] {
  const found: Object3D[] = [];
  model.traverse((part) => {
    if (part.name.startsWith(prefix)) {
      found.push(part);
    }
  });
  return found;
}
