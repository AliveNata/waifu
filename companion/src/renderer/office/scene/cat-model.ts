import {
  type AnimationAction,
  type AnimationClip,
  AnimationMixer,
  type Bone,
  Box3,
  Euler,
  Group,
  LoopOnce,
  Matrix4,
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
 * sleeping, eating and grooming have no clip of their own: they are the sitting clip with bones
 * turned and the eyes closed by hand.
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
const lyingPoses: ReadonlySet<CatPose> = new Set(["loaf", "sleep"]);

/**
 * Lying down from sitting, as cats do: the haunches stay put and the hind legs folded under them,
 * the chest comes down to the floor, the front legs stretch forward along it and the neck lifts the
 * head level again. [yaw, pitch] in the cat's own frame, parents before children.
 */
const lyingTurns: readonly [string, number, number][] = [
  ["UpperSpine", 0, 0.8],
  ["Neck", 0, -0.6],
  ["UpperArmL", 0, -1.9],
  ["ArmL", 0, -0.1],
  ["UpperArmR", 0, -1.9],
  ["ArmR", 0, -0.1],
];
/** Asleep, the head drops onto the front paws, turned a little to one side. */
const dozingTurns: readonly [string, number, number][] = [
  ["Neck", 0.25, 0.7],
  ["Head", 0.15, 0.45],
];
/** The rig's paws and feet are IK bones under its root: each is carried on the end of its leg. */
const carriedEnds: readonly [string, string][] = [
  ["PawL", "ArmL"],
  ["PawR", "ArmR"],
  ["FootL", "HeelL"],
  ["FootR", "HeelR"],
];
/** Seconds to lie down or get up, and to doze off or wake. */
const lieSeconds = 0.9;
const dozeSeconds = 1.5;

function bone(root: Object3D, prefix: string): Bone | null {
  let found: Bone | null = null;
  root.traverse((part) => {
    if (found === null && (part as Bone).isBone === true && part.name.startsWith(prefix)) {
      found = part as Bone;
    }
  });
  return found;
}

/** Moves `from` toward `to` by at most `step`, for weights that ease between 0 and 1. */
function ease(from: number, to: number, step: number): number {
  return from < to ? Math.min(to, from + step) : Math.max(to, from - step);
}

/** Slow at both ends, so a weight eased in a straight line starts and settles gently. */
function smooth(weight: number): number {
  return weight * weight * (3 - 2 * weight);
}

const spare = {
  matrix: new Matrix4(),
  carried: new Matrix4(),
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
  private readonly lying: { bone: Bone; yaw: number; pitch: number }[];
  private readonly dozing: { bone: Bone; yaw: number; pitch: number }[];
  private readonly ends: { end: Bone; leg: Bone; relative: Matrix4 }[];
  /** Her paws on the floor standing, and how far she sinks lying down, in her own space. */
  private readonly lift = new Group();
  private standingLift = 0;
  private lyingDrop = 0;
  private playing: ClipKey | null = null;
  private lastTime: number | null = null;
  /** 0 sitting to 1 lying down, and 0 awake to 1 asleep, eased so she settles rather than snaps. */
  private lie = 0;
  private doze = 0;

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
    // The loader drops the dots from the rig's names: "Eye.L" arrives as "EyeL".
    this.eyes = [bone(this.cat, "EyeL"), bone(this.cat, "EyeR")].filter((eye): eye is Bone => eye !== null);
    const turns = (list: readonly [string, number, number][]) =>
      list.flatMap(([name, yaw, pitch]) => {
        const found = bone(this.cat, name);
        return found === null ? [] : [{ bone: found, yaw, pitch }];
      });
    this.lying = turns(lyingTurns);
    this.dozing = turns(dozingTurns);
    this.ends = carriedEnds.flatMap(([endName, legName]) => {
      const end = bone(this.cat, endName);
      const leg = bone(this.cat, legName);
      return end === null || leg === null ? [] : [{ end, leg, relative: new Matrix4() }];
    });
    this.standUpright();
    this.measureLying();
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
    this.lift.add(scaled);
    this.root.add(this.lift);
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
    this.standingLift = -bounds.min.y * scaled.scale.y;
    this.lift.position.y = this.standingLift;
    this.actions.walk.stop();
  }

  /**
   * Measured once on the sitting clip: where each paw sits on the end of its leg, and how far her
   * lowest point drops between sitting and lying, so lying she rests on the floor instead of
   * hovering over it.
   */
  private measureLying(): void {
    const sitting = this.actions.sitting;
    sitting.play();
    this.mixer.update(0);
    this.root.updateMatrixWorld(true);
    // Taken once and kept: the sitting clip leaves some of the paws' channels alone, so a paw
    // measured again each frame would carry the last frame's turn and drift further every frame.
    for (const { end, leg, relative } of this.ends) {
      relative.copy(leg.matrixWorld).invert().multiply(end.matrixWorld);
    }
    const sat = new Box3().setFromObject(this.cat, true).min.y;
    this.lie = 1;
    this.turnBones();
    const lay = new Box3().setFromObject(this.cat, true).min.y;
    this.lie = 0;
    this.lyingDrop = Math.max(0, lay - sat);
    sitting.stop();
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
    // Down only once she is sitting; back up quickly when she sets off.
    const lying = lyingPoses.has(frame.pose) && this.playing === "sitting";
    this.lie = ease(this.lie, lying ? 1 : 0, delta / (lying ? lieSeconds : lieSeconds / 3));
    this.doze = ease(this.doze, frame.pose === "sleep" ? 1 : 0, delta / dozeSeconds);
    this.mixer.update(delta);
    this.lift.position.y = this.standingLift - this.lyingDrop * smooth(this.lie);
    this.root.updateMatrixWorld(true);
    if (this.playing === "sitting") {
      this.turnBones();
    }
    this.pose(frame);
  }

  /**
   * The lying and dozing turns at their current weights on the sitting clip, with the paws carried
   * on the legs. The paws are set even when she is not lying, which puts back any channel the
   * sitting clip does not drive.
   */
  private turnBones(): void {
    const lie = smooth(this.lie);
    const doze = smooth(this.doze) * lie;
    for (const { bone: target, yaw, pitch } of this.lying) {
      turnInCatFrame(target, this.root, yaw * lie, pitch * lie);
      target.updateMatrixWorld(true);
    }
    for (const { bone: target, yaw, pitch } of this.dozing) {
      turnInCatFrame(target, this.root, yaw * doze, pitch * doze);
      target.updateMatrixWorld(true);
    }
    for (const { end, leg, relative } of this.ends) {
      const parent = end.parent;
      if (parent === null) {
        continue;
      }
      spare.matrix.copy(parent.matrixWorld).invert().multiply(spare.carried.copy(leg.matrixWorld).multiply(relative));
      spare.matrix.decompose(end.position, end.quaternion, end.scale);
      end.updateMatrixWorld(true);
    }
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
          // The head is down on the paws already (turnBones); the eyes close as she dozes off.
          eyesOpen = 1 - smooth(this.doze);
          break;
        case "loaf":
          // Lying awake, eyes half shut, now and then opening wide.
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
      // The rig's eyes close along their z.
      eye.scale.z = Math.max(0.12, eyesOpen);
    }
  }
}
