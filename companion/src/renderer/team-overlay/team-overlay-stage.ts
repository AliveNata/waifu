import type { VRM } from "@pixiv/three-vrm";
import { DirectionalLight, Object3D, PerspectiveCamera, Scene, Timer, Vector3, WebGLRenderer } from "three";
import type { Mood } from "../../shared/reaction.js";
import type { MemberId } from "../../shared/team.js";
import { allVisemes, type DialogLine, revealCharsPerSecond, visemeWeights } from "../common/conversation.js";
import { BlinkScheduler, type ExpressionWeights, stepExpressionWeights } from "../common/expressions.js";
import { PoseApplier, vrmPoseTarget } from "../common/pose.js";
import { updateVrmStable } from "../common/vrm-update.js";
import { speakerPose } from "./team-overlay-pose.js";

/**
 * Softer than the overlay's mood expressions: VRoid's "happy" closes the eyes,
 * which looks odd for someone mid-sentence.
 */
const dialogExpressions: Record<Mood, ExpressionWeights> = {
  idle: {},
  greeting: { happy: 0.3 },
  thinking: { relaxed: 0.25 },
  working: { relaxed: 0.1 },
  waiting: { surprised: 0.3 },
  done: { happy: 0.55 },
};

/** Head to waist, wider than Konan's close-up so arm gestures stay in frame. */
const framedHeight = 0.9;
const fieldOfViewDegrees = 24;

export interface SpeakerState {
  line: DialogLine;
  startedAt: number;
}

/** Renders whichever member is speaking, with lip-sync, expressions and gestures. */
export class TeamOverlayStage {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(fieldOfViewDegrees, 1, 0.05, 20);
  private readonly lookTarget = new Object3D();
  private readonly timer = new Timer();
  private readonly poseApplier = new PoseApplier(9);
  private readonly blink = new BlinkScheduler();

  private speaker: { memberId: MemberId; vrm: VRM } | null = null;
  private state: SpeakerState | null = null;
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
    keyLight.position.set(-0.6, 1.2, 1.5);
    this.scene.add(keyLight, this.lookTarget);
    window.addEventListener("resize", () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop((timestamp) => this.frame(timestamp));
  }

  currentSpeaker(): MemberId | null {
    return this.speaker?.memberId ?? null;
  }

  /** Shows `vrm` as the speaker. The previous speaker's model stays cached by the page, not disposed here. */
  setSpeaker(memberId: MemberId, vrm: VRM | null): void {
    if (this.speaker !== null) {
      this.scene.remove(this.speaker.vrm.scene);
    }
    this.speaker = vrm === null ? null : { memberId, vrm };
    this.poseApplier.reset();
    this.expressionWeights = {};
    if (vrm === null) {
      return;
    }
    this.scene.add(vrm.scene);
    if (vrm.lookAt != null) {
      vrm.lookAt.target = this.lookTarget;
    }
    this.poseApplier.apply(
      vrmPoseTarget(vrm),
      speakerPose({ gesture: "none", lineElapsed: 0, time: 0, talking: false }),
      1,
    );
    vrm.update(0);
    this.frameSpeaker(vrm);
  }

  setLine(state: SpeakerState | null): void {
    this.state = state;
  }

  private frameSpeaker(vrm: VRM): void {
    const head = vrm.humanoid.getRawBoneNode("head");
    const headPosition = new Vector3(0, 1.35, 0);
    head?.getWorldPosition(headPosition);
    const focus = headPosition.clone().add(new Vector3(0, -0.2, 0));
    const distance = framedHeight / 2 / Math.tan((fieldOfViewDegrees * Math.PI) / 360);
    this.camera.position.set(focus.x, focus.y + 0.05, focus.z + distance);
    this.camera.lookAt(focus);
    // The speaker looks at the viewer, as if talking to them.
    this.lookTarget.position.copy(this.camera.position);
  }

  private resize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  private frame(timestamp: number): void {
    this.timer.update(timestamp);
    const delta = Math.min(this.timer.getDelta(), 0.1);
    this.elapsed += delta;
    this.onFrame();

    const speaker = this.speaker;
    if (speaker !== null) {
      const state = this.state;
      const now = Date.now();
      const lineElapsed = state === null ? 10 : (now - state.startedAt) / 1000;
      const revealed = state === null ? 0 : Math.floor(lineElapsed * revealCharsPerSecond);
      const talking = state !== null && revealed < state.line.text.length;
      const mood: Mood = state?.line.mood ?? "idle";

      this.poseApplier.apply(
        vrmPoseTarget(speaker.vrm),
        speakerPose({ gesture: state?.line.gesture ?? "none", lineElapsed, time: this.elapsed, talking }),
        delta,
      );

      // Mood expression plus mouth shapes from the text being revealed.
      const targets: Record<string, number> = { ...dialogExpressions[mood] };
      if (talking && state !== null) {
        Object.assign(targets, visemeWeights(state.line.text, revealed));
      }
      this.expressionWeights = stepExpressionWeights(this.expressionWeights, targets, delta, 14);
      const expressions = speaker.vrm.expressionManager;
      if (expressions != null) {
        for (const viseme of allVisemes()) {
          expressions.setValue(viseme, this.expressionWeights[viseme] ?? 0);
        }
        for (const [name, weight] of Object.entries(this.expressionWeights)) {
          expressions.setValue(name, weight);
        }
        const happy = this.expressionWeights.happy ?? 0;
        expressions.setValue("blink", this.blink.weightAt(this.elapsed) * (1 - happy));
      }
      updateVrmStable(speaker.vrm, delta);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
