import type { VRM } from "@pixiv/three-vrm";
import { DirectionalLight, Object3D, PerspectiveCamera, Scene, Timer, Vector3, WebGLRenderer } from "three";
import type { CursorOffset } from "../../shared/protocol.js";
import { idleReaction, type Reaction } from "../../shared/reaction.js";
import {
  BlinkScheduler,
  type ExpressionWeights,
  expressionTargetsForMood,
  stepExpressionWeights,
} from "../common/expressions.js";
import type { Stage } from "../common/page.js";
import { PoseApplier } from "../common/pose.js";
import { cursorAim, overlayPose } from "./overlay-pose.js";

/** Vertical span of the close-up in meters: top of the hair down to mid chest. */
const framedHeight = 0.62;
const fieldOfViewDegrees = 22;

export class OverlayStage implements Stage {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(fieldOfViewDegrees, 1, 0.05, 20);
  private readonly lookTarget = new Object3D();
  private readonly timer = new Timer();
  private readonly poseApplier = new PoseApplier();
  private readonly blink = new BlinkScheduler();

  private vrm: VRM | null = null;
  private reaction: Reaction = idleReaction(Date.now());
  private moodStartedAt = 0;
  private aim = { yaw: 0, pitch: 0 };
  private expressionWeights: ExpressionWeights = {};
  private elapsed = 0;

  constructor(
    canvas: HTMLCanvasElement,
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
    this.vrm = vrm;
    this.poseApplier.reset();
    this.expressionWeights = {};
    if (vrm === null) {
      return;
    }
    this.scene.add(vrm.scene);
    if (vrm.lookAt != null) {
      vrm.lookAt.target = this.lookTarget;
    }
    // Pose once before framing so the arms are down and the head bone is settled.
    this.poseApplier.apply(vrm, overlayPose({ mood: "idle", time: 0, moodElapsed: 0, aimYaw: 0, aimPitch: 0 }), 1);
    vrm.update(0);
    this.frameHead(vrm);
  }

  setReaction(reaction: Reaction): void {
    if (reaction.mood !== this.reaction.mood || reaction.receivedAt !== this.reaction.receivedAt) {
      this.moodStartedAt = this.elapsed;
    }
    this.reaction = reaction;
  }

  private frameHead(vrm: VRM): void {
    const head = vrm.humanoid.getRawBoneNode("head");
    const headPosition = new Vector3(0, 1.35, 0);
    head?.getWorldPosition(headPosition);
    // Aim slightly below the head bone (which sits at the jaw) so hair and chest both fit.
    const focus = headPosition.clone().add(new Vector3(0, -0.06, 0));
    const distance = framedHeight / 2 / Math.tan((fieldOfViewDegrees * Math.PI) / 360);
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

  private frame(timestamp: number): void {
    this.timer.update(timestamp);
    const delta = Math.min(this.timer.getDelta(), 0.1);
    this.elapsed += delta;
    this.onFrame();

    const vrm = this.vrm;
    if (vrm !== null) {
      const mood = this.reaction.mood;
      const pose = overlayPose({
        mood,
        time: this.elapsed,
        moodElapsed: this.elapsed - this.moodStartedAt,
        aimYaw: this.aim.yaw,
        aimPitch: this.aim.pitch,
      });
      this.poseApplier.apply(vrm, pose, delta);

      // Eyes look at where the cursor is, on a plane at the camera.
      const distance = this.camera.position.z - vrm.scene.position.z;
      this.lookTarget.position.set(
        this.camera.position.x + Math.tan(this.aim.yaw) * distance,
        this.camera.position.y - Math.tan(this.aim.pitch) * distance,
        this.camera.position.z,
      );

      this.expressionWeights = stepExpressionWeights(this.expressionWeights, expressionTargetsForMood(mood), delta);
      const expressions = vrm.expressionManager;
      if (expressions != null) {
        for (const [name, weight] of Object.entries(this.expressionWeights)) {
          expressions.setValue(name, weight);
        }
        // VRoid's "happy" already closes the eyes, so blinking on top looks broken.
        const happy = this.expressionWeights.happy ?? 0;
        expressions.setValue("blink", this.blink.weightAt(this.elapsed) * (1 - happy));
      }
      vrm.update(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
