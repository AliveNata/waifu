import { AmbientLight, type Camera, DirectionalLight, type Object3D, Quaternion, Scene, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { aimVrHand, curlVrHand, rigVrHand, type VrHandRig } from "../common/vr-hand.js";
import handsUrl from "./assets/vr-hands.glb?url";
import {
  gestureSpecs,
  type HandFacing,
  type HandFrame,
  type HandGesture,
  handFrame,
  holdStretch,
} from "./hand-gestures.js";

/** The model is a real adult's hand; this much smaller sits in proportion next to her face. */
const handScale = 0.42;
/** Half a palm across at that scale, for pushing her hair. */
const palmRadius = 0.04;
/** How far a stroke travels to each side, from the pat's own frames, to report it as -1 to 1. */
const strokeReach = 0.035;
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

function worldPosition(object: Object3D): Vector3 {
  return object.getWorldPosition(new Vector3());
}

/**
 * The pointer over 2B as a 3D hand: it rests open over whatever part of her the mouse is on and
 * plays the touch when she is clicked. It is drawn in its own pass over her, so it never sinks
 * into her face or hair.
 */
export class HandPointer {
  /** Drawn after her with a cleared depth buffer. */
  readonly scene = new Scene();
  private rig: VrHandRig | null = null;
  private target: Vector3 | null = null;
  private gesture: HandGesture = "open";
  private gestureStartedAt = 0;
  private stretch = 1;
  /** Where the stroking palm touches her this frame, or null when the hand is not stroking. */
  private stroking: { point: Vector3; sideways: number } | null = null;

  constructor(private readonly reducedMotion: boolean) {
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(0.6, 1.2, 1.5);
    this.scene.add(key, new AmbientLight(0xffffff, 0.9));
  }

  /** Loads the hand model. Until it is in, there is simply no hand. */
  async load(): Promise<void> {
    const gltf = await new GLTFLoader().loadAsync(handsUrl);
    const rig = rigVrHand(gltf.scene, "Right");
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

  /** The palm on her hair while patting or ruffling, for the hair to answer; null otherwise. */
  hairContact(): { point: Vector3; radius: number } | null {
    return this.stroking === null ? null : { point: this.stroking.point, radius: palmRadius };
  }

  /** Where the pat is in its sweep, -1 (screen left) to 1 (screen right), or 0 when not patting. */
  strokeSide(): number {
    return this.stroking?.sideways ?? 0;
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
    this.stroking = null;
    if (target === null) {
      return;
    }
    const spec = gestureSpecs[this.gesture];
    const elapsed = this.gesture === "open" ? now : (now - this.gestureStartedAt) / this.stretch;
    const frame: HandFrame = handFrame(this.gesture, elapsed);
    curlVrHand(rig, frame.curl);

    // Directions are written in the camera's frame; turn them into the room's.
    const view = camera.getWorldQuaternion(new Quaternion());
    const facing = facings[spec.facing];
    const turn = aimVrHand(
      rig,
      facing.fingers.clone().applyQuaternion(view),
      facing.palm.clone().applyQuaternion(view),
    );
    const roll = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1).applyQuaternion(view), frame.roll);
    rig.root.quaternion.copy(roll.multiply(turn));

    // With reduced motion the fingers still change, but the hand does not travel.
    const motion = this.reducedMotion ? 0 : 1;
    const offset = new Vector3(frame.offset.x * motion, frame.offset.y * motion, frame.offset.z * motion + standOff);
    const goal = target.clone().add(offset.clone().applyQuaternion(view));
    if (this.gesture === "pat" || this.gesture === "ruffle") {
      // Where the palm meets her: the touched spot moved with the stroke, without the stand-off.
      const along = new Vector3(frame.offset.x * motion, frame.offset.y * motion, 0).applyQuaternion(view);
      this.stroking = {
        point: target.clone().add(along),
        sideways: Math.max(-1, Math.min(1, (frame.offset.x * motion) / strokeReach)),
      };
    }
    // Put the touching point of the hand, not its root, on the spot.
    rig.root.position.set(0, 0, 0);
    rig.root.updateMatrixWorld(true);
    rig.root.position.copy(goal.sub(worldPosition(rig.anchors[spec.anchor])));
    rig.root.updateMatrixWorld(true);
  }
}
