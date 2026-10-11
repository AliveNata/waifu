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
import { PoseApplier, vrmPoseTarget } from "../common/pose.js";
import { updateVrmStable } from "../common/vrm-update.js";
import { cursorAim, overlayPose } from "./overlay-pose.js";
import { commandFace, envelope, poseFocusShift, poseHoldSeconds, poseNeedsWideFrame } from "./pose-bones.js";
import { createTongue, type Tongue } from "./tongue.js";
import { reactionFace, type TouchKind, TouchMood, type TouchReaction } from "./touch-reactions.js";
import { classifyTouch, type TouchZone } from "./touch-zones.js";

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
  private focus = new Vector3(0, 1.3, 0);
  private framing = framedHeight;
  /** Kept after a pose ends, so the camera eases back along the same line it pulled out on. */
  private focusShift = -0.2;
  private reaction: Reaction = idleReaction(Date.now());
  private moodStartedAt = 0;
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

    const keyLight = new DirectionalLight(0xffffff, Math.PI);
    keyLight.position.set(0.6, 1.2, 1.5);
    this.scene.add(keyLight, this.lookTarget);

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
  }

  setReaction(reaction: Reaction): void {
    if (reaction.mood !== this.reaction.mood || reaction.receivedAt !== this.reaction.receivedAt) {
      this.moodStartedAt = this.elapsed;
    }
    this.reaction = reaction;
  }

  /** Holds a pose or a face for a few seconds, as asked from the office chat. */
  setCommand(pose: CompanionPose | null, face: CompanionFace | null): void {
    this.command = { pose, face, startedAt: null };
  }

  /** What part of 2B is under a point in the window, or null when the point misses her. */
  zoneAt(clientX: number, clientY: number): { zone: TouchZone; side: "left" | "right" | "center" } | null {
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
    return classifyTouch({
      materialName: materialName(hit.object as Mesh, hit.face?.materialIndex),
      bone: nearest !== null && nearest.distance < 0.25 ? nearest.bone : null,
      head: { x: local.x, y: local.y, z: local.z },
      eyeHeight,
    });
  }

  /** Reacts to a touch at a point. Returns the reaction for the page's speech line, or null on a miss. */
  touchAt(clientX: number, clientY: number, kind: TouchKind): TouchReaction | null {
    const hit = this.zoneAt(clientX, clientY);
    if (hit === null) {
      return null;
    }
    const reaction = this.touchMood.react(hit.zone, kind, hit.side, this.elapsed);
    this.touch = { reaction, startedAt: this.elapsed };
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
      });
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
        command !== null ? commandFace(command.pose, command.face) : (touchFace ?? expressionTargetsForMood(mood));
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
      updateVrmStable(vrm, delta);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
