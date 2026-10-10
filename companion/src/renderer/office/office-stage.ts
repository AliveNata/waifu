import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  HemisphereLight,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  Spherical,
  Timer,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
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
import { OfficeLife } from "./office-life.js";
import { stations } from "./office-plan.js";
import { officePose } from "./office-pose.js";
import { buildOffice, type CloseupShot, type DeskMember, twobBoardShot } from "./office-scene.js";
import { PlaceholderAvatar } from "./placeholder.js";
import { fitSeat } from "./seating.js";
import type { Vec2 } from "./surfaces/drawing.js";
import { applyMemberSignal, emptyTeamRuntime, memberBehavior, type TeamRuntime } from "./team-state.js";

const closeupBackground = new Color("#e9e4da");
/** Keeps the close-up on the last worker a little after they finish, so the "done" moment is visible. */
const closeupHoldMs = 3500;

/** Orbit target: the middle of the floor, a little toward the back where the desks are. */
const viewTarget = new Vector3(-0.3, 0.3, -0.6);
/** Default view from the open +x/+z corner, high enough to see over the front desks into the room. */
const defaultView = { azimuth: Math.PI / 4, polar: 1.0 };
/** Keeps the camera on the open sides of the cutaway: never behind a wall, never under the floor. */
const viewLimits = {
  minAzimuth: 0.12,
  maxAzimuth: 1.45,
  minPolar: 0.45,
  maxPolar: 1.2,
  minDistance: 6,
  maxDistance: 26,
};
/** After this long without input the camera drifts slowly, so a parked office still feels alive. */
const idleDriftAfterMs = 25_000;

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
  /** Whether the last frame was real work, to hand the member back to their routine exactly once. */
  wasWorking: boolean;
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
  watch: "nonton",
  game: "main game",
  brew: "bikin kopi",
  snack: "ngemil",
  arcade: "main arcade",
  water: "nyiram tanaman",
  lounge: "rebahan",
  selfie: "selfie",
  rack: "ngecek server",
  chat: "ngobrol",
};

export class OfficeStage {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, 1.6, 0.1, 120);
  private readonly closeupCamera = new PerspectiveCamera(38, 1.6, 0.05, 30);
  private readonly controls: OrbitControls;
  private readonly timer = new Timer();
  private readonly office = buildOffice();
  private readonly life = new OfficeLife();
  private readonly rigs: Record<MemberId, MemberRig>;

  private team: TeamRuntime = emptyTeamRuntime();
  private twobReaction: Reaction = idleReaction(Date.now());
  private elapsed = 0;
  private closeupEnabled = true;
  private focus: CloseupFocus | null = null;
  private heldFocus: { memberId: MemberId; until: number } | null = null;
  private lastInputAt = Date.now();
  private driftPhase = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onFrame: () => void,
  ) {
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.autoClear = false;
    // Filmic tone mapping keeps the bright room from washing out and lets the accent glow read as light.
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    // Soft shadows ground the chibis and furniture; without them the room reads as floating props.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;

    const sun = new DirectionalLight(0xfff2e2, 2.3);
    sun.position.set(6, 11, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 9;
    sun.shadow.camera.bottom = -9;
    sun.shadow.bias = -0.0004;
    // Cool fill from the back windows, so faces at the back-row desks are not lit by the sun alone.
    const windowFill = new DirectionalLight(0xdfeaff, 0.55);
    windowFill.position.set(0, 4, -10);
    this.scene.add(new HemisphereLight(0xfff8ee, 0xb7a68a, 1.5), sun, windowFill, this.office.root);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(viewTarget);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minAzimuthAngle = viewLimits.minAzimuth;
    this.controls.maxAzimuthAngle = viewLimits.maxAzimuth;
    this.controls.minPolarAngle = viewLimits.minPolar;
    this.controls.maxPolarAngle = viewLimits.maxPolar;
    this.controls.minDistance = viewLimits.minDistance;
    this.controls.maxDistance = viewLimits.maxDistance;
    this.controls.addEventListener("start", () => {
      this.lastInputAt = Date.now();
    });
    canvas.addEventListener("keydown", (event) => this.handleKey(event));
    canvas.addEventListener("dblclick", () => this.resetView());

    this.rigs = Object.fromEntries(
      memberIds.map((memberId) => [memberId, this.createRig(memberId, new PlaceholderAvatar(memberLooks[memberId]))]),
    ) as Record<MemberId, MemberRig>;

    window.addEventListener("resize", () => this.resize());
    this.resize();
    this.resetView();
    this.renderer.setAnimationLoop((timestamp) => this.frame(timestamp));
  }

  /** Swaps a member's avatar, for example from placeholder to their real VRM. */
  setAvatar(memberId: MemberId, avatar: OfficeAvatar): void {
    const rig = this.rigs[memberId];
    rig.avatar.dispose();
    rig.avatar = avatar;
    rig.poseApplier.reset();
    rig.expressions = {};
    avatar.addHairColliders(this.office.hairColliders);
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

  /** Back to the default view, the same framing the office opens with. */
  resetView(): void {
    const spherical = new Spherical(this.fitDistance(), defaultView.polar, defaultView.azimuth);
    this.camera.position.copy(viewTarget).add(new Vector3().setFromSpherical(spherical));
    this.controls.target.copy(viewTarget);
    this.controls.update();
  }

  /** Keyboard parity with the mouse: arrows orbit, +/- zoom, 0 resets. */
  private handleKey(event: KeyboardEvent): void {
    const step = 0.08;
    switch (event.key) {
      case "ArrowLeft":
        this.controls.rotateLeft(step);
        break;
      case "ArrowRight":
        this.controls.rotateLeft(-step);
        break;
      case "ArrowUp":
        this.controls.rotateUp(step);
        break;
      case "ArrowDown":
        this.controls.rotateUp(-step);
        break;
      // OrbitControls multiplies the distance by the dolly scale, so zooming in takes a scale below 1.
      case "+":
      case "=":
        this.controls.dollyIn(0.9);
        break;
      case "-":
        this.controls.dollyOut(0.9);
        break;
      case "0":
        this.resetView();
        break;
      default:
        return;
    }
    event.preventDefault();
    this.lastInputAt = Date.now();
    this.controls.update();
  }

  /** Distance that fits the whole floor in view for the current window shape. */
  private fitDistance(): number {
    const aspect = this.camera.aspect;
    // Tuned so a 16:10 window shows wall to wall; narrower windows back off to keep the width.
    return Math.min(viewLimits.maxDistance, 14 * Math.max(1, 1.6 / aspect));
  }

  private createRig(memberId: MemberId, avatar: OfficeAvatar): MemberRig {
    const plan = this.planFor(memberId, Date.now(), null);
    this.scene.add(avatar.root);
    return {
      avatar,
      actor: initialActor(plan.station),
      poseApplier: new PoseApplier(10),
      blink: new BlinkScheduler(),
      expressions: {},
      action: plan.action,
      actionStartedAt: 0,
      keystrokes: 0,
      plan,
      wasWorking: false,
    };
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private planFor(memberId: MemberId, now: number, rig: MemberRig | null): MemberPlan {
    if (memberId === "twob") {
      const mood = this.twobReaction.mood;
      if (mood !== "idle") {
        if (rig !== null && !rig.wasWorking) {
          this.life.interrupt(memberId, now);
        }
        if (rig !== null) {
          rig.wasWorking = true;
        }
        return twobPlan(mood, this.life.planFor(memberId, now));
      }
      if (rig !== null) {
        rig.wasWorking = false;
      }
      return twobPlan("idle", this.life.planFor(memberId, now));
    }
    const behavior = memberBehavior(this.team[memberId], now);
    if (behavior !== "idle") {
      if (rig !== null && !rig.wasWorking) {
        this.life.interrupt(memberId, now);
      }
      if (rig !== null) {
        rig.wasWorking = true;
      }
      return memberPlan(memberId, behavior, null);
    }
    if (rig !== null) {
      rig.wasWorking = false;
    }
    return memberPlan(memberId, "idle", this.life.planFor(memberId, now));
  }

  /** Advances the member's work surface and returns where the hand should be, if anywhere. */
  private updateSurface(memberId: MemberId, rig: MemberRig, delta: number): Vector3 | null {
    const action = rig.action;
    if (memberId in this.office.workstations) {
      const workstation = this.office.workstations[memberId as DeskMember];
      const typing = action === "type" && rig.plan.station === `desk-${memberId}`;
      const typed = workstation.screen.update(delta, typing);
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
    const plan = this.planFor(memberId, now, rig);
    rig.plan = plan;
    rig.actor = stepActor(rig.actor, plan.station, delta);
    const walking = isWalking(rig.actor);
    if (!walking && rig.actor.target === plan.station) {
      this.life.arrived(memberId, now);
    }
    const action = walking ? null : plan.action;
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
    const seatHeight = stations[plan.station].seatHeight;
    const pose = officePose({
      action,
      walkPhase: actor.walkPhase,
      time: this.elapsed + phaseOffset,
      actionElapsed: this.elapsed - rig.actionStartedAt,
      seat: action === null || seatHeight === null ? null : fitSeat(avatar.legs, seatHeight),
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

  /** TV, arcade and rack react to whoever is using them, so the props look switched on by people. */
  private updateProps(delta: number): void {
    const usingAt = (station: string, action: OfficeAction): boolean =>
      memberIds.some((memberId) => {
        const rig = this.rigs[memberId];
        return rig.action === action && rig.plan.station === station;
      });
    const onSofa = (action: OfficeAction): boolean =>
      usingAt("sofa-1", action) || usingAt("sofa-2", action) || usingAt("sofa-3", action);
    this.office.tv.update(delta, onSofa("game") ? "game" : onSofa("watch") ? "show" : "off");
    this.office.arcade.update(delta, usingAt("arcade", "arcade") ? "playing" : "attract");
    this.office.rackLights.update(this.elapsed, usingAt("rack", "rack"));
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
    if (best === null && (twob.action === "type" || twob.action === "draw") && twob.plan.mood !== "idle") {
      best = { memberId: "twob", at: now };
    }
    if (best !== null) {
      this.heldFocus = { memberId: best.memberId, until: now + closeupHoldMs };
    } else if (this.heldFocus !== null && now < this.heldFocus.until) {
      best = { memberId: this.heldFocus.memberId, at: now };
    } else {
      this.heldFocus = null;
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

  /** A slow sway around the default angle once nobody has touched the camera for a while. */
  private drift(delta: number, now: number): void {
    if (now - this.lastInputAt < idleDriftAfterMs) {
      this.driftPhase = 0;
      return;
    }
    this.driftPhase += delta;
    this.controls.rotateLeft(Math.sin(this.driftPhase * 0.12) * 0.0009);
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
    this.updateProps(delta);
    this.focus = this.chooseFocus(now);
    this.drift(delta, now);
    this.controls.update(delta);

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
