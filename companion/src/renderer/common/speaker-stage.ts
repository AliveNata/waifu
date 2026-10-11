import type { VRM } from "@pixiv/three-vrm";
import { DirectionalLight, type Mesh, Object3D, PerspectiveCamera, Scene, Timer, Vector3, WebGLRenderer } from "three";
import type { MemberId } from "../../shared/team.js";
import { type DialogLine, revealCharsPerSecond } from "./conversation.js";
import { PoseApplier, vrmPoseTarget } from "./pose.js";
import { type FacePart, faceParts, SpeakerFace } from "./speaker-face.js";
import { speakerPose } from "./speaker-pose.js";
import { updateVrmStable } from "./vrm-update.js";

const fieldOfViewDegrees = 24;

export interface SpeakerFraming {
  /** Meters of the model the frame shows top to bottom: about 0.95 is head to waist, 0.6 head and shoulders. */
  height: number;
  /** How far below the head bone the frame centers, in meters. */
  drop: number;
}

/** Head to waist, so arm gestures stay in frame. The team overlay uses this. */
export const waistUpFraming: SpeakerFraming = { height: 0.95, drop: 0.12 };

interface MorphSlot {
  mesh: Mesh;
  index: number;
}

/** VRoid exports name morphs "Fcl_BRW_Sorrow" or "Face_Blendshape.Fcl_BRW_Sorrow", so match the end. */
function findFaceParts(vrm: VRM): Map<FacePart, MorphSlot[]> {
  const found = new Map<FacePart, MorphSlot[]>();
  vrm.scene.traverse((object) => {
    const mesh = object as Mesh;
    const dictionary = mesh.morphTargetDictionary;
    if (dictionary === undefined) {
      return;
    }
    for (const [name, index] of Object.entries(dictionary)) {
      const part = faceParts.find((candidate) => name.endsWith(candidate));
      if (part !== undefined) {
        found.set(part, [...(found.get(part) ?? []), { mesh, index }]);
      }
    }
  });
  return found;
}

export interface SpeakerState {
  line: DialogLine;
  startedAt: number;
}

/**
 * Renders whoever is speaking, with lip-sync, expressions, blinks, eye glances and
 * gestures. Shared by the team overlay window and the portrait above the office dialog.
 */
export class SpeakerStage {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(fieldOfViewDegrees, 1, 0.05, 20);
  private readonly lookTarget = new Object3D();
  private readonly viewerPosition = new Vector3();
  private readonly timer = new Timer();
  private readonly poseApplier = new PoseApplier(9);
  private readonly face = new SpeakerFace();

  private speaker: { memberId: MemberId; vrm: VRM; parts: Map<FacePart, MorphSlot[]> } | null = null;
  private state: SpeakerState | null = null;
  private elapsed = 0;
  /** True once the empty frame has been drawn, so an idle stage stops spending GPU time. */
  private clearedEmpty = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onFrame: () => void,
    private readonly framing: SpeakerFraming = waistUpFraming,
  ) {
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const keyLight = new DirectionalLight(0xffffff, Math.PI);
    keyLight.position.set(-0.6, 1.2, 1.5);
    this.scene.add(keyLight, this.lookTarget);
    // The canvas is sized by CSS, which changes with the window or, in the office, with the dialog.
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    this.renderer.setAnimationLoop((timestamp) => this.frame(timestamp));
  }

  currentSpeaker(): MemberId | null {
    return this.speaker?.memberId ?? null;
  }

  /** Shows `vrm` as the speaker. The previous speaker's model stays cached by the caller, not disposed here. */
  setSpeaker(memberId: MemberId, vrm: VRM | null): void {
    if (this.speaker !== null) {
      this.scene.remove(this.speaker.vrm.scene);
    }
    const parts = vrm === null ? new Map<FacePart, MorphSlot[]>() : findFaceParts(vrm);
    this.speaker = vrm === null ? null : { memberId, vrm, parts };
    this.poseApplier.reset();
    // Brows alone carry the feeling only when the model has them; otherwise the presets do.
    this.face.reset(parts.has("Fcl_BRW_Sorrow") && parts.has("Fcl_BRW_Surprised"));
    this.clearedEmpty = false;
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
    const focus = headPosition.clone().add(new Vector3(0, -this.framing.drop, 0));
    const distance = this.framing.height / 2 / Math.tan((fieldOfViewDegrees * Math.PI) / 360);
    this.camera.position.set(focus.x, focus.y + 0.05, focus.z + distance);
    this.camera.lookAt(focus);
    // The speaker talks to the viewer: the eyes aim at the camera, plus the face's glances.
    this.viewerPosition.copy(this.camera.position);
    this.lookTarget.position.copy(this.viewerPosition);
  }

  private resize(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private frame(timestamp: number): void {
    this.timer.update(timestamp);
    const delta = Math.min(this.timer.getDelta(), 0.1);
    this.elapsed += delta;
    this.onFrame();

    const speaker = this.speaker;
    if (speaker === null) {
      if (!this.clearedEmpty) {
        this.renderer.render(this.scene, this.camera);
        this.clearedEmpty = true;
      }
      return;
    }
    const state = this.state;
    const lineElapsed = state === null ? 10 : (Date.now() - state.startedAt) / 1000;
    const revealed = state === null ? 0 : Math.floor(lineElapsed * revealCharsPerSecond);
    const talking = state !== null && revealed < state.line.text.length;

    this.poseApplier.apply(
      vrmPoseTarget(speaker.vrm),
      speakerPose({ gesture: state?.line.gesture ?? "none", lineElapsed, time: this.elapsed, talking }),
      delta,
    );

    const { expressions, gaze } = this.face.update(
      { line: state?.line ?? null, lineElapsed, revealed, talking },
      this.elapsed,
      delta,
    );
    const manager = speaker.vrm.expressionManager;
    for (const [name, weight] of Object.entries(expressions)) {
      if (!speaker.parts.has(name as FacePart)) {
        manager?.setValue(name, weight);
      }
    }
    this.lookTarget.position.set(this.viewerPosition.x + gaze.x, this.viewerPosition.y + gaze.y, this.viewerPosition.z);
    updateVrmStable(speaker.vrm, delta);
    // After the VRM update, so these sit on top of the presets it just applied. No preset binds
    // these morphs, so nothing else writes or resets them.
    for (const [part, slots] of speaker.parts) {
      for (const { mesh, index } of slots) {
        if (mesh.morphTargetInfluences !== undefined) {
          mesh.morphTargetInfluences[index] = expressions[part] ?? 0;
        }
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
}
