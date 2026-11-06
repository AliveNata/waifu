import {
  type AnimationAction,
  type AnimationClip,
  AnimationMixer,
  type Bone,
  Box3,
  Euler,
  Group,
  LoopOnce,
  Mesh,
  type Object3D,
  Quaternion,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import somaliCatUrl from "../assets/cat/somali-cat.glb?url";
import type { CatPose } from "../office-cat.js";
import type { CatFrame } from "./cat.js";
import { simplifyMaterials } from "./food-models.js";

/**
 * Mochi as the "Somali Cat Animated" model by DreamNoms (Sketchfab, CC-BY-4.0, credited in
 * docs/03-companion.md). It brings a walk, sitting down, sitting and standing up. Lying down,
 * sleeping, eating and grooming have no clip of their own, so they are the sitting clip with the
 * head turned and the eyes closed by hand.
 */
interface Loaded {
  scene: Object3D;
  clips: AnimationClip[];
}

let loaded: Loaded | null = null;

/** Loads the cat. On a failure it is logged and the office keeps the code-built cat. */
export async function loadCatModel(): Promise<void> {
  try {
    const gltf = await new GLTFLoader().loadAsync(somaliCatUrl);
    simplifyMaterials(gltf.scene);
    loaded = { scene: gltf.scene, clips: gltf.animations };
  } catch (error) {
    console.error("[office] the cat model could not be loaded; Mochi stays code-built", error);
  }
}

/** Nose to rump, the same as the code-built cat at the office's 0.73 scale. */
const bodyLength = 0.3;
/** One walk clip is one stride; the code's walk phase runs 2.5 strides a clip at Mochi's speed. */
const stridesPerPhase = 0.6 / (Math.PI * 2);
const fadeSeconds = 0.3;

const clipNames = {
  walk: "WalkClean",
  sitDown: "SitDown",
  sitting: "SittingIdle",
} as const;

type ClipKey = keyof typeof clipNames;

const sittingPoses: ReadonlySet<CatPose> = new Set(["sit", "beg", "stare", "groom", "eat", "loaf", "sleep"]);

function bone(root: Object3D, prefix: string): Bone | null {
  let found: Bone | null = null;
  root.traverse((part) => {
    if (found === null && (part as Bone).isBone === true && part.name.startsWith(prefix)) {
      found = part as Bone;
    }
  });
  return found;
}

const spare = {
  extra: new Quaternion(),
  root: new Quaternion(),
  rootInverse: new Quaternion(),
  parent: new Quaternion(),
  world: new Quaternion(),
  euler: new Euler(0, 0, 0, "YXZ"),
};

/**
 * Turns `target` by `yaw` and `pitch` in the cat's own frame (+z ahead, +y up) on top of whatever
 * the clip set, so the same numbers work whatever way the rig's bones point.
 */
function turnInCatFrame(target: Bone, cat: Object3D, yaw: number, pitch: number): void {
  const parent = target.parent;
  if (parent === null || (yaw === 0 && pitch === 0)) {
    return;
  }
  spare.euler.set(pitch, yaw, 0);
  spare.extra.setFromEuler(spare.euler);
  cat.getWorldQuaternion(spare.root);
  spare.rootInverse.copy(spare.root).invert();
  // The turn in world space, then the bone's new world rotation, then back into its parent's space.
  spare.extra.premultiply(spare.root).multiply(spare.rootInverse);
  target.getWorldQuaternion(spare.world).premultiply(spare.extra);
  parent.getWorldQuaternion(spare.parent).invert();
  target.quaternion.copy(spare.parent.multiply(spare.world));
}

/** The skinned Mochi: plays the clips that fit her pose and turns her head and eyes on top. */
export class ModelCat {
  readonly root = new Group();
  private readonly cat: Object3D;
  private readonly mixer: AnimationMixer;
  private readonly actions: Record<ClipKey, AnimationAction>;
  private readonly neck: Bone | null;
  private readonly head: Bone | null;
  private readonly eyes: Bone[];
  private playing: ClipKey | null = null;
  private lastTime: number | null = null;

  private constructor(source: Loaded) {
    this.cat = cloneSkinned(source.scene);
    this.cat.traverse((part) => {
      if (part instanceof Mesh) {
        part.castShadow = true;
        part.receiveShadow = true;
        // The rig's bind-pose bounds do not cover the sitting clip; the cat is small enough to
        // always draw.
        part.frustumCulled = false;
      }
    });
    this.mixer = new AnimationMixer(this.cat);
    const action = (key: ClipKey): AnimationAction => {
      const clip = source.clips.find((candidate) => candidate.name === clipNames[key]);
      if (clip === undefined) {
        throw new Error(`The cat model has no "${clipNames[key]}" clip`);
      }
      return this.mixer.clipAction(clip);
    };
    this.actions = { walk: action("walk"), sitDown: action("sitDown"), sitting: action("sitting") };
    this.actions.sitDown.setLoop(LoopOnce, 1);
    this.actions.sitDown.clampWhenFinished = true;
    this.neck = bone(this.cat, "Neck");
    this.head = bone(this.cat, "Head");
    this.eyes = [bone(this.cat, "Eye.L"), bone(this.cat, "Eye.R")].filter((eye): eye is Bone => eye !== null);
    this.standUpright();
  }

  /** A copy of the loaded cat, or null when the model did not load. */
  static create(): ModelCat | null {
    return loaded === null ? null : new ModelCat(loaded);
  }

  /** Turns her to face +z, scales her to Mochi's length and stands her paws on the floor. */
  private standUpright(): void {
    const turned = new Group();
    turned.add(this.cat);
    const scaled = new Group();
    scaled.add(turned);
    this.root.add(scaled);
    this.actions.walk.play();
    this.mixer.update(0);
    this.root.updateMatrixWorld(true);
    const butt = bone(this.cat, "Butt");
    if (this.head !== null && butt !== null) {
      const ahead = this.head.getWorldPosition(new Vector3()).sub(butt.getWorldPosition(new Vector3()));
      turned.rotation.y = -Math.atan2(ahead.x, ahead.z);
    }
    this.root.updateMatrixWorld(true);
    // The body is the biggest mesh; the tail, eyes and whiskers are separate ones, and the tail
    // would stretch her length.
    let body: Object3D = this.cat;
    let most = 0;
    this.cat.traverse((part) => {
      const count = part instanceof Mesh ? part.geometry.getAttribute("position").count : 0;
      if (count > most) {
        most = count;
        body = part;
      }
    });
    const bounds = new Box3().setFromObject(body, true);
    const length = bounds.max.z - bounds.min.z;
    scaled.scale.setScalar(bodyLength / Math.max(length, 1e-6));
    scaled.position.y = -bounds.min.y * scaled.scale.y;
    this.actions.walk.stop();
  }

  update(frame: CatFrame): void {
    const delta = this.lastTime === null ? 0 : Math.max(0, frame.time - this.lastTime);
    this.lastTime = frame.time;
    this.play(frame.pose === "walk" ? "walk" : this.settle());
    if (this.playing === "walk") {
      // Her feet keep step with the ground she covers, and stop when she does.
      const strides = frame.walkPhase * stridesPerPhase;
      this.actions.walk.time = (strides - Math.floor(strides)) * this.actions.walk.getClip().duration;
    }
    this.mixer.update(delta);
    this.root.updateMatrixWorld(true);
    this.pose(frame);
  }

  /** Sitting: the sit-down once when she has just stopped, then the sitting loop. */
  private settle(): ClipKey {
    if (this.playing === "walk" || this.playing === null) {
      return this.playing === null ? "sitting" : "sitDown";
    }
    if (this.playing === "sitDown") {
      const action = this.actions.sitDown;
      return action.time >= action.getClip().duration - fadeSeconds ? "sitting" : "sitDown";
    }
    return "sitting";
  }

  private play(key: ClipKey): void {
    if (key === this.playing) {
      return;
    }
    const next = this.actions[key];
    next.reset().play();
    const previous = this.playing === null ? null : this.actions[this.playing];
    if (previous !== null) {
      next.crossFadeFrom(previous, fadeSeconds, false);
    }
    this.playing = key;
  }

  /** The head and eyes for what she is doing, which the clips do not cover. */
  private pose(frame: CatFrame): void {
    const { pose, time, petted } = frame;
    let yaw = Math.max(-0.9, Math.min(0.9, frame.look));
    let pitch = 0;
    let eyesOpen = 1;
    if (sittingPoses.has(pose)) {
      switch (pose) {
        case "beg":
          pitch = -0.45;
          break;
        case "stare":
          // Following a fish back and forth.
          yaw = 0.35 * Math.sin(time * 0.9);
          break;
        case "eat":
          // Head down in the bowl, chewing.
          pitch = 0.75 + 0.08 * Math.sin(time * 9);
          break;
        case "groom":
          // Head down to the side, licking.
          yaw = 0.6;
          pitch = 0.55 + 0.12 * Math.max(0, Math.sin(time * 7));
          break;
        case "sleep":
          yaw = 0.4;
          pitch = 0.6;
          eyesOpen = 0;
          break;
        case "loaf":
          pitch = 0.2;
          eyesOpen = 0.45 + 0.55 * (Math.sin(time * 0.3) > 0.7 ? 1 : 0);
          break;
        default:
          break;
      }
    }
    if (petted > 0) {
      // Pushing up into the hand, eyes shut.
      pitch -= 0.35 * petted;
      eyesOpen *= 1 - petted;
    }
    // Shared between the neck and the head, so the turn bends rather than snaps at one joint.
    for (const joint of [this.neck, this.head]) {
      if (joint !== null) {
        turnInCatFrame(joint, this.root, yaw / 2, pitch / 2);
        joint.updateMatrixWorld(true);
      }
    }
    for (const eye of this.eyes) {
      eye.scale.y = Math.max(0.12, eyesOpen);
    }
  }
}
