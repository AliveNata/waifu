import {
  AmbientLight,
  type Bone,
  type Camera,
  DirectionalLight,
  Group,
  Matrix4,
  type Mesh,
  type Object3D,
  Quaternion,
  Scene,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import handsUrl from "./assets/vr-hands.glb?url";
import {
  gestureSpecs,
  type HandAnchor,
  type HandFacing,
  type HandFrame,
  type HandGesture,
  handFrame,
  holdStretch,
} from "./hand-gestures.js";

type Finger = "thumb" | "index" | "middle" | "ring" | "pinky";

/** Bone name parts in the model ("J_Right_HandIndex1_029" and so on). */
const fingerNames: Record<Finger, string> = {
  thumb: "Thumb",
  index: "Index",
  middle: "Middle",
  ring: "Ring",
  pinky: "Pinky",
};

/** How far each joint folds at a full curl, base to tip, in radians. */
const jointCurl: Record<Finger, readonly [number, number, number]> = {
  thumb: [0.5, 0.6, 0.7],
  index: [1.3, 1.5, 1.0],
  middle: [1.3, 1.5, 1.0],
  ring: [1.3, 1.5, 1.0],
  pinky: [1.3, 1.5, 1.0],
};

/** The model is a real adult's hand; a bit smaller sits better next to her face. */
const handScale = 0.6;
/** The hand hovers this far in front of where it touches, toward the viewer. */
const standOff = 0.02;

/**
 * Directions of the hand in the camera's frame (x right, y up, z toward the viewer): where the
 * fingers point and where the palm faces.
 */
const facings: Record<HandFacing, { fingers: Vector3; palm: Vector3 }> = {
  // Coming in from the lower right with the back of the hand to the viewer, like a pointer.
  point: { fingers: new Vector3(-0.45, 0.85, -0.25), palm: new Vector3(0, 0, -1) },
  // Down from above her head, the back of the hand to the viewer.
  "from-above": { fingers: new Vector3(-0.3, -0.85, -0.35), palm: new Vector3(0, 0, -1) },
  // Laid on top of her head, fingers toward her far side.
  "palm-down": { fingers: new Vector3(-0.75, 0.1, -0.65), palm: new Vector3(0, -1, 0) },
  // Held up flat toward her for a high five.
  "palm-out": { fingers: new Vector3(-0.15, 1, 0), palm: new Vector3(0, 0, -1) },
};

interface FingerChain {
  joints: Bone[];
  rest: Quaternion[];
  /** Local axis each joint folds around toward the palm. */
  axis: Vector3;
}

interface HandRig {
  root: Group;
  chains: Record<Finger, FingerChain>;
  anchors: Record<HandAnchor, Object3D>;
  /** In the root's frame at rest: the fingers' direction and the palm's facing. */
  fingers: Vector3;
  palm: Vector3;
}

function worldPosition(object: Object3D): Vector3 {
  return object.getWorldPosition(new Vector3());
}

/** Rotates `joint` about `axis` (local) by `angle` on top of its rest pose. */
function fold(joint: Bone, rest: Quaternion, axis: Vector3, angle: number): void {
  joint.quaternion.copy(rest).multiply(new Quaternion().setFromAxisAngle(axis, angle));
}

/** Of the candidate axes, the one that folds the chain's tip closest to `toward`. */
function curlAxis(joints: Bone[], rest: Quaternion[], tip: Object3D, toward: Vector3, root: Object3D): Vector3 {
  const candidates = [new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)];
  let best = candidates[0] as Vector3;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const axis of candidates) {
    for (const [index, joint] of joints.entries()) {
      fold(joint, rest[index] as Quaternion, axis, 0.6);
    }
    root.updateMatrixWorld(true);
    const distance = worldPosition(tip).distanceTo(toward);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = axis;
    }
  }
  for (const [index, joint] of joints.entries()) {
    joint.quaternion.copy(rest[index] as Quaternion);
  }
  root.updateMatrixWorld(true);
  return best;
}

/**
 * Reads the right hand out of the model: its finger bones, which way each folds, and the points
 * that touch. Which way a finger folds is measured here rather than written down, so a hand
 * exported with other bone axes still curls the right way.
 */
function rigHand(model: Object3D): HandRig {
  const root = new Group();
  root.add(model);
  root.updateMatrixWorld(true);
  const bones = new Map<string, Bone>();
  model.traverse((node) => {
    if ((node as Bone).isBone === true) {
      bones.set(node.name.replace(/_\d+$/, ""), node as Bone);
    }
    if ((node as Mesh).isMesh === true) {
      // The skinned hand moves far from where its bounding sphere was measured.
      node.frustumCulled = false;
    }
  });
  const bone = (name: string): Bone => {
    const found = bones.get(name);
    if (found === undefined) {
      throw new Error(`hand model has no bone ${name}`);
    }
    return found;
  };
  // One mesh holds both hands; only the right one points at her.
  bone("J_Left").scale.setScalar(0.0001);

  const wrist = worldPosition(bone("J_Right_Hand"));
  const middleBase = worldPosition(bone("J_Right_HandMiddle1"));
  const across = worldPosition(bone("J_Right_HandIndex1")).sub(worldPosition(bone("J_Right_HandPinky1")));
  const fingers = middleBase.clone().sub(wrist).normalize();
  // The palm is the side the fingertips hang toward at rest.
  const middleTip = worldPosition(bone("J_Right_HandMiddle4"));
  const droop = middleTip.clone().sub(middleBase);
  droop.addScaledVector(fingers, -droop.dot(fingers));
  let palm = new Vector3().crossVectors(fingers, across).normalize();
  if (palm.dot(droop) < 0) {
    palm = palm.negate();
  }
  const palmCenter = wrist.clone().lerp(middleBase, 0.55).addScaledVector(palm, 0.02);

  const chains = {} as Record<Finger, FingerChain>;
  for (const finger of Object.keys(fingerNames) as Finger[]) {
    const name = `J_Right_Hand${fingerNames[finger]}`;
    const joints = [1, 2, 3].map((index) => bone(`${name}${index}`));
    const rest = joints.map((joint) => joint.quaternion.clone());
    // Fingers fold toward the palm; the thumb folds across it, toward the base of the little finger.
    const toward =
      finger === "thumb" ? worldPosition(bone("J_Right_HandPinky1")) : palmCenter.clone().addScaledVector(palm, 0.04);
    chains[finger] = { joints, rest, axis: curlAxis(joints, rest, bone(`${name}4`), toward, root) };
  }

  const palmAnchor = new Group();
  palmAnchor.position.copy(bone("J_Right_Hand").worldToLocal(palmCenter.clone()));
  bone("J_Right_Hand").add(palmAnchor);
  return {
    root,
    chains,
    anchors: { "index-tip": bone("J_Right_HandIndex4"), "middle-tip": bone("J_Right_HandMiddle4"), palm: palmAnchor },
    fingers,
    palm,
  };
}

/** A turn that takes the rest hand's fingers and palm onto the wanted ones. */
function aim(rig: HandRig, fingers: Vector3, palm: Vector3): Quaternion {
  const frame = (forward: Vector3, up: Vector3): Matrix4 => {
    const f = forward.clone().normalize();
    const p = up.clone().addScaledVector(f, -up.dot(f)).normalize();
    return new Matrix4().makeBasis(f, p, new Vector3().crossVectors(f, p));
  };
  const from = frame(rig.fingers, rig.palm);
  const to = frame(fingers, palm);
  return new Quaternion().setFromRotationMatrix(to.multiply(from.transpose()));
}

/**
 * The pointer over 2B as a 3D hand: it rests open over whatever part of her the mouse is on and
 * plays the touch when she is clicked. It is drawn in its own pass over her, so it never sinks
 * into her face or hair.
 */
export class HandPointer {
  /** Drawn after her with a cleared depth buffer. */
  readonly scene = new Scene();
  private rig: HandRig | null = null;
  private target: Vector3 | null = null;
  private gesture: HandGesture = "open";
  private gestureStartedAt = 0;
  private stretch = 1;

  constructor(private readonly reducedMotion: boolean) {
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(0.6, 1.2, 1.5);
    this.scene.add(key, new AmbientLight(0xffffff, 0.9));
  }

  /** Loads the hand model. Until it is in, there is simply no hand. */
  async load(): Promise<void> {
    const gltf = await new GLTFLoader().loadAsync(handsUrl);
    const rig = rigHand(gltf.scene);
    rig.root.scale.setScalar(handScale);
    rig.root.visible = false;
    this.scene.add(rig.root);
    this.rig = rig;
  }

  /** Over her at `point` (world), or off her with null. A touch in progress stays where it started. */
  hover(point: Vector3 | null, now: number): void {
    if (this.playing(now)) {
      return;
    }
    this.target = point;
  }

  /** Plays a touch at `point`; a held press keeps a stroke going longer. */
  touch(point: Vector3, gesture: Exclude<HandGesture, "open">, held: boolean, now: number): void {
    this.target = point;
    this.gesture = gesture;
    this.gestureStartedAt = now;
    this.stretch = held && (gesture === "pat" || gesture === "ruffle") ? holdStretch : 1;
  }

  /** The model is in, so the page can hide the system pointer over her. */
  get ready(): boolean {
    return this.rig !== null;
  }

  /** True while a touch is still playing, so the page keeps the system pointer hidden. */
  playing(now: number): boolean {
    return this.gesture !== "open" && now - this.gestureStartedAt < gestureSpecs[this.gesture].seconds * this.stretch;
  }

  update(camera: Camera, now: number): void {
    const rig = this.rig;
    if (rig === null) {
      return;
    }
    if (!this.playing(now)) {
      this.gesture = "open";
    }
    const target = this.target;
    rig.root.visible = target !== null;
    if (target === null) {
      return;
    }
    const spec = gestureSpecs[this.gesture];
    const elapsed = this.gesture === "open" ? now : (now - this.gestureStartedAt) / this.stretch;
    const frame: HandFrame = handFrame(this.gesture, elapsed);
    for (const finger of Object.keys(rig.chains) as Finger[]) {
      const chain = rig.chains[finger];
      chain.joints.forEach((joint, index) => {
        fold(joint, chain.rest[index] as Quaternion, chain.axis, frame.curl[finger] * (jointCurl[finger][index] ?? 0));
      });
    }

    // Directions are written in the camera's frame; turn them into the room's.
    const view = camera.getWorldQuaternion(new Quaternion());
    const facing = facings[spec.facing];
    const turn = aim(rig, facing.fingers.clone().applyQuaternion(view), facing.palm.clone().applyQuaternion(view));
    const roll = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1).applyQuaternion(view), frame.roll);
    rig.root.quaternion.copy(roll.multiply(turn));

    // With reduced motion the fingers still change, but the hand does not travel.
    const motion = this.reducedMotion ? 0 : 1;
    const offset = new Vector3(frame.offset.x * motion, frame.offset.y * motion, frame.offset.z * motion + standOff);
    const goal = target.clone().add(offset.applyQuaternion(view));
    // Put the touching point of the hand, not its root, on the spot.
    rig.root.position.set(0, 0, 0);
    rig.root.updateMatrixWorld(true);
    rig.root.position.copy(goal.sub(worldPosition(rig.anchors[spec.anchor])));
    rig.root.updateMatrixWorld(true);
  }
}
