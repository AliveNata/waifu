import type { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";
import {
  DirectionalLight,
  type Material,
  type Mesh,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Timer,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import type { CompanionFace, CompanionPose } from "../../shared/companion-pose.js";
import type { CursorOffset } from "../../shared/protocol.js";
import { idleReaction, type Reaction } from "../../shared/reaction.js";
import {
  BlinkScheduler,
  type ExpressionWeights,
  expressionTargetsForMood,
  stepExpressionWeights,
} from "../common/expressions.js";
import type { Stage } from "../common/page.js";
import { addRotation, PoseApplier, vrmPoseTarget } from "../common/pose.js";
import { updateVrmStable } from "../common/vrm-update.js";
import { type Blush, createBlush } from "./blush.js";
import { HairTouch } from "./hair-touch.js";
import { gestureForZone } from "./hand-gestures.js";
import { HandPointer } from "./hand-pointer.js";
import { FidgetScheduler, fidgetFace } from "./idle-fidgets.js";
import { cursorAim, overlayPose } from "./overlay-pose.js";
import { commandFace, envelope, poseFocusShift, poseHoldSeconds, poseNeedsWideFrame } from "./pose-bones.js";
import { createTongue, type Tongue } from "./tongue.js";
import { reactionFace, type TouchKind, TouchMood, type TouchReaction } from "./touch-reactions.js";
import { classifyTouch, type TouchSide, type TouchZone } from "./touch-zones.js";

/** Vertical span of the close-up in meters: top of the hair down to mid chest. */
const framedHeight = 0.62;
/** Pulled back for poses that use her arms, so her hands are in the picture. */
const wideFramedHeight = 1.05;
const fieldOfViewDegrees = 22;
/** How fast the framing follows, per second: slow enough to read as a camera move, not a cut. */
const framingRate = 2.5;

/** Bone pairs whose segment stands for a body part when finding what a click hit. */
const boneSegments: readonly [VRMHumanBoneName, VRMHumanBoneName | null][] = [
  ["head", null],
  ["neck", "head"],
  ["upperChest", "neck"],
  ["chest", "upperChest"],
  ["spine", "chest"],
  ["leftShoulder", "leftUpperArm"],
  ["rightShoulder", "rightUpperArm"],
  ["leftUpperArm", "leftLowerArm"],
  ["rightUpperArm", "rightLowerArm"],
  ["leftLowerArm", "leftHand"],
  ["rightLowerArm", "rightHand"],
  ["leftHand", null],
  ["rightHand", null],
];

interface ActiveTouch {
  reaction: TouchReaction;
  startedAt: number;
}

interface ActiveCommand {
  pose: CompanionPose | null;
  face: CompanionFace | null;
  /** Null until the first frame with a model, so a pose asked for during loading still plays in full. */
  startedAt: number | null;
}

function distanceToSegment(point: Vector3, a: Vector3, b: Vector3): number {
  const ab = b.clone().sub(a);
  const t = Math.max(0, Math.min(1, point.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 1e-9)));
  return point.distanceTo(a.clone().add(ab.multiplyScalar(t)));
}

function materialName(mesh: Mesh, materialIndex: number | undefined): string {
  const material: Material | Material[] = mesh.material;
  const picked = Array.isArray(material) ? material[materialIndex ?? 0] : material;
  return picked?.name ?? "";
}

export class OverlayStage implements Stage {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(fieldOfViewDegrees, 1, 0.05, 20);
  private readonly lookTarget = new Object3D();
  private readonly timer = new Timer();
  private readonly poseApplier = new PoseApplier();
  private readonly blink = new BlinkScheduler();
  private readonly raycaster = new Raycaster();
  private readonly touchMood = new TouchMood();

  private vrm: VRM | null = null;
  private tongue: Tongue | null = null;
  private blush: Blush | null = null;
  private hairTouch: HairTouch | null = null;
  private readonly hand = new HandPointer(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  private focus = new Vector3(0, 1.3, 0);
  private framing = framedHeight;
  /** Kept after a pose ends, so the camera eases back along the same line it pulled out on. */
  private focusShift = -0.2;
  private reaction: Reaction = idleReaction(Date.now());
  private moodStartedAt = 0;
  /** Picked each time a mood starts, so she holds a repeated mood a little differently. */
  private moodVariant = 0;
  private readonly fidgets = new FidgetScheduler(0);
  private aim = { yaw: 0, pitch: 0 };
  private expressionWeights: ExpressionWeights = {};
  private elapsed = 0;
  private touch: ActiveTouch | null = null;
  private command: ActiveCommand | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onFrame: () => void,
  ) {
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Two passes a frame, her and then the hand, so clearing is done by hand.
    this.renderer.autoClear = false;

    const keyLight = new DirectionalLight(0xffffff, Math.PI);
    keyLight.position.set(0.6, 1.2, 1.5);
    this.scene.add(keyLight, this.lookTarget);
    // The page keeps the system pointer until the hand is in, so a failed load leaves a usable pointer.
    this.hand.load().catch((error: unknown) => {
      console.error("[overlay] could not load the pointer hand", error);
    });

    window.addEventListener("resize", () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop((timestamp) => this.frame(timestamp));
  }

  setCursor(offset: CursorOffset): void {
    this.aim = cursorAim(offset.dx, offset.dy);
  }

  setModel(vrm: VRM | null): void {
    if (this.vrm !== null) {
      this.scene.remove(this.vrm.scene);
    }
    this.tongue?.dispose();
    this.tongue = null;
    this.blush?.dispose();
    this.blush = null;
    this.hairTouch?.dispose();
    this.hairTouch = null;
    this.vrm = vrm;
    this.poseApplier.reset();
    this.expressionWeights = {};
    this.touch = null;
    if (vrm === null) {
      return;
    }
    this.scene.add(vrm.scene);
    if (vrm.lookAt != null) {
      vrm.lookAt.target = this.lookTarget;
    }
    // Pose once before framing so the arms are down and the head bone is settled.
    this.poseApplier.apply(
      vrmPoseTarget(vrm),
      overlayPose({ mood: "idle", time: 0, moodElapsed: 0, aimYaw: 0, aimPitch: 0 }),
      1,
    );
    vrm.update(0);
    this.frameHead(vrm);
    this.tongue = createTongue(vrm);
    this.blush = createBlush(vrm);
    this.hairTouch = new HairTouch(vrm, this.scene);
  }

  /** The 3D hand is loaded and drawn over her, so the page can hide the system pointer there. */
  get handReady(): boolean {
    return this.hand.ready;
  }

  /**
   * Moves the pointer hand to a point in the window. Returns the part of her under it, or null
   * off her, where the hand goes away.
   */
  hover(clientX: number, clientY: number): TouchZone | null {
    const hit = this.hitAt(clientX, clientY);
    this.hand.hover(hit?.point ?? null, this.elapsed);
    return hit?.zone ?? null;
  }

  /** The pointer left the window. */
  hideHand(): void {
    this.hand.hover(null, this.elapsed);
  }

  /** A touch is still playing on the hand, so the system pointer should stay hidden. */
  handBusy(): boolean {
    return this.hand.playing(this.elapsed);
  }

  setReaction(reaction: Reaction): void {
    if (reaction.mood !== this.reaction.mood || reaction.receivedAt !== this.reaction.receivedAt) {
      this.moodStartedAt = this.elapsed;
      this.moodVariant = Math.floor(Math.random() * 3);
    }
    this.reaction = reaction;
  }

  /** Holds a pose or a face for a few seconds, as asked from the office chat. */
  setCommand(pose: CompanionPose | null, face: CompanionFace | null): void {
    this.command = { pose, face, startedAt: null };
  }

  /** What part of 2B is under a point in the window, or null when the point misses her. */
  zoneAt(clientX: number, clientY: number): { zone: TouchZone; side: TouchSide } | null {
    const hit = this.hitAt(clientX, clientY);
    return hit === null ? null : { zone: hit.zone, side: hit.side };
  }

  /** The part of her under a point in the window and where on her it is, or null on a miss. */
  private hitAt(clientX: number, clientY: number): { zone: TouchZone; side: TouchSide; point: Vector3 } | null {
    const vrm = this.vrm;
    if (vrm === null) {
      return null;
    }
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const hit = this.raycaster
      .intersectObject(vrm.scene, true)
      .find((candidate) => (candidate.object as Mesh).isMesh === true && candidate.object.visible);
    if (hit === undefined) {
      return null;
    }
    const humanoid = vrm.humanoid;
    const position = (bone: VRMHumanBoneName): Vector3 | null =>
      humanoid.getRawBoneNode(bone)?.getWorldPosition(new Vector3()) ?? null;
    const head = position("head") ?? new Vector3(0, 1.35, 0);
    let nearest: { bone: VRMHumanBoneName; distance: number } | null = null;
    for (const [from, to] of boneSegments) {
      const a = position(from);
      if (a === null) {
        continue;
      }
      // Bones without a child here (head, hands) reach a little past their joint.
      const b = to === null ? a.clone().add(new Vector3(0, from === "head" ? 0.18 : -0.08, 0)) : position(to);
      if (b === null) {
        continue;
      }
      const distance = distanceToSegment(hit.point, a, b);
      if (nearest === null || distance < nearest.distance) {
        nearest = { bone: from, distance };
      }
    }
    const leftEye = position("leftEye");
    const rightEye = position("rightEye");
    const eyeHeight = leftEye !== null && rightEye !== null ? (leftEye.y + rightEye.y) / 2 - head.y : 0.07;
    const local = hit.point.clone().sub(head);
    const upperChest = position("upperChest") ?? position("chest");
    const fromChest = upperChest === null ? null : hit.point.clone().sub(upperChest);
    const touched = classifyTouch({
      materialName: materialName(hit.object as Mesh, hit.face?.materialIndex),
      bone: nearest !== null && nearest.distance < 0.25 ? nearest.bone : null,
      head: { x: local.x, y: local.y, z: local.z },
      eyeHeight,
      chest: fromChest === null ? null : { x: fromChest.x, y: fromChest.y, z: fromChest.z },
    });
    return { ...touched, point: hit.point.clone() };
  }

  /** Reacts to a touch at a point. Returns the reaction for the page's speech line, or null on a miss. */
  touchAt(clientX: number, clientY: number, kind: TouchKind): TouchReaction | null {
    const hit = this.hitAt(clientX, clientY);
    if (hit === null) {
      return null;
    }
    const reaction = this.touchMood.react(hit.zone, kind, hit.side, this.elapsed);
    this.touch = { reaction, startedAt: this.elapsed };
    this.hand.touch(hit.point, gestureForZone(hit.zone, kind, Math.random()), kind === "hold", this.elapsed);
    return reaction;
  }

  private frameHead(vrm: VRM): void {
    const head = vrm.humanoid.getRawBoneNode("head");
    const headPosition = new Vector3(0, 1.35, 0);
    head?.getWorldPosition(headPosition);
    // Aim slightly below the head bone (which sits at the jaw) so hair and chest both fit.
    this.focus = headPosition.clone().add(new Vector3(0, -0.06, 0));
    this.framing = framedHeight;
    this.placeCamera(0);
  }

  /** Puts the camera so `framing` meters fit the height; a wider frame also centers lower, on the arms. */
  private placeCamera(widening: number): void {
    const distance = this.framing / 2 / Math.tan((fieldOfViewDegrees * Math.PI) / 360);
    const focus = this.focus.clone().add(new Vector3(0, this.focusShift * widening, 0));
    this.camera.position.set(focus.x, focus.y + 0.03, focus.z + distance);
    this.camera.lookAt(focus);
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private currentCommand(): { pose: CompanionPose | null; face: CompanionFace | null; elapsed: number } | null {
    const command = this.command;
    if (command === null) {
      return null;
    }
    command.startedAt ??= this.elapsed;
    const elapsed = this.elapsed - command.startedAt;
    if (elapsed >= poseHoldSeconds) {
      this.command = null;
      return null;
    }
    return { pose: command.pose, face: command.face, elapsed };
  }

  private frame(timestamp: number): void {
    this.timer.update(timestamp);
    const delta = Math.min(this.timer.getDelta(), 0.1);
    this.elapsed += delta;
    this.onFrame();

    const vrm = this.vrm;
    if (vrm !== null) {
      const mood = this.reaction.mood;
      const command = this.currentCommand();
      const touch = this.touch;
      const touchElapsed = touch === null ? 0 : this.elapsed - touch.startedAt;
      if (touch !== null && touchElapsed >= touch.reaction.durationSeconds) {
        this.touch = null;
      }
      const activeTouch = this.touch;

      const wide = command !== null && poseNeedsWideFrame(command.pose) ? 1 : 0;
      if (command !== null && wide === 1) {
        this.focusShift = poseFocusShift(command.pose);
      }
      const target = wide === 1 ? wideFramedHeight : framedHeight;
      this.framing += (target - this.framing) * Math.min(1, framingRate * delta);
      this.placeCamera((this.framing - framedHeight) / (wideFramedHeight - framedHeight));

      const fidget = this.fidgets.update(this.elapsed, mood, command !== null || activeTouch !== null);
      const pose = overlayPose({
        mood,
        time: this.elapsed,
        moodElapsed: this.elapsed - this.moodStartedAt,
        aimYaw: this.aim.yaw,
        aimPitch: this.aim.pitch,
        touch:
          activeTouch === null
            ? null
            : {
                gesture: activeTouch.reaction.gesture,
                elapsed: touchElapsed,
                durationSeconds: activeTouch.reaction.durationSeconds,
                side: activeTouch.reaction.side,
                aimYaw: this.aim.yaw,
                aimPitch: this.aim.pitch,
              },
        command: command?.pose == null ? null : { pose: command.pose, elapsed: command.elapsed },
        fidget,
        variant: this.moodVariant,
      });
      // Her head gives a little to the hand, tipping the way the stroke goes.
      const stroke = this.hand.strokeSide();
      if (stroke !== 0) {
        pose.bones.head = addRotation(pose.bones.head, { y: 0.04 * stroke, z: 0.07 * stroke });
      }
      this.poseApplier.apply(vrmPoseTarget(vrm), pose, delta);

      // Eyes look at where the cursor is, on a plane at the camera; while pondering, up and away.
      const distance = this.camera.position.z - vrm.scene.position.z;
      const ponder = command?.pose === "ponder" ? envelope(command.elapsed, poseHoldSeconds) : 0;
      this.lookTarget.position.set(
        this.camera.position.x + Math.tan(this.aim.yaw) * distance * (1 - ponder) + 0.5 * ponder,
        this.camera.position.y - Math.tan(this.aim.pitch) * distance * (1 - ponder) + 0.4 * ponder,
        this.camera.position.z,
      );

      // A pose's face wins over a touch's, which wins over the mood.
      const touchFace = activeTouch === null ? null : reactionFace(activeTouch.reaction, touchElapsed);
      const targets =
        command !== null
          ? commandFace(command.pose, command.face)
          : (touchFace ?? { ...expressionTargetsForMood(mood), ...(fidget === null ? null : fidgetFace(fidget)) });
      this.expressionWeights = stepExpressionWeights(this.expressionWeights, targets, delta, 6);
      const expressions = vrm.expressionManager;
      if (expressions != null) {
        for (const name of ["happy", "angry", "sad", "relaxed", "surprised", "aa", "blinkRight"]) {
          expressions.setValue(name, this.expressionWeights[name] ?? 0);
        }
        // VRoid's "happy" already closes the eyes, so blinking on top looks broken.
        const happy = this.expressionWeights.happy ?? 0;
        const held = this.expressionWeights.blink ?? 0;
        expressions.setValue("blink", Math.max(held, this.blink.weightAt(this.elapsed) * (1 - happy)));
      }
      this.tongue?.set(command?.pose === "tongue" ? envelope(command.elapsed, poseHoldSeconds, 0.4, 0.5) : 0);
      this.blush?.update(touchFace?.blush ?? 0, delta);
      // The palm from the hand's last frame; a frame behind is not visible on hair.
      this.hairTouch?.update(this.hand.hairContact(), delta);
      updateVrmStable(vrm, delta);
    }

    this.hand.update(this.camera, this.elapsed);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    // The hand goes on top: its own depth, so it is solid, but never hidden inside her.
    this.renderer.clearDepth();
    this.renderer.render(this.hand.scene, this.camera);
  }
}
