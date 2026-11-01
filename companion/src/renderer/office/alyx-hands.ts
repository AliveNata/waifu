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

/**
 * Alyx's own hands at the bottom of the first-person view: the same VR hands model as the
 * companion's pointer, in a dark suit sleeve with a white cuff. They are drawn in their own pass
 * after the room, so they never sink into a desk he walks up to.
 */

/** The model is a real adult's hand; a little smaller keeps it in proportion with the chibi room. */
const handScale = 0.85;
const relaxed: Record<Finger, number> = { thumb: 0.3, index: 0.35, middle: 0.45, ring: 0.5, pinky: 0.55 };
const open: Record<Finger, number> = { thumb: 0.05, index: 0.02, middle: 0.02, ring: 0.04, pinky: 0.06 };
const suit = "#1f2433";
const cuff = "#f2f0eb";

/** How long a wave lasts, from raising the hand to lowering it again, in seconds. */
export const waveSeconds = 1.9;

interface Placement {
  /** Where the palm sits, in the view's frame (x right, y up, z toward the viewer). */
  palm: Vector3;
  fingers: Vector3;
  facing: Vector3;
  curl: Record<Finger, number>;
  /** Turn about the line of sight, radians. */
  roll: number;
}

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
}

/** Raised beside the face, palm out to whoever he greets. */
const waving: Placement = {
  palm: new Vector3(0.17, -0.02, -0.45),
  fingers: new Vector3(-0.1, 1, -0.15),
  facing: new Vector3(0, 0, -1),
  curl: open,
  roll: 0,
};

function mix(from: Placement, to: Placement, t: number): Placement {
  const curl = {} as Record<Finger, number>;
  for (const finger of Object.keys(from.curl) as Finger[]) {
    curl[finger] = from.curl[finger] + (to.curl[finger] - from.curl[finger]) * t;
  }
  return {
    palm: from.palm.clone().lerp(to.palm, t),
    fingers: from.fingers.clone().lerp(to.fingers, t),
    facing: from.facing.clone().lerp(to.facing, t),
    curl,
    roll: from.roll + (to.roll - from.roll) * t,
  };
}

/** 0..1 eased up over the first quarter of the wave and back down over the last. */
export function waveAmount(seconds: number): number {
  if (seconds < 0 || seconds > waveSeconds) {
    return 0;
  }
  const edge = waveSeconds / 4;
  const k = Math.min(1, seconds / edge, (waveSeconds - seconds) / edge);
  return k * k * (3 - 2 * k);
}

/** A suit sleeve and cuff from the wrist back toward the elbow, out of the bottom of the view. */
function sleeve(rig: VrHandRig): Group {
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
        rig.root.add(sleeve(rig));
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
  update(view: PerspectiveCamera, walked: number, speed: number, pose: HandsPose, night: number): void {
    const { wave } = pose;
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
