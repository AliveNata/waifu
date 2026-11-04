import {
  AmbientLight,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
  type WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { aimVrHand, curlVrHand, type Finger, rigVrHand, type VrHandRig, type VrHandSide } from "../common/vr-hand.js";
import handsUrl from "../overlay/assets/vr-hands.glb?url";
import { gestureAmount, gesturePlacements, IdleGestures, mix, type Placement } from "./alyx-gestures.js";

/**
 * Alyx's own hands at the bottom of the first-person view: the same VR hands model as the
 * companion's pointer, in a dark suit sleeve with a white cuff. They are drawn in their own pass
 * after the room, so they never sink into a desk he walks up to.
 */

/** The model is a real adult's hand, in proportion with the room once it is scaled to the team. */
const handScale = 0.9;
const relaxed: Record<Finger, number> = { thumb: 0.3, index: 0.35, middle: 0.45, ring: 0.5, pinky: 0.55 };
const open: Record<Finger, number> = { thumb: 0.05, index: 0.02, middle: 0.02, ring: 0.04, pinky: 0.06 };
const suit = "#1f2433";
const cuff = "#f2f0eb";

/** How long a wave lasts, from raising the hand to lowering it again, in seconds. */
export const waveSeconds = 1.9;

const rest: Record<VrHandSide, Placement> = {
  Right: {
    palm: new Vector3(0.2, -0.25, -0.42),
    fingers: new Vector3(-0.12, 0.3, -1),
    facing: new Vector3(-0.7, -0.6, 0),
    curl: relaxed,
    roll: 0,
  },
  Left: {
    palm: new Vector3(-0.2, -0.25, -0.42),
    fingers: new Vector3(0.12, 0.3, -1),
    facing: new Vector3(0.7, -0.6, 0),
    curl: relaxed,
    roll: 0,
  },
};

/** Something carried in the right hand: held up a little in front, palm up under it, fingers round it. */
const holding: Placement = {
  palm: new Vector3(0.17, -0.2, -0.4),
  fingers: new Vector3(-0.25, 0.15, -1),
  facing: new Vector3(-0.25, 1, 0),
  curl: { thumb: 0.45, index: 0.55, middle: 0.6, ring: 0.62, pinky: 0.65 },
  roll: 0,
};

/** What the hands are doing this frame besides walking. */
export interface HandsPose {
  /** Seconds into a wave, or null. */
  wave: number | null;
  /** Carrying something in the right hand. */
  holding: boolean;
  /** A ping-pong stroke, -0.5 for the wind-up to 1 at contact; 0 when not playing. */
  swing: number;
  /** Seconds into stroking the cat, or null. */
  pet: number | null;
  /** Her back and the way down, in the view's frame, while stroking her; null keeps the old reach. */
  petAt?: { back: Vector3; down: Vector3 } | null;
}

/** His right shoulder in the view's frame: below and to the right of the eyes, a little back. */
const rightShoulder = new Vector3(0.2, -0.3, 0.05);

/** As far from the shoulder as the palm gets, an arm out. */
const armReach = 0.6;

/**
 * The stroking hand on her actual back: the arm reaches out from his right shoulder, palm down onto
 * her, sliding to and fro along the way it reaches. Out of reach, the hand stops at arm's length
 * toward her, so the arm never runs straight out of the middle of the view.
 */
export function strokeOnto(back: Vector3, down: Vector3, seconds: number): Placement {
  const up = down.clone().negate();
  const target = back.clone().addScaledVector(up, 0.03);
  const reach = target.clone().sub(rightShoulder);
  if (reach.length() > armReach) {
    reach.setLength(armReach);
  }
  // Fingers point on along the reach, kept level so the palm lies flat on her.
  const along = reach.clone().addScaledVector(up, -reach.dot(up));
  if (along.lengthSq() < 1e-6) {
    along.set(0, 0, -1);
  }
  along.normalize();
  const palm = rightShoulder
    .clone()
    .add(reach)
    .addScaledVector(along, 0.04 * Math.sin(seconds * 4.5));
  return { ...stroking, palm, fingers: along, facing: down.clone() };
}

/** How long a stroke of the cat lasts, from reaching down to taking the hand back. */
export const petSeconds = 3;

/** Reached down low in front, palm down, as over a cat's back. */
const stroking: Placement = {
  palm: new Vector3(0.08, -0.34, -0.46),
  fingers: new Vector3(-0.1, -0.3, -1),
  facing: new Vector3(0, -1, 0.1),
  curl: { thumb: 0.2, index: 0.12, middle: 0.12, ring: 0.15, pinky: 0.2 },
  roll: 0,
};

/** Raised beside the face, palm out to whoever he greets. */
const waving: Placement = {
  palm: new Vector3(0.17, -0.02, -0.45),
  fingers: new Vector3(-0.1, 1, -0.15),
  facing: new Vector3(0, 0, -1),
  curl: open,
  roll: 0,
};

/** 0..1 eased up over the first quarter of the wave and back down over the last. */
export function waveAmount(seconds: number): number {
  if (seconds < 0 || seconds > waveSeconds) {
    return 0;
  }
  const edge = waveSeconds / 4;
  const k = Math.min(1, seconds / edge, (waveSeconds - seconds) / edge);
  return k * k * (3 - 2 * k);
}

/**
 * A plain watch on the back of the wrist, just out of the cuff: a dark dial in a steel case on a
 * leather strap. `dorsal` is the back of the hand's direction in the sleeve's frame.
 */
function watch(dorsal: Vector3): Group {
  const group = new Group();
  const strap = new Mesh(
    new CylinderGeometry(0.036, 0.036, 0.014, 20, 1, true),
    new MeshStandardMaterial({ color: "#2a1d16", roughness: 0.8 }),
  );
  strap.position.y = -0.004;
  const face = new Group();
  // The dial sits on the strap, its flat side out along the back of the wrist.
  face.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dorsal);
  face.position.copy(dorsal).multiplyScalar(0.038).setY(-0.004);
  const casing = new Mesh(
    new CylinderGeometry(0.017, 0.017, 0.008, 24),
    new MeshStandardMaterial({ color: "#c9ccd2", roughness: 0.3, metalness: 0.9 }),
  );
  const dial = new Mesh(
    new CylinderGeometry(0.014, 0.014, 0.002, 24),
    new MeshStandardMaterial({ color: "#14161c", roughness: 0.4 }),
  );
  dial.position.y = 0.004;
  const hand = new Mesh(
    new CylinderGeometry(0.0012, 0.0012, 0.011, 6),
    new MeshStandardMaterial({ color: "#e8e2d4", roughness: 0.5 }),
  );
  hand.rotation.x = Math.PI / 2;
  hand.position.set(0, 0.0055, 0.004);
  face.add(casing, dial, hand);
  group.add(strap, face);
  return group;
}

/** A suit sleeve and cuff from the wrist back toward the elbow, out of the bottom of the view. */
function sleeve(rig: VrHandRig, side: VrHandSide): Group {
  const group = new Group();
  const wrist = rig.anchors.wrist.getWorldPosition(new Vector3());
  group.position.copy(wrist);
  // The sleeve's long axis (+y) runs from the wrist back up the forearm.
  group.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), rig.fingers.clone().negate());
  const cloth = new Mesh(
    new CylinderGeometry(0.043, 0.05, 0.34, 16),
    new MeshStandardMaterial({ color: suit, roughness: 0.75 }),
  );
  cloth.position.y = 0.2;
  const band = new Mesh(
    new CylinderGeometry(0.039, 0.041, 0.035, 16),
    new MeshStandardMaterial({ color: cuff, roughness: 0.6 }),
  );
  band.position.y = 0.03;
  group.add(cloth, band);
  if (side === "Left") {
    // The back of the hand, in the sleeve's own frame, is where the watch face goes.
    const dorsal = rig.palm.clone().negate().applyQuaternion(group.quaternion.clone().invert());
    dorsal.y = 0;
    group.add(watch(dorsal.normalize()));
  }
  return group;
}

export class AlyxHands {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(45, 1, 0.01, 5);
  private readonly hands: Partial<Record<VrHandSide, VrHandRig>> = {};
  private readonly key = new DirectionalLight(0xffffff, 1.8);
  private readonly fill = new AmbientLight(0xffffff, 0.9);
  private loading: Promise<void> | null = null;
  /** Whatever is in his right hand, kept on the palm. */
  private readonly held = new Group();
  /** Glancing at his watch, drumming his fingers and so on while he stands about. */
  private readonly idle = new IdleGestures(Math.random);

  constructor() {
    this.key.position.set(0.5, 1.2, 0.8);
    this.scene.add(this.key, this.fill, this.held);
  }

  /** Puts a copy of `thing` in his right hand, or empties the hand with null. */
  hold(thing: Object3D | null): void {
    this.held.clear();
    if (thing !== null) {
      // Held upright in the view, whatever way it stood on the desk.
      thing.position.set(0, 0, 0);
      thing.rotation.set(0, 0, 0);
      this.held.add(thing);
    }
  }

  /** Loads both hands once; until they are in, the view simply has no hands. */
  load(): Promise<void> {
    this.loading ??= new GLTFLoader().loadAsync(handsUrl).then((gltf) => {
      const sides: [VrHandSide, Object3D][] = [
        ["Right", gltf.scene],
        ["Left", cloneSkinned(gltf.scene)],
      ];
      for (const [side, model] of sides) {
        const rig = rigVrHand(model, side);
        rig.root.add(sleeve(rig, side));
        rig.root.scale.setScalar(handScale);
        this.scene.add(rig.root);
        this.hands[side] = rig;
      }
    });
    return this.loading;
  }

  /**
   * Poses the hands for this frame. `walked` is meters walked (for the bob), `speed` how fast,
   * `night` 0..1 to dim them with the room.
   */
  update(view: PerspectiveCamera, walked: number, speed: number, pose: HandsPose, night: number, delta: number): void {
    const { wave } = pose;
    const busy =
      speed > 0.15 || (wave !== null && wave <= waveSeconds) || pose.holding || pose.swing !== 0 || pose.pet !== null;
    const gesture = this.idle.update(delta, busy);
    const gestureTargets = gesture === null ? {} : gesturePlacements(gesture.gesture, gesture.seconds, rest);
    const gestureStrength = gesture === null ? 0 : gestureAmount(gesture.gesture, gesture.seconds) * gesture.weight;
    this.camera.fov = view.fov;
    this.camera.aspect = view.aspect;
    this.camera.updateProjectionMatrix();
    this.key.intensity = 1.8 * (1 - 0.45 * night);
    this.fill.intensity = 0.9 * (1 - 0.35 * night);
    // Two bobs per stride, stronger the faster he walks.
    const pace = Math.min(1, speed / 1.5);
    const phase = walked * 4.2;
    const raise = wave === null ? 0 : waveAmount(wave);
    for (const side of ["Right", "Left"] as const) {
      const rig = this.hands[side];
      if (rig === undefined) {
        continue;
      }
      let placement = side === "Right" && pose.holding ? holding : rest[side];
      if (side === "Right" && pose.swing !== 0) {
        // Forehand: back and out for the wind-up, forward and across through contact.
        const stroke = new Vector3(0.05 - 0.12 * pose.swing, 0.02 * pose.swing, -0.1 * Math.max(0, pose.swing));
        placement = { ...placement, palm: placement.palm.clone().add(stroke), roll: -0.3 * pose.swing };
      }
      if (side === "Right" && pose.pet !== null && pose.pet <= petSeconds) {
        // Down onto her, then long strokes from head to tail.
        const reach = Math.min(1, pose.pet / 0.4, (petSeconds - pose.pet) / 0.4);
        const along = 0.05 * Math.sin(pose.pet * 4.5);
        const down =
          pose.petAt === undefined || pose.petAt === null
            ? { ...stroking, palm: stroking.palm.clone().add(new Vector3(0, 0, along)) }
            : strokeOnto(pose.petAt.back, pose.petAt.down, pose.pet);
        placement = mix(placement, down, reach * reach * (3 - 2 * reach));
      }
      const idleTarget = gestureTargets[side];
      if (idleTarget !== undefined && gestureStrength > 0) {
        placement = mix(placement, idleTarget, gestureStrength);
      }
      if (side === "Right" && raise > 0) {
        placement = mix(placement, { ...waving, roll: 0.35 * Math.sin((wave ?? 0) * 9) }, raise);
      }
      const swing = side === "Right" ? 1 : -1;
      const bob = new Vector3(0.006 * swing * Math.sin(phase) * pace, 0.012 * Math.abs(Math.sin(phase)) * pace, 0);
      curlVrHand(rig, placement.curl);
      const turn = aimVrHand(rig, placement.fingers, placement.facing);
      const roll = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), placement.roll);
      rig.root.quaternion.copy(roll.multiply(turn));
      // Put the palm, not the model's origin, where the placement says.
      rig.root.position.set(0, 0, 0);
      rig.root.updateMatrixWorld(true);
      const palm = rig.anchors.palm.getWorldPosition(new Vector3());
      rig.root.position.copy(placement.palm.clone().add(bob).sub(palm));
      if (side === "Right") {
        // Resting on the palm, just above it.
        this.held.position
          .copy(placement.palm)
          .add(bob)
          .add(new Vector3(0, 0.035, -0.01));
        this.held.rotation.set(0, 0, placement.roll);
      }
    }
  }

  /** Draws the hands over the frame already on screen, in front of everything in it. */
  render(renderer: WebGLRenderer): void {
    if (this.hands.Right === undefined) {
      return;
    }
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = autoClear;
  }
}
