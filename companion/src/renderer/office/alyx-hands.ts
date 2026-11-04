import {
  AmbientLight,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Matrix4,
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
import { AlyxPhone } from "./alyx-phone.js";
import type { PickerView } from "./food-picker.js";

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
  /** The order app on his phone, held up in the left hand while it is open; null keeps it put away. */
  phone?: { view: PickerView; clock: string } | null;
  /** The office's time of day, for the watch on his wrist. */
  time?: { hours: number; minutes: number; seconds: number };
}

/**
 * The left hand holding the phone up in front, a little below and left of the eyes: palm behind
 * it, fingers straight up its back so none of them crosses the screen.
 */
const phoneHold: Placement = {
  palm: new Vector3(-0.04, -0.11, -0.26),
  fingers: new Vector3(0.1, 1, 0.05),
  facing: new Vector3(0.1, 0.15, 1),
  curl: { thumb: 0.02, index: 0.12, middle: 0.12, ring: 0.16, pinky: 0.2 },
  roll: 0,
};

/** Seconds to bring the phone up or put it away. */
const phoneRaiseSeconds = 0.35;

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
function watch(dorsal: Vector3): { group: Group; hands: WatchHands } {
  const group = new Group();
  const strap = new Mesh(
    new CylinderGeometry(0.036, 0.036, 0.014, 20, 1, true),
    new MeshStandardMaterial({ color: "#2a1d16", roughness: 0.8 }),
  );
  strap.position.y = -0.004;
  const face = new Group();
  // The dial sits on the strap, its flat side out along the back of the wrist, with twelve o'clock
  // toward the fingers (down the sleeve's -y) as a watch is worn.
  const toFingers = new Vector3(0, -1, 0);
  const across = new Vector3().crossVectors(dorsal, toFingers).normalize();
  face.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(across, dorsal, toFingers));
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
  // A hand on a pivot at the dial's middle, pointing at twelve (+z) until it is turned.
  const hand = (length: number, width: number, color: string, lift: number): Group => {
    const pivot = new Group();
    pivot.position.y = 0.005 + lift;
    const bar = new Mesh(
      new CylinderGeometry(width / 2, width / 2, length, 6),
      new MeshStandardMaterial({ color, roughness: 0.5 }),
    );
    bar.rotation.x = Math.PI / 2;
    bar.position.z = length / 2;
    pivot.add(bar);
    return pivot;
  };
  const hands = {
    hour: hand(0.0075, 0.0018, "#e8e2d4", 0),
    minute: hand(0.0115, 0.0012, "#e8e2d4", 0.0004),
    second: hand(0.012, 0.0006, "#b45cff", 0.0008),
  };
  face.add(casing, dial, hands.hour, hands.minute, hands.second);
  group.add(strap, face);
  return { group, hands };
}

/** The watch's three hands, turned to the office's time each frame. */
interface WatchHands {
  hour: Object3D;
  minute: Object3D;
  second: Object3D;
}

/** How far round each hand is, 0 to 1 from twelve, for a time of day. */
export function watchAngles(time: { hours: number; minutes: number; seconds: number }): {
  hour: number;
  minute: number;
  second: number;
} {
  return {
    hour: ((time.hours % 12) + time.minutes / 60) / 12,
    minute: (time.minutes + time.seconds / 60) / 60,
    second: time.seconds / 60,
  };
}

/** A suit sleeve and cuff from the wrist back toward the elbow, out of the bottom of the view. */
function sleeve(rig: VrHandRig, side: VrHandSide): { group: Group; watch: WatchHands | null } {
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
    const worn = watch(dorsal.normalize());
    group.add(worn.group);
    return { group, watch: worn.hands };
  }
  return { group, watch: null };
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
  private readonly phone = new AlyxPhone();
  /** The hands of the watch on his left wrist, once the hands have loaded. */
  private watch: WatchHands | null = null;
  /** How far up the phone is, 0 put away to 1 held up to read. */
  private phoneUp = 0;
  /** Glancing at his watch, drumming his fingers and so on while he stands about. */
  private readonly idle = new IdleGestures(Math.random);

  constructor() {
    this.key.position.set(0.5, 1.2, 0.8);
    this.phone.root.visible = false;
    this.scene.add(this.key, this.fill, this.held, this.phone.root);
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
        const cuff = sleeve(rig, side);
        rig.root.add(cuff.group);
        this.watch ??= cuff.watch;
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
    const phoneOut = pose.phone !== undefined && pose.phone !== null;
    const phoneStep = delta / phoneRaiseSeconds;
    this.phoneUp = phoneOut ? Math.min(1, this.phoneUp + phoneStep) : Math.max(0, this.phoneUp - phoneStep);
    const phoneUp = this.phoneUp * this.phoneUp * (3 - 2 * this.phoneUp);
    const busy =
      speed > 0.15 ||
      (wave !== null && wave <= waveSeconds) ||
      pose.holding ||
      pose.swing !== 0 ||
      pose.pet !== null ||
      this.phoneUp > 0;
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
      if (side === "Left" && phoneUp > 0) {
        placement = mix(placement, phoneHold, phoneUp);
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
      if (side === "Left") {
        // Clear of the palm on the eyes' side, so the hand stays behind it; hidden while put away.
        this.phone.root.visible = phoneUp > 0.05;
        this.phone.root.position
          .copy(placement.palm)
          .add(bob)
          .add(new Vector3(0.01, 0.06, 0.035));
        this.phone.root.lookAt(0, 0, 0);
      }
    }
    if (pose.phone !== undefined && pose.phone !== null) {
      this.phone.draw(pose.phone.view, pose.phone.clock);
    }
    if (this.watch !== null && pose.time !== undefined) {
      // Clockwise seen from above the dial, which is a turn the negative way about its up axis.
      const angles = watchAngles(pose.time);
      this.watch.hour.rotation.y = -angles.hour * Math.PI * 2;
      this.watch.minute.rotation.y = -angles.minute * Math.PI * 2;
      this.watch.second.rotation.y = -angles.second * Math.PI * 2;
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
