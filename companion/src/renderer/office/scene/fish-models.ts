import { type AnimationClip, AnimationMixer, Box3, Group, type Object3D, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import butterflyfishUrl from "../assets/fish/butterflyfish.glb?url";
import discusUrl from "../assets/fish/discus.glb?url";
import goldfishUrl from "../assets/fish/goldfish.glb?url";
import koiUrl from "../assets/fish/koi.glb?url";
import snapperUrl from "../assets/fish/snapper.glb?url";
import { simplifyMaterials } from "./food-models.js";

/**
 * The aquarium's fish, from Sketchfab under CC-BY-4.0 (credited in docs/03-companion.md). Each
 * is drawn facing its own way; `head` turns it to face +x like the code-built fish, and `clip`
 * names its swimming loop when it has one.
 */
const species = {
  goldfish: { url: goldfishUrl, head: Math.PI / 2, clip: "Take 001" },
  koi: { url: koiUrl, head: 0, clip: "swim" },
  snapper: { url: snapperUrl, head: 0, clip: null },
  discus: { url: discusUrl, head: Math.PI, clip: null },
  butterflyfish: { url: butterflyfishUrl, head: 0, clip: null },
} as const;

export type FishSpecies = keyof typeof species;
export const fishSpecies = Object.keys(species) as FishSpecies[];

interface Loaded {
  scene: Object3D;
  clips: AnimationClip[];
}

const loaded = new Map<FishSpecies, Loaded>();

/** Loads every fish. One that fails is logged and left out; the tank then swims code-built fish. */
export async function loadFishModels(): Promise<void> {
  const loader = new GLTFLoader();
  await Promise.all(
    fishSpecies.map(async (name) => {
      try {
        const gltf = await loader.loadAsync(species[name].url);
        gltf.scene.traverse((part) => {
          part.castShadow = false;
        });
        simplifyMaterials(gltf.scene);
        loaded.set(name, { scene: gltf.scene, clips: gltf.animations });
      } catch (error) {
        console.error(`[office] fish model "${name}" could not be loaded`, error);
      }
    }),
  );
}

/** A fish copy facing +x, `length` long nose to tail, and its swim loop when it has one. */
export interface FishModel {
  root: Group;
  /** Plays the swim loop; null for a fish without one, which the tank wiggles instead. */
  mixer: AnimationMixer | null;
}

export function fishModel(name: FishSpecies, length: number): FishModel | null {
  const source = loaded.get(name);
  if (source === undefined) {
    return null;
  }
  // Skinned fish need their own skeleton per copy, or every copy would follow the first.
  const copy = cloneSkinned(source.scene);
  const turned = new Group();
  turned.rotation.y = species[name].head;
  turned.add(copy);
  turned.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(turned);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const scale = length / Math.max(size.x, 1e-6);
  const root = new Group();
  turned.position.copy(center).multiplyScalar(-1);
  const scaled = new Group();
  scaled.scale.setScalar(scale);
  scaled.add(turned);
  root.add(scaled);
  const clipName = species[name].clip;
  const clip = clipName === null ? undefined : source.clips.find((candidate) => candidate.name === clipName);
  let mixer: AnimationMixer | null = null;
  if (clip !== undefined) {
    mixer = new AnimationMixer(copy);
    mixer.clipAction(clip).play();
  }
  return { root, mixer };
}
