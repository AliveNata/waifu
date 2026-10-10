import {
  Color,
  DirectionalLight,
  HemisphereLight,
  OrthographicCamera,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  Timer,
  Vector3,
  WebGLRenderer,
} from "three";
import { idleReaction, type MemberSignal, type Reaction } from "../../shared/reaction.js";
import { type MemberId, memberIds, roster } from "../../shared/team.js";
import {
  BlinkScheduler,
  type ExpressionWeights,
  expressionTargetsForMood,
  stepExpressionWeights,
} from "../common/expressions.js";
import { memberLooks } from "../common/looks.js";
import { PoseApplier } from "../common/pose.js";
import type { OfficeAvatar } from "./avatar.js";
import { solveCcd } from "./ik.js";
import { type ActorState, initialActor, isWalking, stepActor } from "./office-actor.js";
import { type MemberPlan, memberPlan, type OfficeAction, twobPlan, usesHandIk } from "./office-director.js";
import { homeStations } from "./office-layout.js";
import { officePose } from "./office-pose.js";
import { buildOffice, type CloseupShot, type DeskMember, twobBoardShot } from "./office-scene.js";
import { PlaceholderAvatar } from "./placeholder.js";
import type { Vec2 } from "./surfaces/drawing.js";
import { applyMemberSignal, emptyTeamRuntime, memberBehavior, type TeamRuntime } from "./team-state.js";

const cameraDirection = new Vector3(1, 0.82, 1).normalize();
const cameraFocus = new Vector3(-0.7, 0.6, -0.3);
/** World units that must stay visible: roughly the room's diagonal footprint. */
const minimumViewWidth = 11.5;
const minimumViewHeight = 7;
const closeupBackground = new Color("#e9e4da");

interface MemberRig {
  avatar: OfficeAvatar;
  actor: ActorState;
  poseApplier: PoseApplier;
  blink: BlinkScheduler;
  expressions: ExpressionWeights;
  action: OfficeAction | null;
  actionStartedAt: number;
  keystrokes: number;
  plan: MemberPlan;
}

export interface CloseupRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CloseupFocus {
  memberId: MemberId;
  label: string;
}

/** Bottom-right picture-in-picture area, above the HUD. Shared with the page so the caption lines up. */
export function closeupRect(viewWidth: number, viewHeight: number): CloseupRect {
  const width = Math.round(Math.min(440, viewWidth * 0.42));
  const height = Math.round(width * 0.62);
  return { x: viewWidth - width - 16, y: viewHeight - height - 76, width, height };
}

const actionLabels: Record<OfficeAction, string> = {
  type: "ngetik",
  "desk-idle": "santai",
  stretch: "selesai",
  draw: "nulis di papan",
  read: "baca",
  stick: "nempel ide",
  ponder: "mikir",
  cheer: "selesai",
  wave: "manggil lo",
  relax: "santai",
};

export class OfficeStage {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private readonly closeupCamera = new PerspectiveCamera(38, 1.6, 0.05, 30);
  private readonly timer = new Timer();
  private readonly office = buildOffice();
  private readonly rigs: Record<MemberId, MemberRig>;

  private team: TeamRuntime = emptyTeamRuntime();
  private twobReaction: Reaction = idleReaction(Date.now());
  private elapsed = 0;
  private closeupEnabled = true;
  private focus: CloseupFocus | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onFrame: () => void,
  ) {
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.autoClear = false;
    // Shadows ground the chibis on the floor; without them they read as floating.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;

    const sun = new DirectionalLight(0xffffff, 2.2);
    sun.position.set(4, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -7;
    sun.shadow.camera.right = 7;
    sun.shadow.camera.top = 7;
    sun.shadow.camera.bottom = -7;
    sun.shadow.bias = -0.0005;
    this.scene.add(new HemisphereLight(0xfff8ee, 0x8a7a66, 1.6), sun, this.office.root);

    this.camera.position.copy(cameraFocus).addScaledVector(cameraDirection, 25);
    this.camera.lookAt(cameraFocus);

    this.rigs = Object.fromEntries(
      memberIds.map((memberId) => [memberId, this.createRig(memberId, new PlaceholderAvatar(memberLooks[memberId]))]),
    ) as Record<MemberId, MemberRig>;

    window.addEventListener("resize", () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop((timestamp) => this.frame(timestamp));
  }

  /** Swaps a member's avatar, for example from placeholder to their real VRM. */
  setAvatar(memberId: MemberId, avatar: OfficeAvatar): void {
    const rig = this.rigs[memberId];
    rig.avatar.dispose();
    rig.avatar = avatar;
    rig.poseApplier.reset();
    rig.expressions = {};
    this.scene.add(avatar.root);
  }

  placeholderFor(memberId: MemberId): OfficeAvatar {
    return new PlaceholderAvatar(memberLooks[memberId]);
  }

  setTwobReaction(reaction: Reaction): void {
    this.twobReaction = reaction;
  }

  applyMemberSignal(signal: MemberSignal): void {
    if (signal.memberId === "twob") {
      return;
    }
    this.team = { ...this.team, [signal.memberId]: applyMemberSignal(this.team[signal.memberId], signal) };
  }

  setCloseupEnabled(enabled: boolean): void {
    this.closeupEnabled = enabled;
  }

  /** Who the close-up is showing right now, or null when nobody is busy (or it is turned off). */
  closeupFocus(): CloseupFocus | null {
    return this.closeupEnabled ? this.focus : null;
  }

  private createRig(memberId: MemberId, avatar: OfficeAvatar): MemberRig {
    const plan = memberId === "twob" ? twobPlan("idle") : memberPlan(memberId, "idle");
    const station = memberId === "twob" ? plan.station : homeStations[memberId];
    this.scene.add(avatar.root);
    return {
      avatar,
      actor: initialActor(station),
      poseApplier: new PoseApplier(10),
      blink: new BlinkScheduler(),
      expressions: {},
      action: plan.action,
      actionStartedAt: 0,
      keystrokes: 0,
      plan,
    };
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    const viewHeight = Math.max(minimumViewHeight, minimumViewWidth / aspect);
    const viewWidth = viewHeight * aspect;
    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private planFor(memberId: MemberId, now: number): MemberPlan {
    if (memberId === "twob") {
      return twobPlan(this.twobReaction.mood);
    }
    return memberPlan(memberId, memberBehavior(this.team[memberId], now));
  }

  /** Advances the member's work surface and returns where the hand should be, if anywhere. */
  private updateSurface(memberId: MemberId, rig: MemberRig, delta: number): Vector3 | null {
    const action = rig.action;
    if (memberId in this.office.workstations) {
      const workstation = this.office.workstations[memberId as DeskMember];
      const typed = workstation.screen.update(delta, action === "type");
      for (const character of typed) {
        workstation.keyboard.press(character);
      }
      rig.keystrokes += typed.length;
      workstation.keyboard.update(delta);
    }

    let pen: Vec2 | null = null;
    if (memberId === "rias") {
      pen = this.office.whiteboard.update(1, delta, action === "draw");
    } else if (memberId === "twob") {
      pen = this.office.whiteboard.update(0, delta, action === "draw");
    } else if (memberId === "chizuru") {
      pen = this.office.ideaBoard.update(delta, action === "stick");
    }
    if (pen === null) {
      return null;
    }
    return memberId === "chizuru"
      ? this.office.ideaBoardPoint(pen[0], pen[1])
      : this.office.whiteboardPoint(pen[0], pen[1]);
  }

  private updateMember(memberId: MemberId, delta: number, now: number): void {
    const rig = this.rigs[memberId];
    const plan = this.planFor(memberId, now);
    rig.plan = plan;
    if (memberId === "twob") {
      rig.actor = stepActor(rig.actor, plan.station, delta);
    }
    const action = isWalking(rig.actor) ? null : plan.action;
    if (action !== rig.action) {
      rig.action = action;
      rig.actionStartedAt = this.elapsed;
    }

    const handTarget = this.updateSurface(memberId, rig, delta);
    // Offset each member's idle loops so the room does not move in lockstep.
    const phaseOffset = memberIds.indexOf(memberId) * 1.7;

    const { avatar, actor } = rig;
    avatar.root.position.set(actor.position.x, 0, actor.position.z);
    avatar.root.rotation.y = actor.yaw;
    const pose = officePose({
      action,
      walkPhase: actor.walkPhase,
      time: this.elapsed + phaseOffset,
      actionElapsed: this.elapsed - rig.actionStartedAt,
      sitDrop: avatar.sitDrop,
      keystrokes: rig.keystrokes,
    });
    rig.poseApplier.apply(avatar.poseTarget, pose, delta);

    if (action !== null && usesHandIk(action) && handTarget !== null) {
      const arm = avatar.rightArm();
      if (arm !== null) {
        avatar.syncPose();
        solveCcd(arm, handTarget);
      }
    }

    rig.expressions = stepExpressionWeights(rig.expressions, expressionTargetsForMood(plan.mood), delta);
    const happy = rig.expressions.happy ?? 0;
    avatar.setExpressions(rig.expressions, rig.blink.weightAt(this.elapsed + phaseOffset) * (1 - happy));
    avatar.update(delta);
  }

  private chooseFocus(now: number): CloseupFocus | null {
    let best: { memberId: MemberId; at: number } | null = null;
    for (const memberId of memberIds) {
      if (memberId === "twob") {
        continue;
      }
      const runtime = this.team[memberId];
      if (memberBehavior(runtime, now) === "working" && (best === null || runtime.lastSignalAt > best.at)) {
        best = { memberId, at: runtime.lastSignalAt };
      }
    }
    const twob = this.rigs.twob;
    if (best === null && (twob.action === "type" || twob.action === "draw")) {
      best = { memberId: "twob", at: now };
    }
    if (best === null) {
      return null;
    }
    const rig = this.rigs[best.memberId];
    const profile = roster[best.memberId];
    const activity = rig.action === null ? "jalan" : actionLabels[rig.action];
    const tool = best.memberId === "twob" ? null : this.team[best.memberId].lastTool;
    const label = `${profile.displayName} · ${profile.role} · ${activity}${tool === null ? "" : ` (${tool})`}`;
    return { memberId: best.memberId, label };
  }

  private closeupShot(memberId: MemberId): CloseupShot {
    if (memberId === "twob" && this.rigs.twob.action === "draw") {
      return twobBoardShot(this.office);
    }
    return this.office.closeups[memberId];
  }

  private frame(timestamp: number): void {
    this.timer.update(timestamp);
    const delta = Math.min(this.timer.getDelta(), 0.1);
    this.elapsed += delta;
    const now = Date.now();
    this.onFrame();

    for (const memberId of memberIds) {
      this.updateMember(memberId, delta, now);
    }
    this.focus = this.chooseFocus(now);

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, width, height);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    if (this.closeupEnabled && this.focus !== null) {
      const rect = closeupRect(width, height);
      const shot = this.closeupShot(this.focus.memberId);
      this.closeupCamera.aspect = rect.width / rect.height;
      this.closeupCamera.updateProjectionMatrix();
      this.closeupCamera.position.copy(shot.eye);
      this.closeupCamera.lookAt(shot.target);
      // WebGL viewports count from the bottom-left corner.
      const bottom = height - rect.y - rect.height;
      this.renderer.setScissorTest(true);
      this.renderer.setScissor(rect.x, bottom, rect.width, rect.height);
      this.renderer.setViewport(rect.x, bottom, rect.width, rect.height);
      this.renderer.setClearColor(closeupBackground, 1);
      this.renderer.clear();
      this.renderer.render(this.scene, this.closeupCamera);
      this.renderer.setScissorTest(false);
    }
  }
}
