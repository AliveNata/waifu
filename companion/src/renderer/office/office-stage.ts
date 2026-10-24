import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  HalfFloatType,
  HemisphereLight,
  type Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PointLight,
  Scene,
  Spherical,
  Timer,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
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
import type { ArmSide, ArmTip, OfficeAvatar } from "./avatar.js";
import { nightFactor } from "./daylight.js";
import {
  type ActiveDeskBit,
  chessCarry,
  DeskHabits,
  deskBitFace,
  deskBitProp,
  deskBitSpec,
  deskBits,
  itemInHand,
  reachingForItem,
} from "./desk-habits.js";
import { aimHand, solveCcd } from "./ik.js";
import { type ActorState, angleDelta, initialActor, isWalking, stepActor } from "./office-actor.js";
import { ChatterDirector } from "./office-chatter.js";
import {
  type MemberPlan,
  memberPlan,
  type OfficeAction,
  ovenStep,
  propForAction,
  twobPlan,
  usesHandIk,
} from "./office-director.js";
import { OfficeLife } from "./office-life.js";
import { initialMug, type MugState, stepMug } from "./office-mug.js";
import { distance, meetingStationIds, type StationId, stations, surface } from "./office-plan.js";
import { type BoardFocus, officePose } from "./office-pose.js";
import { buildOffice, type CloseupShot, type DeskMember, twobBoardShot } from "./office-scene.js";
import { PlaceholderAvatar } from "./placeholder.js";
import { HandProps } from "./scene/hand-props.js";
import { sceneQuality } from "./scene/palette.js";
import { fitSeat } from "./seating.js";
import type { PenState } from "./surfaces/board-pen.js";
import { applyMemberSignal, emptyTeamRuntime, endAllRuns, memberBehavior, type TeamRuntime } from "./team-state.js";
import { handForKey, MouseHabit, TypingHands } from "./typing-hands.js";
import { WalkHabits, walkStyles } from "./walk-life.js";

const closeupBackground = new Color("#e9e4da");
const keyScratch = new Vector3();
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

/** Light levels at full day and full night; dusk and dawn blend between them. */
const lighting = {
  day: { hemisphere: 1.5, sun: 2.3, windowFill: 0.55, neonGlow: 0, exposure: 1.05 },
  night: { hemisphere: 0.32, sun: 0.25, windowFill: 0.12, neonGlow: 2.2, exposure: 0.95 },
} as const;
const sunDay = new Color(0xfff2e2);
const sunNight = new Color(0x9fb0ff);

/**
 * `?clock=21:30` on the office page previews another time of day; otherwise the PC clock decides.
 * Handy for checking night mode without waiting for the evening.
 */
function officeClock(): () => Date {
  const preview = /^(\d{1,2}):(\d{2})$/.exec(new URLSearchParams(window.location.search).get("clock") ?? "");
  if (preview === null) {
    return () => new Date();
  }
  return () => {
    const date = new Date();
    date.setHours(Number(preview[1]), Number(preview[2]), 0, 0);
    return date;
  };
}

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
  props: HandProps;
  /** The avatar's wrist bones, which hand props follow. */
  hands: Record<ArmSide, Object3D | null>;
  mug: MugState;
  /** Fingertips over the member's own keyboard; made on first use, since only desk members type. */
  typingHands: TypingHands | null;
  mouseHabit: MouseHabit;
  /**
   * Where each hand's IK is aiming this frame, eased toward the work's target so a hand glides
   * from keys to mouse (or from its rest pose onto the keys) instead of jumping there.
   */
  reach: Record<ArmSide, Vector3 | null>;
  /** Which point of the hand the aim was for, kept while easing out after the work lets go. */
  reachTip: ArmTip;
  /** The last approach each finger came in along, kept for easing out the same way. */
  reachApproach: Record<ArmSide, Vector3>;
  /** 0..1, eased: how far into a step back from the board. */
  review: number;
  /** Meters to the member's left along the board, eased toward the goal. */
  sidestep: number;
  sidestepGoal: number;
  walkHabits: WalkHabits;
  deskHabits: DeskHabits;
  /** Which of its two squares the desk chess piece stands on, and the bit that last moved it. */
  chess: { square: 0 | 1; movedBy: number | null };
  /** How fast the IK aim eases, kept from the last target so letting go eases at the same pace. */
  reachRate: number;
  /** Who this member last waved at, to turn toward them during the wave. */
  greeted: MemberId | null;
}

/** World targets for the hands this frame; null leaves that arm to the pose. */
interface HandTargets {
  left: Vector3 | null;
  right: Vector3 | null;
  tip: ArmTip;
  /**
   * With a fingertip target, the way the finger points onto it. The wrist goes a hand's length
   * back along this line and the hand turns to point down it, so the palm stays clear of
   * whatever the finger touches instead of sinking into it.
   */
  approach: Vector3 | null;
  /** The pen on a board the member is working at, for the head and body to follow. */
  board: { pen: Vector3; reviewing: boolean } | null;
  /** How fast the hand eases onto the target; quick for keys and pens when absent. */
  rate?: number;
}

const noHandTargets: HandTargets = { left: null, right: null, tip: "wrist", approach: null, board: null };
/** Reaching for something on the desk is an unhurried move, not a keystroke. */
const deskReachRate = 7;
/** Fingers come down onto keys and the mouse at this angle below horizontal, in radians. */
const typingFingerPitch = 0.5;
/** The index finger bone ends at its last knuckle; the real fingertip reaches a little further. */
const fingertipBeyondBone = 0.006;
/** How far the hand comes off the board between strokes, in meters. */
const penLift = 0.07;
/** How far someone steps back from a board to look their drawing over. */
const reviewStepBack = 0.22;
/** The ball's trip: 0..1 from the west paddle to the east one, 1..2 back again. */
function rallyLeg(elapsed: number): number {
  return (elapsed * 1.1) % 2;
}

/** Where the rally is for one player: 0 when the ball reaches their paddle, wrapping at 1. */
export function pingpongBeat(elapsed: number, side: "west" | "east"): number {
  const contact = side === "west" ? 0 : 1;
  return ((((rallyLeg(elapsed) - contact) / 2) % 1) + 1) % 1;
}

/** Teammates closer than this while one of them walks by say hello. */
const greetDistance = 1.1;
/** Where a speech bubble's tail points: this far above the head bone, over the hair. */
const bubbleAboveHead = 0.3;

/** A line of small talk and where on screen its speaker's head is. */
export interface SpeechAnchor {
  memberId: MemberId;
  text: string;
  x: number;
  y: number;
  shownFor: number;
}

/** Furthest a member shuffles along a board from their spot to follow the pen, in meters. */
const maxSidestep = 0.6;
/** How far the pen may wander from the comfortable spot before the member shuffles after it. */
const shuffleThreshold = 0.15;
/** Pen this far left of the body's center sits right in front of the right shoulder. */
const penAheadOfCenter = 0.05;
/** Per second: a step back or aside takes about half a second. */
const stepRate = 4;
const settleRate = 8;
/** Per second. Quick enough that typing strokes survive the easing, slow enough to glide. */
const reachRate = 28;
/** Close enough to the posed hand that letting go of IK is invisible. */
const releaseDistance = 0.004;
const armSides: readonly ArmSide[] = ["left", "right"];

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
/** Room the caption strip above the close-up takes, plus the gap below it. */
const closeupCaptionSpace = 34;
const closeupMargin = 16;
/** Space the HUD row (status, buttons) keeps at the bottom of the window. */
const hudReserve = 76;

/**
 * Where the close-up goes: docked on top of the chat panel, as wide as it, so your task and
 * the member doing it read as one column. Without the chat it takes the chat's place at the
 * bottom left. If the window is too short to stack both, it moves to the bottom right.
 */
export function closeupRect(viewWidth: number, viewHeight: number, chat: CloseupRect | null): CloseupRect {
  if (chat !== null) {
    const width = Math.round(chat.width);
    const height = Math.round(width * 0.62);
    const y = Math.round(chat.y - 8 - height);
    if (y - closeupCaptionSpace >= closeupMargin) {
      return { x: Math.round(chat.x), y, width, height };
    }
  }
  const width = Math.round(Math.min(380, viewWidth * 0.42));
  const height = Math.round(width * 0.62);
  const x = chat === null ? closeupMargin : viewWidth - width - closeupMargin;
  return { x, y: viewHeight - height - hudReserve, width, height };
}

/** Small on purpose: a face above the dialog, not a second companion. */
export const portraitSize = { width: 150, height: 180 } as const;
/** How far the dialog covers the bottom of the portrait, like a visual-novel bust. */
const portraitOverlap = 14;
const portraitInset = 16;

export interface TeamDialogDock {
  dialog: { x: number; y: number; width: number };
  portrait: { x: number; y: number };
}

/**
 * The team conversation sits in the top right, away from the chat and close-up on the left:
 * the speaker's portrait at the top, the dialog right under it covering the portrait's chest.
 */
export function teamDialogDock(viewWidth: number): TeamDialogDock {
  const width = Math.round(Math.min(380, viewWidth * 0.42));
  const x = viewWidth - width - closeupMargin;
  const portraitY = closeupMargin;
  return {
    dialog: { x, y: portraitY + portraitSize.height - portraitOverlap, width },
    portrait: { x: x + width - portraitSize.width - portraitInset, y: portraitY },
  };
}

/** Close-up captions are in English, like the window titles; dialog lines stay in the cast's own voice. */
const actionLabels: Record<OfficeAction, string> = {
  type: "typing",
  "desk-idle": "taking it easy",
  stretch: "done",
  draw: "drawing on the board",
  read: "reading",
  stick: "pinning ideas",
  ponder: "thinking",
  cheer: "done",
  wave: "calling you",
  relax: "relaxing",
  watch: "watching TV",
  game: "gaming",
  brew: "making coffee",
  snack: "snacking",
  arcade: "playing arcade",
  water: "watering plants",
  lounge: "lounging",
  selfie: "taking a selfie",
  rack: "checking the servers",
  chat: "chatting",
  meeting: "in a meeting",
  pingpong: "playing ping-pong",
  wash: "washing up",
  oven: "heating food",
  "pingpong-wait": "waiting for a ping-pong partner",
};

export class OfficeStage {
  private composer: EffectComposer | null = null;
  private readonly chatter = new ChatterDirector();
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, 1.6, 0.1, 120);
  private readonly closeupCamera = new PerspectiveCamera(38, 1.6, 0.05, 30);
  private readonly controls: OrbitControls;
  private readonly timer = new Timer();
  private readonly office = buildOffice();
  private readonly life = new OfficeLife(Math.random, (station) => this.stationCrowded(station));
  private readonly rigs: Record<MemberId, MemberRig>;

  private team: TeamRuntime = emptyTeamRuntime();
  private twobReaction: Reaction = idleReaction(Date.now());
  private elapsed = 0;
  private closeupEnabled = true;
  private focus: CloseupFocus | null = null;
  /**
   * The last close-up, frozen while the hold runs out: the camera stays where the work happened
   * (the board, the desk) with its label, instead of following the member down the hallway.
   */
  private heldFocus: { focus: CloseupFocus; shot: CloseupShot; until: number } | null = null;
  private lastInputAt = Date.now();
  private driftPhase = 0;
  private night = 0;
  /** Set by the page every frame from where the chat panel sits. */
  private closeupLayout: CloseupRect | null = null;
  private lastDaylightAt = 0;
  private readonly clock = officeClock();
  private readonly hemisphere = new HemisphereLight(0xfff8ee, 0xb7a68a, lighting.day.hemisphere);
  private readonly sun = new DirectionalLight(sunDay, lighting.day.sun);
  private readonly windowFill = new DirectionalLight(0xdfeaff, lighting.day.windowFill);
  /** Purple wash from the neon onto floor and walls, only noticeable once it is dark. */
  private readonly neonGlow = [new PointLight(0xb45cff, 0, 9, 1.6), new PointLight(0x6f7fdc, 0, 9, 1.6)];

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

    const sun = this.sun;
    sun.position.set(6, 11, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 9;
    sun.shadow.camera.bottom = -9;
    sun.shadow.bias = -0.0004;
    // Cool fill from the back windows, so faces at the back-row desks are not lit by the sun alone.
    this.windowFill.position.set(0, 4, -10);
    const [backGlow, sideGlow] = this.neonGlow as [PointLight, PointLight];
    backGlow.position.set(0, 1.6, -4.3);
    sideGlow.position.set(-6.3, 1.6, 0);
    this.scene.add(this.hemisphere, sun, this.windowFill, backGlow, sideGlow, this.office.root);
    this.applyDaylight();

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

    if (sceneQuality() === "high") {
      this.composer = this.createComposer();
    }
    window.addEventListener("resize", () => this.resize());
    this.resize();
    this.resetView();
    this.renderer.setAnimationLoop((timestamp) => this.frame(timestamp));
  }

  private opponentReady(memberId: MemberId): boolean {
    const partner = this.life.partnerOf(memberId);
    if (partner === null) {
      return false;
    }
    const actor = this.rigs[partner].actor;
    return !isWalking(actor) && actor.target.startsWith("pingpong-");
  }

  /** Someone stands at, or is still leaving, this station's spot or the place you step in from. */
  private stationCrowded(station: StationId): boolean {
    // The life planner runs while the rigs are still being created.
    if (this.rigs === undefined) {
      return false;
    }
    const { spot, approach } = stations[station];
    return memberIds.some((memberId) => {
      const position = this.rigs[memberId]?.actor.position;
      return position !== undefined && (distance(position, spot) < 0.8 || distance(position, approach) < 0.5);
    });
  }

  /** Swaps a member's avatar, for example from placeholder to their real VRM. */
  setAvatar(memberId: MemberId, avatar: OfficeAvatar): void {
    const rig = this.rigs[memberId];
    rig.avatar.dispose();
    rig.avatar = avatar;
    rig.poseApplier.reset();
    rig.expressions = {};
    rig.hands = this.wrists(avatar);
    rig.reach = { left: null, right: null };
    avatar.addHairColliders(this.office.hairColliders);
    this.scene.add(avatar.root);
  }

  private wrists(avatar: OfficeAvatar): Record<ArmSide, Object3D | null> {
    return {
      left: avatar.arm("left", "wrist")?.effector ?? null,
      right: avatar.arm("right", "wrist")?.effector ?? null,
    };
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

  /** After a stopped run: members leave their desks and the close-up closes until the next task. */
  endAllRuns(now: number): void {
    this.team = endAllRuns(this.team, now);
    this.heldFocus = null;
  }

  setCloseupLayout(rect: CloseupRect): void {
    this.closeupLayout = rect;
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
    return Math.min(viewLimits.maxDistance, 15 * Math.max(1, 1.6 / aspect));
  }

  private createRig(memberId: MemberId, avatar: OfficeAvatar): MemberRig {
    const plan = this.planFor(memberId, Date.now(), null);
    const props = new HandProps();
    this.scene.add(avatar.root, props.root);
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
      props,
      hands: this.wrists(avatar),
      mug: initialMug,
      typingHands: null,
      mouseHabit: new MouseHabit(this.elapsed),
      reach: { left: null, right: null },
      reachTip: "wrist",
      reachApproach: { left: new Vector3(0, -1, 0), right: new Vector3(0, -1, 0) },
      review: 0,
      sidestep: 0,
      sidestepGoal: 0,
      walkHabits: new WalkHabits(this.elapsed),
      deskHabits: new DeskHabits(deskBits[memberId]),
      chess: { square: 0, movedBy: null },
      reachRate,
      greeted: null,
    };
  }

  /**
   * High quality: ambient occlusion darkens where surfaces meet (under desks, between cushions,
   * along walls), which is what makes the room read as solid. The frame stays transparent through
   * every pass, so the page color shows behind the room exactly as without post-processing; a
   * scene background would go through tone mapping and come out grayer than the page.
   */
  private createComposer(): EffectComposer {
    // The canvas's own antialiasing does not apply to offscreen targets, so they get their own.
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
    const composer = new EffectComposer(this.renderer, target);
    composer.addPass(new RenderPass(this.scene, this.camera));
    const ao = new GTAOPass(this.scene, this.camera, 512, 512);
    ao.blendIntensity = 0.85;
    // Room-sized radius: a chibi desk is under a meter, so a wide radius would gray whole walls.
    ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1, scale: 1 });
    composer.addPass(ao);
    composer.addPass(new OutputPass());
    return composer;
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer?.setSize(width, height);
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
  private updateSurface(memberId: MemberId, rig: MemberRig, delta: number): HandTargets {
    const action = rig.action;
    if (memberId in this.office.workstations) {
      const { screen, keyboard, mouse } = this.office.workstations[memberId as DeskMember];
      const typing = action === "type" && rig.plan.station === `desk-${memberId}`;
      // The text stops while the right hand is off the keys.
      const mousing = rig.mouseHabit.using(this.elapsed, typing);
      const typed = screen.update(delta, typing && !mousing);
      rig.typingHands ??= new TypingHands({ left: keyboard.keyTop("f"), right: keyboard.keyTop("j") });
      const hands = rig.typingHands;
      for (const character of typed) {
        keyboard.press(character);
        hands.strike(handForKey(character), keyboard.keyTop(character, keyScratch));
      }
      rig.keystrokes += typed.length;
      keyboard.update(delta);
      hands.update(delta);
      mouse.update(delta, mousing);
      if (typing) {
        return {
          left: keyboard.root.localToWorld(hands.fingertip("left", new Vector3())),
          right: mousing
            ? mouse.gripPoint(new Vector3())
            : keyboard.root.localToWorld(hands.fingertip("right", new Vector3())),
          tip: "fingertip",
          approach: this.fingersDown(rig),
          board: null,
        };
      }
    }

    let pen: PenState | null = null;
    if (memberId === "rias") {
      pen = this.office.whiteboard.update(1, delta, action === "draw");
    } else if (memberId === "twob") {
      pen = this.office.whiteboard.update(0, delta, action === "draw");
    } else if (memberId === "chizuru") {
      const note = this.office.ideaBoard.update(delta, action === "stick");
      pen = note === null ? null : { at: note, touching: true, reviewing: false };
    }
    if (pen === null || action === null || !usesHandIk(action)) {
      return noHandTargets;
    }
    const [u, v] = pen.at;
    const onBoard = memberId === "chizuru" ? this.office.ideaBoardPoint(u, v) : this.office.whiteboardPoint(u, v);
    const board = { pen: onBoard, reviewing: pen.reviewing };
    if (pen.reviewing) {
      // Hands down while looking it over; the arm eases back to the pose.
      return { left: null, right: null, tip: "wrist", approach: null, board };
    }
    // The marker tip on the board, the hand pointing straight at it; between strokes the whole
    // hand comes off, the way a pen lifts away.
    const right = onBoard.clone();
    const { position } = rig.actor;
    const away = new Vector3(position.x - right.x, 0, position.z - right.z);
    if (away.lengthSq() < 1e-6) {
      return { left: null, right, tip: "wrist", approach: null, board };
    }
    away.normalize();
    right.addScaledVector(away, pen.touching ? 0 : penLift);
    return { left: null, right, tip: "fingertip", approach: away.negate(), board };
  }

  /**
   * Eases each hand's IK aim toward its target and solves the arm onto it. When the work lets go
   * of a hand, the aim eases back to where the pose holds it before IK lets go, so it never snaps.
   */
  private reachFor(rig: MemberRig, targets: HandTargets, delta: number): void {
    if (targets.left !== null || targets.right !== null) {
      rig.reachRate = targets.rate ?? reachRate;
    }
    const blend = 1 - Math.exp(-rig.reachRate * delta);
    for (const side of armSides) {
      const target = targets[side];
      const current = rig.reach[side];
      if (target === null && current === null) {
        continue;
      }
      if (target !== null) {
        rig.reachTip = targets.tip;
        if (targets.approach !== null) {
          rig.reachApproach[side].copy(targets.approach);
        }
      }
      const arm = rig.avatar.arm(side, "wrist");
      const hand = rig.reachTip === "fingertip" ? rig.avatar.hand(side) : null;
      if (arm === null) {
        rig.reach[side] = null;
        continue;
      }
      rig.avatar.syncPose();
      const posed = (hand?.tip ?? arm.effector).getWorldPosition(new Vector3());
      const aim = current ?? posed.clone();
      rig.reach[side] = aim;
      if (target === null) {
        aim.lerp(posed, blend);
        if (aim.distanceTo(posed) < releaseDistance) {
          rig.reach[side] = null;
          continue;
        }
      } else {
        aim.lerp(target, blend);
      }
      if (hand === null) {
        solveCcd(arm, aim);
        continue;
      }
      const length =
        hand.tip.getWorldPosition(new Vector3()).distanceTo(hand.pivot.getWorldPosition(new Vector3())) +
        fingertipBeyondBone;
      const wrist = aim.clone().addScaledVector(rig.reachApproach[side], -length);
      solveCcd(arm, wrist);
      aimHand(hand, aim);
    }
  }

  /** Forward from the member and tipped down, the way fingers come onto a keyboard or mouse. */
  private fingersDown(rig: MemberRig): Vector3 {
    const yaw = rig.avatar.root.rotation.y;
    const flat = Math.cos(typingFingerPitch);
    return new Vector3(Math.sin(yaw) * flat, -Math.sin(typingFingerPitch), Math.cos(yaw) * flat);
  }

  /**
   * At a board the body follows the pen: a sidestep along the board toward where it is writing,
   * a step back while looking the drawing over. Returns the pen for the head and shoulders to track.
   */
  private boardFocus(rig: MemberRig, targets: HandTargets, delta: number): BoardFocus | null {
    const { root } = rig.avatar;
    const board = targets.board;
    if (board === null) {
      rig.sidestepGoal = 0;
    } else {
      root.updateMatrixWorld();
      // The writing hand is the right one, a little right of center: keep the pen just in front of it.
      const wanted = root.worldToLocal(board.pen.clone()).x + penAheadOfCenter;
      // People write a few words, then shuffle over; they do not glide along with every letter.
      if (Math.abs(wanted - rig.sidestepGoal) > shuffleThreshold) {
        rig.sidestepGoal = Math.max(-maxSidestep, Math.min(maxSidestep, wanted));
      }
    }
    // Leaving the board, the offsets settle fast so the walk away starts from the real spot.
    const rate = board === null ? settleRate : stepRate;
    const ease = 1 - Math.exp(-rate * delta);
    rig.sidestep += (rig.sidestepGoal - rig.sidestep) * ease;
    rig.review += ((board?.reviewing === true ? 1 : 0) - rig.review) * ease;
    const yaw = root.rotation.y;
    // The avatar faces +z at yaw 0, so its left is +x and its back is -z, both turned by the yaw.
    root.position.x += Math.cos(yaw) * rig.sidestep - Math.sin(yaw) * reviewStepBack * rig.review;
    root.position.z += -Math.sin(yaw) * rig.sidestep - Math.cos(yaw) * reviewStepBack * rig.review;
    if (board === null) {
      return null;
    }
    root.updateMatrixWorld();
    const local = root.worldToLocal(board.pen.clone());
    const stepping = Math.min(1, Math.abs(rig.sidestepGoal - rig.sidestep) / 0.1);
    return { x: local.x, y: local.y, z: local.z, review: rig.review, stepping };
  }

  private updateMember(memberId: MemberId, delta: number, now: number): void {
    const rig = this.rigs[memberId];
    const plan = this.planFor(memberId, now, rig);
    rig.plan = plan;
    const previousTarget = rig.actor.target;
    const wasAt = isWalking(rig.actor) ? null : previousTarget;
    const otherRigs = memberIds.filter((other) => other !== memberId).map((other) => this.rigs[other].actor);
    const others = otherRigs.map((actor) => actor.position);
    const standing = otherRigs.filter((actor) => !isWalking(actor)).map((actor) => actor.position);
    rig.actor = stepActor(rig.actor, plan.station, delta, others, standing);
    const walking = isWalking(rig.actor);
    const arrived = !walking && rig.actor.target === plan.station;
    if (arrived) {
      this.life.arrived(memberId, now);
    }
    this.updateMug(memberId, rig, arrived, rig.actor.target === previousTarget ? null : wasAt);
    let action = walking ? null : plan.action;
    if (action === "pingpong" && !this.opponentReady(memberId)) {
      // The rally starts when the other player is at the table, not while they are still walking.
      action = "pingpong-wait";
    }
    if (action !== rig.action) {
      rig.action = action;
      rig.actionStartedAt = this.elapsed;
    }

    const atOwnDesk = action === "desk-idle" && plan.station === `desk-${memberId}`;
    const deskBit = rig.deskHabits.update(this.elapsed, atOwnDesk);
    this.updateDeskItems(memberId, rig, deskBit);
    const surfaceTargets = this.updateSurface(memberId, rig, delta);
    const handTargets =
      surfaceTargets === noHandTargets && deskBit !== null
        ? this.deskBitTargets(memberId, rig, deskBit)
        : surfaceTargets;
    // Offset each member's idle loops so the room does not move in lockstep.
    const phaseOffset = memberIds.indexOf(memberId) * 1.7;

    const { avatar, actor } = rig;
    avatar.root.position.set(actor.position.x, 0, actor.position.z);
    avatar.root.rotation.y = actor.yaw;
    const seatHeight = stations[plan.station].seatHeight;
    const board = this.boardFocus(rig, handTargets, delta);
    const gimmick = rig.walkHabits.update(this.elapsed, action === null, rig.mug.inHand);
    const pose = officePose({
      action,
      walkPhase: actor.walkPhase,
      time: this.elapsed + phaseOffset,
      actionElapsed: this.elapsed - rig.actionStartedAt,
      seat: action === null || seatHeight === null ? null : fitSeat(avatar.legs, seatHeight),
      keystrokes: rig.keystrokes,
      carrying: rig.mug.inHand,
      board,
      walkStyle: walkStyles[memberId],
      gimmick,
      chatter: this.chatter.reactionOf(memberId),
      chatGesture: this.chatter.gestureOf(memberId),
      lookYaw: this.lookYawFor(memberId, rig, gimmick?.kind === "wave"),
      pingpongBeat:
        action === "pingpong" && this.office.pingpongBall.visible
          ? pingpongBeat(this.elapsed, rig.actor.target === "pingpong-west" ? "west" : "east")
          : null,
      deskBit,
    });
    rig.poseApplier.apply(avatar.poseTarget, pose, delta);

    this.reachFor(rig, handTargets, delta);

    const reaction = this.chatter.reactionOf(memberId);
    // The mouth during a bit moves too fast to ease, so it is kept apart from the eased face.
    const { aa: bitMouth, ...bitFace } = (deskBit === null ? null : deskBitFace(deskBit, this.elapsed)) ?? {};
    const moodTargets = { ...expressionTargetsForMood(plan.mood), ...bitFace };
    const targets =
      reaction === "laugh"
        ? { ...moodTargets, happy: 1 }
        : reaction === "acknowledge"
          ? { ...moodTargets, happy: 0.6 }
          : moodTargets;
    rig.expressions = stepExpressionWeights(rig.expressions, targets, delta);
    const happy = rig.expressions.happy ?? 0;
    // The mouth flaps while a line is up; too quick for the eased weights, so it is added on top.
    const talking = this.chatter.speechOf(memberId) !== null;
    // Talking into the mic or chewing is as quick as speech, so it goes on top the same way.
    const shown = talking
      ? { ...rig.expressions, aa: 0.45 * Math.abs(Math.sin((this.elapsed + phaseOffset) * 11)) }
      : bitMouth !== undefined
        ? { ...rig.expressions, aa: bitMouth }
        : rig.expressions;
    avatar.setExpressions(shown, rig.blink.weightAt(this.elapsed + phaseOffset) * (1 - happy));
    avatar.update(delta);

    // Board work needs the hand free; otherwise the action's own prop wins over a carried mug.
    const onPhone = gimmick?.kind === "phone" ? "phone" : null;
    const plate = action === "oven" && ovenStep(this.elapsed - rig.actionStartedAt).plateInHand ? "plate" : null;
    const fromDesk = deskBit === null ? null : deskBitProp(deskBit);
    const held =
      action !== null && usesHandIk(action)
        ? null
        : (fromDesk ?? plate ?? propForAction(action) ?? (rig.mug.inHand ? "mug" : onPhone));
    rig.props.show(held, fromDesk !== null && deskBit !== null ? deskBitSpec(deskBit.kind).hand : "right");
    rig.props.follow(rig.hands, actor.yaw);
  }

  /**
   * Pairs at the bar or the pantry talk; anyone walking past a teammate on a break waves and
   * says hello.
   */
  private updateChatter(delta: number): void {
    const settledAt = (station: StationId, action: OfficeAction): MemberId | null =>
      memberIds.find((memberId) => {
        const rig = this.rigs[memberId];
        return rig.action === action && rig.actor.target === station && !isWalking(rig.actor);
      }) ?? null;
    const pairs: [MemberId, MemberId][] = [];
    const barLeft = settledAt("bar-left", "chat");
    const barRight = settledAt("bar-right", "chat");
    if (barLeft !== null && barRight !== null) {
      pairs.push([barLeft, barRight]);
    }
    const brewing = settledAt("coffee", "brew");
    const snacking = settledAt("fridge", "snack");
    if (brewing !== null && snacking !== null) {
      pairs.push([brewing, snacking]);
    }
    this.chatter.update(this.elapsed, delta, pairs);

    for (const [index, first] of memberIds.entries()) {
      for (const second of memberIds.slice(index + 1)) {
        const a = this.rigs[first];
        const b = this.rigs[second];
        const someoneWalking = isWalking(a.actor) || isWalking(b.actor);
        if (!someoneWalking || a.wasWorking || b.wasWorking) {
          continue;
        }
        if (distance(a.actor.position, b.actor.position) > greetDistance) {
          continue;
        }
        if (!this.chatter.greet(first, second, this.elapsed)) {
          continue;
        }
        for (const [rig, other] of [
          [a, second],
          [b, first],
        ] as const) {
          rig.greeted = other;
          if (isWalking(rig.actor)) {
            rig.walkHabits.wave(this.elapsed);
          }
        }
      }
    }
  }

  /** Head turn toward a conversation partner, or toward whoever is being waved at. */
  private lookYawFor(memberId: MemberId, rig: MemberRig, waving: boolean): number {
    const other = waving ? rig.greeted : this.chatter.partnerOf(memberId);
    if (other === null) {
      return 0;
    }
    // In conversation the turn follows the gaze: the opener looks over first, the other after.
    const weight = waving ? 1 : this.chatter.gazeOf(memberId);
    const target = this.rigs[other].actor.position;
    const { position, yaw } = rig.actor;
    const toward = Math.atan2(target.x - position.x, target.z - position.z);
    return angleDelta(yaw, toward) * weight;
  }

  /** Where each speech bubble goes on screen this frame. */
  speechAnchors(): SpeechAnchor[] {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const anchors: SpeechAnchor[] = [];
    for (const memberId of memberIds) {
      const speech = this.chatter.speechOf(memberId);
      const head = this.rigs[memberId].avatar.poseTarget.node("head");
      if (speech === null || head === null) {
        continue;
      }
      const point = head.getWorldPosition(new Vector3());
      point.y += bubbleAboveHead;
      point.project(this.camera);
      // Behind the camera or outside the view: no bubble pointing at nothing.
      if (point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1) {
        continue;
      }
      anchors.push({
        memberId,
        text: speech.text,
        x: ((point.x + 1) / 2) * width,
        y: ((1 - point.y) / 2) * height,
        shownFor: speech.shownFor,
      });
    }
    return anchors;
  }

  private updateMug(memberId: MemberId, rig: MemberRig, arrived: boolean, departedFrom: StationId | null): void {
    const workstation = memberId in this.office.workstations ? this.office.workstations[memberId as DeskMember] : null;
    rig.mug = stepMug(rig.mug, {
      desk: workstation === null ? null : (`desk-${memberId}` as StationId),
      target: rig.actor.target,
      arrived,
      departedFrom,
    });
    if (workstation !== null) {
      workstation.mug.visible = rig.mug.onDesk;
    }
  }

  /**
   * Things on the member's desk: hidden while in their hand, and the chess piece carried from one
   * square to the other. With no bit running everything is back in its place.
   */
  private updateDeskItems(memberId: MemberId, rig: MemberRig, bit: ActiveDeskBit | null): void {
    if (!(memberId in this.office.workstations)) {
      return;
    }
    const workstation = this.office.workstations[memberId as DeskMember];
    const held = bit !== null && itemInHand(bit) ? deskBitSpec(bit.kind).item : null;
    for (const [item, object] of Object.entries(workstation.items)) {
      // The teacup is also the desk mug, which may be away at the pantry.
      const home = object !== workstation.mug || rig.mug.onDesk;
      object.visible = home && item !== held;
    }
    const piece = workstation.items["chess-piece"];
    const squares = workstation.chessMove;
    if (piece === undefined || squares === null) {
      return;
    }
    const landed = squares[rig.chess.square];
    if (bit?.kind !== "chess" || rig.chess.movedBy === bit.startedAt) {
      piece.position.copy(landed);
      return;
    }
    const { along, lift } = chessCarry(bit);
    piece.position.lerpVectors(landed, squares[rig.chess.square === 0 ? 1 : 0], along);
    piece.position.y += 0.03 * lift;
    if (along >= 1) {
      rig.chess = { square: rig.chess.square === 0 ? 1 : 0, movedBy: bit.startedAt };
    }
  }

  /** Where the bit's hand goes: out to the item and back, or over the sticky pad while writing. */
  private deskBitTargets(memberId: MemberId, rig: MemberRig, bit: ActiveDeskBit): HandTargets {
    if (!(memberId in this.office.workstations)) {
      return noHandTargets;
    }
    const workstation = this.office.workstations[memberId as DeskMember];
    const spec = deskBitSpec(bit.kind);
    let target: Vector3 | null = null;
    if (reachingForItem(bit) && spec.item !== null) {
      target = workstation.items[spec.item]?.getWorldPosition(new Vector3()) ?? null;
    } else if (bit.kind === "plush-hug" || bit.kind === "console") {
      // Both hands meet in front of the chest, around the plush or on either side of the console.
      const { root } = rig.avatar;
      root.updateMatrixWorld();
      const hug = bit.kind === "plush-hug";
      const height = hug ? 0.5 : 0.45;
      const ahead = hug ? 0.1 : 0.15;
      const apart = hug ? 0.035 : 0.06;
      return {
        // The avatar faces +z with its left on +x.
        left: root.localToWorld(new Vector3(apart, height, ahead)),
        right: root.localToWorld(new Vector3(-apart, height, ahead)),
        tip: "wrist",
        approach: null,
        board: null,
        rate: deskReachRate,
      };
    } else if (bit.kind === "sticky" && workstation.writingPad !== null) {
      // Short words across the note, the marker lifting off between them.
      const t = bit.elapsed;
      const lift = Math.sin(t * 1.9) > 0.75 ? 0.025 : 0;
      target = workstation.writingPad.localToWorld(
        new Vector3(0.018 * Math.sin(t * 6.5), lift, 0.012 * Math.sin(t * 0.9) + 0.004 * Math.sin(t * 13)),
      );
    }
    if (target === null) {
      return noHandTargets;
    }
    return {
      left: spec.hand === "left" ? target : null,
      right: spec.hand === "right" ? target : null,
      tip: "fingertip",
      approach: this.fingersDown(rig),
      board: null,
      rate: deskReachRate,
    };
  }

  /** TV, arcade, rack, fridge and laptops react to whoever is using them, so the props look switched on by people. */
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
    this.updatePingpongBall(usingAt("pingpong-west", "pingpong") && usingAt("pingpong-east", "pingpong"));
    this.office.fridgeDoor.update(usingAt("fridge", "snack"), delta);
    this.office.sink.update(usingAt("sink", "wash"), this.elapsed);
    const cook = memberIds.find((memberId) => {
      const rig = this.rigs[memberId];
      return rig.action === "oven" && rig.plan.station === "oven";
    });
    const step = cook === undefined ? null : ovenStep(this.elapsed - this.rigs[cook].actionStartedAt);
    this.office.oven.update(step?.oven ?? "off", step?.foodInside ?? false, delta, this.elapsed);
    this.office.meetingLaptops.forEach((laptop, index) => {
      const seat = meetingStationIds[index];
      laptop.update(delta, seat !== undefined && usingAt(seat, "meeting") ? "on" : "off");
    });
  }

  /**
   * A rally while both players are at the table: the ball crosses in about a second, bounces
   * once on the receiver's half, and comes back. Its timing follows the swing cycle in the pose.
   */
  private updatePingpongBall(rally: boolean): void {
    const ball = this.office.pingpongBall;
    // Same clock as pingpongBeat, so the ball and the swings stay in step.
    ball.visible = rally;
    if (!rally) {
      return;
    }
    const west = stations["pingpong-west"].spot;
    const east = stations["pingpong-east"].spot;
    const leg = rallyLeg(this.elapsed);
    // 0..1 west to east, 1..2 back again; the ends stay just inside the paddles.
    const t = leg < 1 ? leg : 2 - leg;
    const fromX = west.x + 0.3;
    const toX = east.x - 0.3;
    // Two hops per crossing: one over the net, one off the receiver's half.
    const hop = Math.abs(Math.sin(t * Math.PI * 2));
    ball.position.set(fromX + (toX - fromX) * t, surface.pingpong + 0.02 + 0.16 * hop, west.z);
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
    if (best === null) {
      if (this.heldFocus !== null && now < this.heldFocus.until) {
        return this.heldFocus.focus;
      }
      this.heldFocus = null;
      return null;
    }
    const rig = this.rigs[best.memberId];
    const profile = roster[best.memberId];
    const activity = rig.action === null ? "walking" : actionLabels[rig.action];
    const tool = best.memberId === "twob" ? null : this.team[best.memberId].lastTool;
    const label = `${profile.displayName} · ${profile.role} · ${activity}${tool === null ? "" : ` (${tool})`}`;
    const focus = { memberId: best.memberId, label };
    this.heldFocus = { focus, shot: this.liveShot(best.memberId), until: now + closeupHoldMs };
    return focus;
  }

  /** The held shot while the hold runs, otherwise the member's live shot. */
  private closeupShotFor(memberId: MemberId): CloseupShot {
    const held = this.heldFocus;
    return held !== null && held.focus.memberId === memberId ? held.shot : this.liveShot(memberId);
  }

  private liveShot(memberId: MemberId): CloseupShot {
    if (memberId === "twob" && this.rigs.twob.action === "draw") {
      return twobBoardShot(this.office);
    }
    return this.office.closeups[memberId];
  }

  /** Dims the room toward night and lets the neon take over, following the clock. */
  private applyDaylight(): void {
    const night = nightFactor(this.clock());
    const mix = (key: keyof typeof lighting.day): number =>
      lighting.day[key] + (lighting.night[key] - lighting.day[key]) * night;
    this.hemisphere.intensity = mix("hemisphere");
    this.sun.intensity = mix("sun");
    this.sun.color.copy(sunDay).lerp(sunNight, night);
    this.windowFill.intensity = mix("windowFill");
    for (const light of this.neonGlow) {
      light.intensity = mix("neonGlow");
    }
    this.renderer.toneMappingExposure = mix("exposure");
    this.office.setNight(night);
    this.night = night;
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

    this.updateChatter(delta);
    for (const memberId of memberIds) {
      this.updateMember(memberId, delta, now);
    }
    this.updateProps(delta);
    if (now - this.lastDaylightAt > 1000) {
      this.lastDaylightAt = now;
      this.applyDaylight();
    }
    this.office.neon.update(this.elapsed, this.night);
    this.focus = this.chooseFocus(now);
    this.drift(delta, now);
    this.controls.update(delta);

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, width, height);
    if (this.composer !== null) {
      this.composer.render(delta);
    } else {
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
    }

    if (this.closeupEnabled && this.focus !== null) {
      const rect = this.closeupLayout ?? closeupRect(width, height, null);
      const shot = this.closeupShotFor(this.focus.memberId);
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
