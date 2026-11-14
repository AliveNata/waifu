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
import { type CatPose, playMoment } from "../office-cat.js";
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
/**
 * Asleep curled up instead: the forearms fold back under the chest, and on top of the lying pose
 * both halves of her bend round to one side, the head turned and laid down along her flank and the
 * tail drawn in round her haunches. Yaws are for a curl to her left; the right mirrors them. The
 * neck turns less than the spine so its nod stays a nod: turned much further, the same pitch would
 * roll her face up to the ceiling.
 */
const tuckedForearm = 2.8;
const curlingTurns: readonly [string, number, number][] = [
  ["LowerSpine", 0.7, 0],
  ["UpperSpine", 1.0, 0],
  ["Neck", 0.6, 1.1],
  ["Head", 0.3, 0.6],
  ["TailBase", 1.0, 0],
  ["TailBaseMiddle", 1.0, 0],
  ["TailTipMiddle", 0.9, 0],
];
/** How often she sleeps curled up rather than with her head on her paws. */
const curlChance = 0.6;
/** The rig's paws and feet are IK bones under its root: each is carried on the end of its leg. */
const carriedEnds: readonly [string, string][] = [
  ["PawL", "ArmL"],
  ["PawR", "ArmR"],
  ["FootL", "HeelL"],
  ["FootR", "HeelR"],
];
/** A turn of one bone in the cat's own frame: [bone, yaw, pitch]. */
type Turn = readonly [string, number, number];
type Activity = "eat" | "groom" | "beg" | "stare";
const activities: readonly Activity[] = ["eat", "groom", "beg", "stare"];

/** Her paw tapping the fridge door: a few quick taps, then a wait. */
function tapping(time: number): number {
  return Math.sin(time * 0.8) > 0.3 ? Math.max(0, Math.sin(time * 9)) : 0;
}

/**
 * What the sitting clip has no move for, as turns on top of it at `time` seconds, parents before
 * children. Raising or lowering the chest turns the front legs with it, so the shoulders turn back
 * by as much to keep the paws where they stood.
 */
const activityTurns: Record<Activity, (time: number) => Turn[]> = {
  // Leaning down over the bowl, chewing.
  eat: (time) => [
    ["UpperSpine", 0, 0.5],
    ["UpperArmL", 0, -0.5],
    ["UpperArmR", 0, -0.5],
    ["Neck", 0, 0.5],
    ["Head", 0, 0.3 + 0.08 * Math.sin(time * 9)],
  ],
  // Washing her face: the right paw up to her cheek and stroking over it, her head licking it.
  groom: (time) => [
    ["UpperArmR", 0.3, -1.7 + 0.25 * Math.sin(time * 2.2)],
    ["ArmR", 0, -0.9],
    ["Neck", -0.2, 0.25],
    ["Head", -0.1, 0.4 + 0.12 * Math.max(0, Math.sin(time * 7))],
  ],
  // Sitting up tall at the fridge, looking up at the door and tapping it with a front paw.
  beg: (time) => [
    ["UpperSpine", 0, -0.25],
    ["UpperArmR", 0, 0.25],
    ["UpperArmL", 0, -0.85 - 0.3 * tapping(time)],
    ["Neck", 0, -0.3],
    ["Head", 0, -0.35],
  ],
  // Watching the fish, the tip of her tail twitching.
  stare: (time) => [
    ["TailTipMiddle", 0.25 * Math.sin(time * 6), 0],
    ["TailTip", 0.35 * Math.sin(time * 6 + 0.5), 0],
  ],
};
/** Seconds to ease into or out of an activity's pose. */
const activitySeconds = 0.4;

/**
 * Stretching and playing are done standing: the walk clip held at the moment all four paws are
 * down, as a fraction of the clip, with bones turned on top.
 */
const standingFrame = 0.2;
const standingPoses: ReadonlySet<CatPose> = new Set(["stretch", "play"]);
/** Seconds to ease into or out of a stretch or a game. */
const standingSeconds = 0.5;
/** The long stretch on waking: chest down to the floor, front legs out ahead, rump and tail up. */
const stretchTurns: readonly Turn[] = [
  ["LowerSpine", 0, 0.2],
  ["UpperSpine", 0, 0.8],
  ["UpperArmL", 0, -1.8],
  ["ArmL", 0, -0.2],
  ["UpperArmR", 0, -1.8],
  ["ArmR", 0, -0.2],
  ["Neck", 0, -0.7],
  ["TailBase", 0, -0.4],
];
/** Low at the front, eyes on the ball, before the pounce. */
const crouchTurns: readonly Turn[] = [
  ["UpperSpine", 0, 0.5],
  ["UpperArmL", 0, -1.2],
  ["ArmL", 0, 0.3],
  ["UpperArmR", 0, -1.2],
  ["ArmR", 0, 0.3],
  ["Neck", 0, -0.45],
  ["TailBase", 0, 0.6],
];
/** Up off the front paws, both reaching for the ball. */
const pounceTurns: readonly Turn[] = [
  ["UpperSpine", 0, -0.3],
  ["UpperArmL", 0, -2.0],
  ["UpperArmR", 0, -2.0],
  ["Neck", 0, 0.2],
  ["TailBase", 0, -0.3],
];
/** Batting the ball with her right paw, head down watching it. */
function batTurns(time: number): Turn[] {
  return [
    ["UpperSpine", 0, 0.2],
    ["UpperArmR", 0.2, -1.6 + 0.35 * Math.sin(time * 8)],
    ["ArmR", 0, -0.4],
    ["Neck", 0, 0.25],
    ["Head", 0, 0.2],
  ];
}

/** Seconds to lie down or get up, and to doze off or wake. */
const lieSeconds = 0.9;
const dozeSeconds = 1.5;
/**
 * Lying stretched out, her front paws reach a hand's width past where her chest was sitting, so she
 * settles back by that much and keeps the same patch of floor or desk. On a keyboard, set close to
 * the desk's front edge, this keeps her paws on the keys instead of out over the edge. Curled up she
 * is compact and stays where she sat.
 */
const stretchedSetBack = 0.08;

function bone(root: Object3D, prefix: string): Bone | null {
  let found: Bone | null = null;
  root.traverse((part) => {
    // The rig's names end in "_" and a number; matching up to it keeps "TailTip" off "TailTipMiddle".
    if (
      found === null &&
      (part as Bone).isBone === true &&
      (part.name === prefix || part.name.startsWith(`${prefix}_`))
    ) {
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
  private readonly curling: { bone: Bone; yaw: number; pitch: number }[];
  private readonly forearms: Bone[];
  private readonly ends: { end: Bone; leg: Bone; relative: Matrix4 }[];
  /** The same paws on the ends of the legs, measured standing (see standingFrame). */
  private readonly standingEnds: { end: Bone; leg: Bone; relative: Matrix4 }[];
  /** 0 to 1, how far into a stretch and into play she is. */
  private stretch = 0;
  private game = 0;
  /** How far the stretch lowers her lowest point, so the paws stay on the floor. */
  private stretchDrop = 0;
  /**
   * Every bone the code turns, with how it stood before this frame's turns and after them. The mixer
   * only writes a bone when the clip's value for it changes: held on one frame, or on a stretch of a
   * clip where a bone keeps still, it leaves last frame's turned bone as it was, and turning it again
   * would pile one frame's turn on the last. A bone still as it was left is set back first.
   */
  private readonly turned = new Map<Bone, { before: Quaternion; after: Quaternion }>();
  /** Her paws on the floor standing, and how far she sinks lying down, in her own space. */
  private readonly lift = new Group();
  private standingLift = 0;
  private lyingDrop = 0;
  private playing: ClipKey | null = null;
  /** When the clip last changed, on the frame clock, so the one before can be stopped once faded. */
  private switchedAt = 0;
  private lastTime: number | null = null;
  /** 0 sitting to 1 lying down, and 0 awake to 1 asleep, eased so she settles rather than snaps. */
  private lie = 0;
  private doze = 0;
  /** 0 head on paws to 1 curled up, and which way she curls: 1 to her left, -1 to her right. */
  private curl = 0;
  private curlSide = 1;
  private curls = false;
  private wasAsleep = false;
  /** How far into each activity's pose she is, 0 to 1. */
  private readonly activity: Record<Activity, number> = { eat: 0, groom: 0, beg: 0, stare: 0 };
  /** The rig's bones by name, for the activity turns. */
  private readonly bones = new Map<string, Bone | null>();

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
    this.curling = turns(curlingTurns);
    this.forearms = [bone(this.cat, "ArmL"), bone(this.cat, "ArmR")].filter((arm): arm is Bone => arm !== null);
    this.ends = carriedEnds.flatMap(([endName, legName]) => {
      const end = bone(this.cat, endName);
      const leg = bone(this.cat, legName);
      return end === null || leg === null ? [] : [{ end, leg, relative: new Matrix4() }];
    });
    this.standingEnds = this.ends.map(({ end, leg }) => ({ end, leg, relative: new Matrix4() }));
    this.standUpright();
    this.measureLying();
    this.measureStanding();
    this.noteTurnedBones();
  }

  /**
   * Measured once, standing still on the walk clip: where each paw sits on the end of its leg, and
   * how far the stretch brings her lowest point down.
   */
  private measureStanding(): void {
    const walk = this.actions.walk;
    walk.play();
    walk.time = standingFrame * walk.getClip().duration;
    this.mixer.update(0);
    this.root.updateMatrixWorld(true);
    for (const { end, leg, relative } of this.standingEnds) {
      relative.copy(leg.matrixWorld).invert().multiply(end.matrixWorld);
    }

    const stood = new Box3().setFromObject(this.cat, true).min.y;
    this.stretch = 1;
    this.turnStanding(0);
    const stretched = new Box3().setFromObject(this.cat, true).min.y;
    this.stretch = 0;
    this.stretchDrop = stretched - stood;
    walk.stop();
  }

  /** The stretch and the game at their current weights on the standing frame, paws carried along. */
  private turnStanding(time: number): void {
    const stretch = smooth(this.stretch);
    const game = smooth(this.game);
    const moment = playMoment(time);
    const sets: [readonly Turn[], number][] = [
      [stretchTurns, stretch],
      [crouchTurns, game * moment.crouch],
      [pounceTurns, game * moment.pounce],
      [batTurns(time), game * moment.bat],
      // The rump wiggling side to side, the tip of the tail twitching with it.
      [
        [
          ["LowerSpine", 0.15 * moment.wiggle, 0],
          ["TailTip", 0.4 * moment.wiggle, 0],
        ],
        game,
      ],
    ];
    for (const [turns, weight] of sets) {
      if (weight <= 0) {
        continue;
      }
      for (const [boneName, yaw, pitch] of turns) {
        const target = this.boneNamed(boneName);
        if (target !== null) {
          turnInCatFrame(target, this.root, yaw * weight, pitch * weight);
          target.updateMatrixWorld(true);
        }
      }
    }
    for (const { end, leg, relative } of this.standingEnds) {
      const parent = end.parent;
      if (parent === null) {
        continue;
      }
      spare.matrix.copy(parent.matrixWorld).invert().multiply(spare.carried.copy(leg.matrixWorld).multiply(relative));
      spare.matrix.decompose(end.position, end.quaternion, end.scale);
      end.updateMatrixWorld(true);
    }
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
    const standing = standingPoses.has(frame.pose);
    this.play(frame.pose === "walk" || standing ? "walk" : this.settle());
    if (this.playing === "walk") {
      // Her feet keep step with the ground she covers, and stop when she does; standing, they hold still.
      const strides = standing ? standingFrame : frame.walkPhase * stridesPerPhase;
      this.actions.walk.time = (strides - Math.floor(strides)) * this.actions.walk.getClip().duration;
    }
    this.stretch = ease(this.stretch, frame.pose === "stretch" ? 1 : 0, delta / standingSeconds);
    this.game = ease(this.game, frame.pose === "play" ? 1 : 0, delta / standingSeconds);
    // Down only once she is sitting; back up quickly when she sets off.
    const lying = lyingPoses.has(frame.pose) && this.playing === "sitting";
    this.lie = ease(this.lie, lying ? 1 : 0, delta / (lying ? lieSeconds : lieSeconds / 3));
    const asleep = frame.pose === "sleep";
    if (asleep && !this.wasAsleep) {
      // Each nap picks its own way of sleeping, and its own side to curl to.
      this.curls = Math.random() < curlChance;
      this.curlSide = Math.random() < 0.5 ? 1 : -1;
    }
    this.wasAsleep = asleep;
    this.doze = ease(this.doze, asleep ? 1 : 0, delta / dozeSeconds);
    this.curl = ease(this.curl, asleep && this.curls ? 1 : 0, delta / dozeSeconds);
    for (const name of activities) {
      this.activity[name] = ease(this.activity[name], frame.pose === name ? 1 : 0, delta / activitySeconds);
    }
    this.mixer.update(delta);
    this.undoStaleTurns();
    if (frame.time - this.switchedAt > fadeSeconds) {
      // A clip faded out stays scheduled at no weight; once the fade is over it is stopped, so only
      // the playing clip is left for the mixer to work out each frame.
      for (const [key, action] of Object.entries(this.actions) as [ClipKey, AnimationAction][]) {
        if (key !== this.playing && action.isScheduled()) {
          action.stop();
        }
      }
    }
    const moment = playMoment(frame.time);
    const game = smooth(this.game);
    this.lift.position.y =
      this.standingLift -
      this.lyingDrop * smooth(this.lie) -
      this.stretchDrop * smooth(this.stretch) +
      moment.lift * game;
    this.lift.position.z = -stretchedSetBack * smooth(this.lie) * (1 - smooth(this.curl)) + moment.forward * game;
    this.root.updateMatrixWorld(true);
    if (this.playing === "sitting") {
      this.turnBones(frame.time);
    } else if (this.playing === "walk" && (this.stretch > 0 || this.game > 0)) {
      this.turnStanding(frame.time);
    }
    this.pose(frame);
    for (const [target, kept] of this.turned) {
      kept.after.copy(target.quaternion);
    }
  }

  /** Sets back any turned bone the mixer left alone this frame, and notes how each stands now. */
  private undoStaleTurns(): void {
    for (const [target, kept] of this.turned) {
      if (target.quaternion.equals(kept.after)) {
        target.quaternion.copy(kept.before);
      }
      kept.before.copy(target.quaternion);
    }
  }

  /** The bones some turn of the code's touches, found once. */
  private noteTurnedBones(): void {
    const names = new Set<string>(["Neck", "Head", "ArmL", "ArmR", "LowerSpine", "TailTip"]);
    const tables: (readonly Turn[])[] = [
      lyingTurns,
      dozingTurns,
      curlingTurns,
      stretchTurns,
      crouchTurns,
      pounceTurns,
      batTurns(0),
      ...activities.map((name) => activityTurns[name](0)),
    ];
    for (const table of tables) {
      for (const [name] of table) {
        names.add(name);
      }
    }
    for (const name of names) {
      const target = this.boneNamed(name);
      if (target !== null) {
        this.turned.set(target, { before: target.quaternion.clone(), after: new Quaternion(Number.NaN) });
      }
    }
  }

  /**
   * The lying and dozing turns at their current weights on the sitting clip, with the paws carried
   * on the legs. The paws are set even when she is not lying, which puts back any channel the
   * sitting clip does not drive.
   */
  private turnBones(time = 0): void {
    for (const name of activities) {
      const weight = smooth(this.activity[name]);
      if (weight <= 0) {
        continue;
      }
      for (const [boneName, yaw, pitch] of activityTurns[name](time)) {
        const target = this.boneNamed(boneName);
        if (target !== null) {
          turnInCatFrame(target, this.root, yaw * weight, pitch * weight);
          target.updateMatrixWorld(true);
        }
      }
    }
    const lie = smooth(this.lie);
    const curl = smooth(this.curl) * lie;
    // Head on the paws only for the share of her that is not curling up.
    const doze = smooth(this.doze) * lie * (1 - smooth(this.curl));
    for (const { bone: target, yaw, pitch } of this.lying) {
      turnInCatFrame(target, this.root, yaw * lie, pitch * lie);
      target.updateMatrixWorld(true);
    }
    // Curling up, the forearms fold from along the floor to back under the chest.
    const lyingForearm = lyingTurns.find(([name]) => name === "ArmL")?.[2] ?? 0;
    for (const forearm of this.forearms) {
      turnInCatFrame(forearm, this.root, 0, (tuckedForearm - lyingForearm) * curl);
      forearm.updateMatrixWorld(true);
    }
    for (const { bone: target, yaw, pitch } of this.dozing) {
      turnInCatFrame(target, this.root, yaw * doze, pitch * doze);
      target.updateMatrixWorld(true);
    }
    // The bend comes last, on the pose already lying, so the legs go round with the body.
    for (const { bone: target, yaw, pitch } of this.curling) {
      // The sitting clip already wraps her tail round to one side. Curling the other way, the
      // mirrored turn would unwind it into a straight stick, so there the tail stays as the clip
      // has it.
      const side = target.name.startsWith("Tail") && this.curlSide < 0 ? 0 : this.curlSide;
      turnInCatFrame(target, this.root, yaw * side * curl, pitch * curl);
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

  private boneNamed(name: string): Bone | null {
    if (!this.bones.has(name)) {
      this.bones.set(name, bone(this.cat, name));
    }
    return this.bones.get(name) ?? null;
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
    this.switchedAt = this.lastTime ?? 0;
  }

  /** The head and eyes for what she is doing, which the clips do not cover. */
  private pose(frame: CatFrame): void {
    const { pose, time, petted } = frame;
    let yaw = Math.max(-0.9, Math.min(0.9, frame.look));
    let pitch = 0;
    let eyesOpen = 1;
    if (sittingPoses.has(pose)) {
      // Eating, grooming and begging move her head in turnBones, with the rest of her.
      switch (pose) {
        case "stare":
          // Following a fish back and forth.
          yaw = 0.35 * Math.sin(time * 0.9);
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
    if (pose === "stretch") {
      // Eyes screwed up with the effort of it.
      eyesOpen = 1 - 0.7 * smooth(this.stretch);
    } else if (pose === "play") {
      // Eyes on the ball, never anywhere else.
      yaw = 0;
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
