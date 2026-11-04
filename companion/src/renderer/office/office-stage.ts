import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  HalfFloatType,
  HemisphereLight,
  type Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PointLight,
  Raycaster,
  Scene,
  Spherical,
  SRGBColorSpace,
  Timer,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { defaultDisplaySettings, type OfficeDisplaySettings } from "../../shared/display-settings.js";
import { idleReaction, type MemberSignal, type Reaction } from "../../shared/reaction.js";
import type { OfficeSoundSettings } from "../../shared/sound-settings.js";
import { type MemberId, memberIds, roster } from "../../shared/team.js";
import {
  BlinkScheduler,
  type ExpressionWeights,
  expressionTargetsForMood,
  stepExpressionWeights,
} from "../common/expressions.js";
import { memberLooks } from "../common/looks.js";
import { PoseApplier } from "../common/pose.js";
import { crouchAmount, crouchDepth, crouchSeconds, petDistance, petStandSpot } from "./alyx-crouch.js";
import { AlyxHands, waveSeconds } from "./alyx-hands.js";
import { type AlyxMeal, eatLift, pieceLeft, stepMeal } from "./alyx-meal.js";
import {
  courierAtDoor,
  dropOrder,
  type FoodOrder,
  orderFood,
  orderStatus,
  pickUpOrder,
  stepOrder,
} from "./alyx-order.js";
import { type AlyxTarget, pickableItems, pickTarget } from "./alyx-targets.js";
import type { ArmSide, ArmTip, OfficeAvatar } from "./avatar.js";
import { bossLine } from "./boss-greetings.js";
import {
  type ActiveDeskBit,
  chessCarry,
  DeskHabits,
  type DeskItem,
  deskBitFace,
  deskBitProp,
  deskBitSpec,
  deskBits,
  itemInHand,
  reachingForItem,
  reachSeconds,
} from "./desk-habits.js";
import { eyeHeight, FirstPerson, firstPersonFov } from "./first-person.js";
import type { PickerView } from "./food-picker.js";
import { gpuLabel, paceFrame } from "./frame-rate.js";
import { FreeCamera } from "./free-camera.js";
import { Handoffs, type Teammate } from "./handoffs.js";
import { aimHand, solveCcd, withinReach } from "./ik.js";
import { type ActorState, angleDelta, initialActor, isWalking, stepActor } from "./office-actor.js";
import {
  afterMeal,
  bowlSpot,
  Cat,
  type CatChoice,
  type CatSpotId,
  catLine,
  catName,
  catSpots,
  greetingsForCat,
  hungerSeconds,
  keyboardLines,
  nextCatPlan,
  refillLines,
} from "./office-cat.js";
import { ChatterDirector } from "./office-chatter.js";
import {
  type HandPropKind,
  type MemberPlan,
  memberPlan,
  type OfficeAction,
  ovenStep,
  propForAction,
  twobPlan,
  usesHandIk,
} from "./office-director.js";
import { doorwayReturnSeconds, doorwayWalk } from "./office-doorway.js";
import {
  type BarFood,
  binBox,
  canBuy,
  deliver,
  drinkKinds,
  type FoodKind,
  foodNames,
  initialFood,
  openBox,
  piecesOnOffer,
  setDownOrder,
  takePiece,
} from "./office-food.js";
import {
  deskLock,
  type LaptopView,
  laptopPutSeconds,
  laptopTakeSeconds,
  laptopView,
  lockAt,
  signedInAt,
  signInFrom,
} from "./office-laptop.js";
import { type Errand, type LifeChoice, OfficeLife } from "./office-life.js";
import { afterSip, initialMug, type MugState, mugPickSeconds, stepMug } from "./office-mug.js";
import { navGrid } from "./office-nav.js";
import {
  arcadeStationIds,
  barFoodSpot,
  distance,
  floorHeightAt,
  furniture,
  meetingStationIds,
  type Point,
  room,
  type StationId,
  standupStationIds,
  stations,
  surface,
  treadmillStationIds,
} from "./office-plan.js";
import { type BoardFocus, bossWaveWindow, officePose, pingpongSwing } from "./office-pose.js";
import { officeDay, ritualFor, standupTurn, standupTurnSeconds } from "./office-rituals.js";
import { buildOffice, type CloseupShot, type DeskMember, twobBoardShot } from "./office-scene.js";
import { OfficeSound, rallyHits } from "./office-sound.js";
import { atJakartaTime, clockFace, type DayPart, dayPart, jakartaHours, jakartaTime, skyAt } from "./office-time.js";
import { PlaceholderAvatar } from "./placeholder.js";
import { CatBowl, OfficeCat } from "./scene/cat.js";
import { DeskEffects } from "./scene/desk-effects.js";
import { drawerTravel, memberPropLooks } from "./scene/desks.js";
import { HandProps, handPropModel, setCupFill } from "./scene/hand-props.js";
import { sceneQuality } from "./scene/palette.js";
import { type BadgeKind, StatusBadge, toolKind } from "./scene/status-badge.js";
import { fitSeat } from "./seating.js";
import { type Presence, rowDetail, type StatusRow, statusLabels, statusRows, TwobStatus } from "./status-board.js";
import type { PenState } from "./surfaces/board-pen.js";
import { widgetFor } from "./surfaces/work-widget.js";
import {
  applyMemberSignal,
  doneDurationMs,
  emptyTeamRuntime,
  endAllRuns,
  type MemberBehavior,
  memberBehavior,
  type TeamRuntime,
} from "./team-state.js";
import { handForKey, MouseHabit, TypingHands } from "./typing-hands.js";
import { WalkHabits, walkStyles } from "./walk-life.js";
import { type ActiveWorkBeat, beatHands, WorkBeats } from "./work-beats.js";

const closeupBackground = new Color("#e9e4da");
const keyScratch = new Vector3();
/** Keeps the close-up on the last worker a little after they finish, so the "done" moment is visible. */
const closeupHoldMs = 3500;

/** Orbit target: the middle of the floor, a little toward the back where the desks are. */
const viewTarget = new Vector3(2.7, 0.3, -1.1);
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

/**
 * Light levels at full day and full night; dusk and dawn blend between them. At night the office
 * lights are on, so the room stays bright and only the sun and the window light drop away.
 */
const lighting = {
  day: { hemisphere: 1.5, sun: 2.3, windowFill: 0.55, neonGlow: 0, exposure: 1.05 },
  night: { hemisphere: 1.05, sun: 0.35, windowFill: 0.12, neonGlow: 2.2, exposure: 1.0 },
} as const;
const sunDay = new Color(0xfff2e2);
const sunTwilight = new Color(0xffa36b);
const sunNight = new Color(0x9fb0ff);
/** Ceiling light at night is a warmer white than the daylight it replaces. */
const roomDay = new Color(0xfff8ee);
const roomNight = new Color(0xffe9cf);

/**
 * `?clock=21:30` on the office page previews another Jakarta time of day; otherwise it is now.
 * Handy for checking night mode without waiting for the evening.
 */
function officeClock(): () => Date {
  const preview = /^(\d{1,2}):(\d{2})$/.exec(new URLSearchParams(window.location.search).get("clock") ?? "");
  if (preview === null) {
    return () => new Date();
  }
  // The preview keeps ticking from the chosen time, so the wall clock still moves.
  const offset = atJakartaTime(Number(preview[1]), Number(preview[2])).getTime() - Date.now();
  return () => new Date(Date.now() + offset);
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
  /** Walking a brief or report over, or handing it over: the break plan waits until it is done. */
  inHandoff: boolean;
  props: HandProps;
  /** The avatar's wrist bones, which hand props follow. */
  hands: Record<ArmSide, Object3D | null>;
  /** Where the member's laptop is in a meeting run, and how its lid and screen look. */
  laptop: LaptopView;
  /** The sip bit already taken out of the mug, so one bit drinks once. */
  sippedIn: number | null;
  /** How high the floor under the member is, eased: up on a board step, or on the floor. */
  lift: number;
  /** Fingertips over the member's own keyboard; made on first use, since only desk members type. */
  typingHands: TypingHands | null;
  mouseHabit: MouseHabit;
  /** Moments between keystrokes at the desk: chin in hand, a lean, a glance, a stretch, a fist pump. */
  workBeats: WorkBeats;
  workBeat: ActiveWorkBeat | null;
  /** How the member's real work stood last frame, to catch the moment it finishes. */
  behavior: MemberBehavior;
  /** Keystrokes until the next bit of code floats up off the keyboard. */
  glyphIn: number;
  /** Over the head while working: the tool in use, then a check mark. */
  badge: StatusBadge;
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
  food: FoodHands;
}

/** The shared food in a member's hands, and the empty box they still have to bin. */
interface FoodHands {
  /** The piece being eaten at the bar. */
  piece: FoodKind | null;
  /** The eating step the piece came from, so one step takes one piece. */
  pieceStep: number | null;
  /** Carrying the empty box to the bin. */
  box: boolean;
  /** Took the last piece; the box is theirs to bin. */
  owesBin: boolean;
  /** Back from outside with fresh food, on the way to the bar. */
  bag: boolean;
}

/** Seconds at the bar before a piece is in the hand, matching the eating pose's reach. */
const pieceTakeSeconds = 0.8;
/** Seconds into an errand at the bar or the bin when the box or the bag is set down or picked up. */
const foodHandoverSeconds = 0.7;
/** The door stands open while someone is this close to it. */
const doorOpenDistance = 1.1;
/** Where the courier leaves Alyx's order: on the mat inside the door, beside the way in. */
const deliveryBagSpot = { x: 10.15, z: -0.15 };
/** Held props for a piece of each food. */
const pieceProps: Record<FoodKind, HandPropKind> = {
  pizza: "pizza-slice",
  taco: "taco",
  sandwich: "sandwich",
  burger: "burger",
  dimsum: "dumpling",
  waffle: "waffle",
  cookies: "cookie",
  platter: "platter-bite",
  soda: "soda-can",
  frappe: "frappe-cup",
  coffee: "coffee-cup",
  carton: "carton",
};

const trashBin = furniture.find((piece) => piece.kind === "trash-bin");

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
/** How fast someone steps up onto a board step or down off it. */
const stepUpRate = 9;
/** Reaching for something on the desk is an unhurried move, not a keystroke. */
const deskReachRate = 7;
/** A desk laptop's lid folded down over the keys, in radians from upright. */
const deskLidClosedAngle = Math.PI / 2 - 0.03;
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

/** The middle shelf just inside the fridge's door, for a hand reaching in for a snack. */
const fridgeShelf = (() => {
  const fridge = furniture.find((piece) => piece.id === "fridge");
  // The fridge faces into the room (+z); the shelf is a little inside its front.
  return fridge === undefined
    ? { x: -6.6, y: 0.5, z: -4.4 }
    : { x: fridge.x + 0.05, y: 0.5, z: fridge.z + fridge.depth / 2 - 0.12 };
})();

/** Above the head bone: clear of the hair and of the speech bubbles, which sit lower. */
const badgeAboveHead = 0.42;

/** Keystrokes between two bits of code floating up off a keyboard. */
function glyphEvery(): number {
  return 10 + Math.floor(Math.random() * 11);
}

/** Teammates closer than this while one of them walks by say hello. */
const greetDistance = 1.1;
/** Where a speech bubble's tail points: this far above the head bone, over the hair. */
const bubbleAboveHead = 0.3;

/** A line of small talk and where on screen its speaker's head is. */
/** Who a speech bubble belongs to: a teammate, or the office cat. */
export type Speaker = MemberId | "mochi";

export interface SpeechAnchor {
  memberId: Speaker;
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
/** How close Alyx has to be, in meters, to greet someone he is looking at. */
const greetReach = 1.8;
/** How long a teammate answers Alyx: turned to him, smiling, the line up and a wave. */
const bossAnswerSeconds = 3.8;
/** Alyx does not walk into people: about two bodies' widths between centers. */
const alyxPersonalSpace = 0.34;
/** How far he reaches for a thing on a desk or a switch. */
const handReach = 1.5;
/** How far a seat or his end of the table may be: a step away. */
const stepReach = 1.7;
/** Seats he may take: anything people sit on for a break, but nobody's own desk chair. */
const alyxSeats: readonly StationId[] = [
  "sofa-1",
  "sofa-2",
  "sofa-3",
  "beanbag-lounge",
  "bar-left",
  "bar-right",
  "bar-west-left",
  "bar-west-right",
  "collab-1",
  "collab-2",
  "collab-3",
  ...meetingStationIds,
];
/** Seated, his eyes are this far above the seat: the team's 0.54 plus his few extra centimeters. */
const seatedEye = 0.58;
/** Lifting Mochi off a keyboard: reaching for her, then carrying her down to the floor, in seconds. */
const catLift = { reach: 0.9, carry: 1.4 } as const;
/** She is hungry again from here on, 0 just fed to 1 starving. */
const hungryFrom = 0.6;
/** Seconds into a meal before the bowl goes down, so she is seen eating first. */
const mealSeconds = 5;
/** How long a stroke lasts, from his hand going down to her purring stopping. */
const catPetSeconds = 3;
/** Her back, off whatever she lies or sits on: where a stroking hand lands. */
const catBackHeight = 0.17;
/** A teammate walking this close to Mochi says hello to her. */
const catGreetDistance = 1;
/** Seconds before the same teammate greets her again, and before anyone does. */
const catGreetCooldown = { each: 120, anyone: 15 } as const;
/** The shell of the laptop Alyx opens at a meeting seat. */
const alyxLaptopShell = "#2f3340";

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
  fetch: "getting something",
  pick: "getting a clean mug",
  eat: "having a bite",
  out: "out getting food",
  "pingpong-wait": "waiting for a ping-pong partner",
  run: "on the treadmill",
  "hand-over": "handing over",
  "wait-report": "waiting to report",
  box: "at the punching bag",
  gaze: "watching the fish",
  standup: "at standup",
  "standup-lead": "running standup",
  lunch: "having lunch",
};

export class OfficeStage {
  private composer: EffectComposer | null = null;
  private readonly chatter = new ChatterDirector(Math.random, () => this.dayPart());
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, 1.6, 0.1, 120);
  private readonly closeupCamera = new PerspectiveCamera(38, 1.6, 0.05, 30);
  private readonly controls: OrbitControls;
  /** Walk-and-look camera, switched on in place of the orbit view. */
  private readonly freeCamera: FreeCamera;
  private readonly firstPerson: FirstPerson;
  private readonly alyxHands = new AlyxHands();
  /** When Alyx last greeted each teammate, in stage seconds. */
  private readonly bossGreetedAt: Partial<Record<MemberId, number>> = {};
  /** When Alyx's own wave began, in stage seconds. */
  private alyxWaveAt: number | null = null;
  /** The desk thing Alyx is carrying: whose desk, which thing, and the thing itself, hidden there. */
  private alyxHeld: { owner: DeskMember; item: DeskItem; object: Object3D } | null = null;
  /** Mochi, the office cat: where she goes, and her model. */
  private readonly cat = new Cat();
  private readonly catModel = new OfficeCat();
  /** What she is saying, in stage seconds. */
  private catSpeech: { text: string; startedAt: number; until: number } | null = null;
  /** Someone she turns her head to for a moment: whoever greeted or is stroking her. */
  private catLook: { point: Point; until: number } | null = null;
  private catPettedAt: number | null = null;
  /** Each member's lock screen photo, taken from their model the first time it is needed. */
  private readonly photos = new Map<MemberId, HTMLCanvasElement>();
  /** Where Alyx stood when he went to stroke her, and where he crouches beside her. */
  private petWalk: { from: Point; to: Point } | null = null;
  private catBegged: number | null = null;
  private readonly sound = new OfficeSound();
  /** Code bits off the keyboards and sparks over finished work. */
  private readonly deskEffects = new DeskEffects();
  private display: OfficeDisplaySettings = { ...defaultDisplaySettings };
  /** When the next frame may be drawn under the frame rate cap, in animation-frame milliseconds. */
  private frameDueAt = 0;
  /** Smoothed milliseconds of script per frame: updates, animation, physics and issuing draws. */
  private cpuMs = 0;
  /** The part of it spent moving the team: poses, hands, expressions and hair physics. */
  private teamMs = 0;
  /** The graphics chip the office draws on, as the browser names it, once known. */
  private gpu: string | null = null;
  private soundOn = false;
  private readonly soundRight = new Vector3();
  /** Where the rally was last frame, to hear each paddle and bounce it passed since. */
  private lastRallyLeg: number | null = null;
  private doorWasOpen = false;
  private lastBrewer: MemberId | null = null;
  /** The start of the last line of Mochi's that was voiced, so each meow sounds once. */
  private meowedFor: number | null = null;
  private readonly catGreetedBy = new Map<MemberId, number>();
  /** 0 just fed to 1 starving; she goes to the bowl from hungryFrom on. */
  private catHunger = 0.3;
  private bowlFood = 1;
  private readonly bowl = new CatBowl();
  /** The meal (by arrival time) already taken out of the bowl. */
  private catAte: number | null = null;
  private bowlRefilledAt = Number.NEGATIVE_INFINITY;
  /** Asleep on someone's keyboard: whose, when they lift her, and the lift once it has started. */
  private catNap: {
    owner: DeskMember;
    liftAt: number | null;
    lift: { startedAt: number; from: { x: number; z: number; height: number }; to: Point } | null;
  } | null = null;
  private catGreetedLast = Number.NEGATIVE_INFINITY;
  /** The TV, arcades, fridge and meeting laptops he switched on or opened, by target id. */
  private readonly alyxOn = new Set<string>();
  /** Desk lamps he switched on or off himself, which then stay that way. */
  private readonly alyxLamps = new Map<DeskMember, boolean>();
  /** The lamp level the time of day gives, before his own switching. */
  private autoLamps = 0;
  private alyxSeat: StationId | null = null;
  /** His game of ping-pong: his end of the table, and his opponent once someone comes. */
  private alyxGame: { station: StationId; partner: MemberId | null; askedAt: number } | null = null;
  /** The room view's lens, put back on leaving first person. */
  private roomFov = 30;
  /** Draw calls in the last frame, all passes together, for the frame rate meter. */
  private lastDrawCalls = 0;
  private readonly timer = new Timer();
  private readonly office = buildOffice();
  /** Every mug starts on its desk, some fuller than others. */
  private readonly mugs = Object.fromEntries(
    memberIds.map((memberId) => [memberId, initialMug(0.3 + Math.random() * 0.7)]),
  ) as Record<MemberId, MugState>;
  /** The food on the bar, shared by everyone. */
  private food: BarFood = initialFood(Date.now());
  /** What the order app on Alyx's phone shows; until the page sets it, the phone stays away. */
  private phoneView: () => PickerView | null = () => null;
  /** Alyx eating a piece from the bar, or carrying the empty box out in a bin bag. */
  private alyxMeal: AlyxMeal = null;
  /** The piece in Alyx's hand while he eats it, shrinking with each bite. */
  private alyxPiece: Object3D | null = null;
  /** When the box on the bar was found empty with nobody clearing it, to clear it after a while. */
  private emptyBoxSince: number | null = null;
  /** Food Alyx ordered in, from the courier's drop at the door to the bar. */
  private foodOrder: FoodOrder | null = null;
  /** The courier's bag on the mat inside the door, waiting for Alyx. */
  private readonly deliveryBag = handPropModel("food-bag");
  private readonly life = new OfficeLife(
    Math.random,
    (station) => this.stationCrowded(station),
    (memberId) => this.mugs[memberId],
    () => this.dayPart(),
    // Nobody goes out for food while Alyx has some on the way.
    () => ({ pieces: piecesOnOffer(this.food), canBuy: canBuy(this.food, Date.now()) && this.foodOrder === null }),
    (memberId) => ritualFor(memberId, this.clock()),
  );
  /** This morning's standup: when the round of updates began and who joined, in the order they came. */
  private standup: { startedAt: number | null; order: MemberId[] } = { startedAt: null, order: [] };
  /** The idle step each member is on, or nothing while real work has them. */
  private readonly lifeSteps: Partial<Record<MemberId, LifeChoice>> = {};
  private readonly rigs: Record<MemberId, MemberRig>;

  private team: TeamRuntime = emptyTeamRuntime();
  private readonly twobStatus = new TwobStatus();
  private readonly handoffs = new Handoffs();
  private twobReaction: Reaction = idleReaction(Date.now());
  private elapsed = 0;
  private closeupEnabled = true;
  /** A member clicked for a preview: their close-up stays up until closed, whatever else happens. */
  private pinned: MemberId | null = null;
  private readonly pointerRay = new Raycaster();
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
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.autoClear = false;
    // Filmic tone mapping keeps the bright room from washing out and lets the accent glow read as light.
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    // Soft shadows ground the people and furniture; without them the room reads as floating props.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    // Three redraws the shadow map on every render call, and the frame makes several (the
    // ambient occlusion's normals, the close-up). Once per frame is enough: see frame().
    this.renderer.shadowMap.autoUpdate = false;

    const sun = this.sun;
    sun.position.set(6, 11, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 9;
    sun.shadow.camera.bottom = -9;
    sun.shadow.bias = -0.0004;
    // Cool fill from the back windows, so faces at the back-row desks are not lit by the sun alone.
    this.windowFill.position.set(0, 4, -10);
    const [backGlow, sideGlow] = this.neonGlow as [PointLight, PointLight];
    backGlow.position.set(0, 1.6, -4.3);
    sideGlow.position.set(-6.3, 1.6, 0);
    this.bowl.root.position.set(bowlSpot.x, 0, bowlSpot.z);
    // On the mat just inside the door, off to the side of the way in. The bag hangs from its grip,
    // so the grip sits a bag's height up.
    this.deliveryBag.position.set(deliveryBagSpot.x, 0.23, deliveryBagSpot.z);
    this.deliveryBag.visible = false;
    this.scene.add(
      this.deliveryBag,
      this.hemisphere,
      sun,
      this.windowFill,
      backGlow,
      sideGlow,
      this.office.root,
      this.catModel.root,
      this.bowl.root,
      this.deskEffects.root,
    );
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
    canvas.addEventListener("dblclick", () => {
      if (!this.freeCamera.active && !this.firstPerson.active) {
        this.resetView();
      }
    });
    // A little way past the walls and up to a bird's eye view, so the room is never lost from sight.
    this.freeCamera = new FreeCamera(this.camera, canvas, {
      minX: room.minX - 3,
      maxX: room.maxX + 4,
      minY: 0.35,
      maxY: 9,
      minZ: room.minZ - 1,
      maxZ: room.maxZ + 7,
    });
    this.firstPerson = new FirstPerson(
      this.camera,
      canvas,
      (point) => this.alyxCanStand(point),
      () => this.interactAsAlyx(),
      () => this.phoneView()?.open === true,
    );
    this.renderer.info.autoReset = false;

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
    // Playing Alyx: he is already at his end of the table, paddle in hand.
    if (this.alyxGame?.partner === memberId) {
      return true;
    }
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
    // Alyx sitting there, or at his end of the ping-pong table; or Mochi asleep on the beanbag.
    if (this.alyxSeat === station || this.alyxGame?.station === station) {
      return true;
    }
    if (station === "beanbag-lounge" && this.cat.onBeanbag) {
      return true;
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
    // A new model is a new face for the lock screen.
    this.photos.delete(memberId);
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
    this.twobStatus.observe(reaction);
  }

  applyMemberSignal(signal: MemberSignal): void {
    if (signal.memberId === "twob") {
      return;
    }
    this.team = { ...this.team, [signal.memberId]: applyMemberSignal(this.team[signal.memberId], signal) };
    if (signal.activity === "stop" && this.team[signal.memberId].activeAgents.size === 0) {
      this.handoffs.finished(signal.memberId, Date.now());
    }
  }

  /** 2B handed a task to a teammate: she walks the brief over to their desk. */
  applyDelegation(memberId: Teammate): void {
    this.handoffs.delegated(memberId, Date.now());
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
    return this.closeupEnabled || this.pinned !== null ? this.focus : null;
  }

  /** Back to the default view, the same framing the office opens with. */
  resetView(): void {
    const spherical = new Spherical(this.fitDistance(), defaultView.polar, defaultView.azimuth);
    this.camera.position.copy(viewTarget).add(new Vector3().setFromSpherical(spherical));
    this.controls.target.copy(viewTarget);
    this.controls.update();
  }

  /** Keyboard parity with the mouse: arrows orbit, +/- zoom, 0 resets. */
  /** Switches between the orbit view and the free camera; leaving it goes back to the default view. */
  setFreeCamera(on: boolean): void {
    if (on === this.freeCamera.active) {
      return;
    }
    if (on) {
      this.setFirstPerson(false);
      this.controls.enabled = false;
      this.freeCamera.enable();
    } else {
      this.freeCamera.disable();
      this.controls.enabled = true;
      this.resetView();
    }
    this.lastInputAt = Date.now();
  }

  freeCameraOn(): boolean {
    return this.freeCamera.active;
  }

  /** Walks the office as Alyx in first person; leaving goes back to the default view. Needs a click. */
  setFirstPerson(on: boolean): void {
    if (on === this.firstPerson.active) {
      return;
    }
    if (on) {
      this.setFreeCamera(false);
      this.controls.enabled = false;
      this.pinCloseup(null);
      this.roomFov = this.camera.fov;
      this.camera.fov = firstPersonFov;
      this.camera.updateProjectionMatrix();
      this.firstPerson.enable();
      this.alyxHands.load().catch((error: unknown) => {
        console.error("[office] Alyx's hands could not be loaded; walking on without them", error);
      });
    } else {
      this.firstPerson.disable();
      this.resetAlyx();
      this.camera.fov = this.roomFov;
      this.camera.updateProjectionMatrix();
      this.controls.enabled = true;
      this.resetView();
    }
    // Inside the room the missing walls and ceiling would show as a void; from outside they hide it.
    this.office.enclosure.root.visible = on;
    this.lastInputAt = Date.now();
  }

  /** Render resolution (a share of the screen's pixel density) and the frame rate cap. */
  setDisplay(settings: OfficeDisplaySettings): void {
    this.display = settings;
    const ratio = (Math.min(window.devicePixelRatio, 2) * settings.renderScale) / 100;
    this.renderer.setPixelRatio(ratio);
    this.composer?.setPixelRatio(ratio);
    this.resize();
  }

  frameCpuMs(): number {
    return this.cpuMs;
  }

  frameTeamMs(): number {
    return this.teamMs;
  }

  /** The graphics chip's name, for telling a built-in chip or software drawing from a real card. */
  gpuName(): string | null {
    if (this.gpu === null) {
      const gl = this.renderer.getContext();
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      const raw: unknown = gl.getParameter(info === null ? gl.RENDERER : info.UNMASKED_RENDERER_WEBGL);
      this.gpu = typeof raw === "string" && raw !== "" ? gpuLabel(raw) : null;
    }
    return this.gpu;
  }

  setSound(settings: OfficeSoundSettings): void {
    this.soundOn = settings.enabled && settings.volume > 0;
    this.sound.configure(settings);
  }

  wakeSound(): void {
    this.sound.wake();
  }

  firstPersonOn(): boolean {
    return this.firstPerson.active;
  }

  /** Walking with the mouse locked to the office, as opposed to paused until the next click. */
  firstPersonWalking(): boolean {
    return this.firstPerson.active && this.firstPerson.locked;
  }

  /** Where the phone in Alyx's hand gets what its order app shows; set by the page. */
  setPhoneView(view: () => PickerView): void {
    this.phoneView = view;
  }

  /** Orders food in as Alyx; an order already on its way stands. */
  orderFoodAsAlyx(kind: FoodKind): void {
    this.foodOrder = orderFood(this.foodOrder, kind, Date.now());
  }

  /** What Alyx's order is doing, or null when there is none. */
  foodOrderStatus(): string | null {
    return orderStatus(this.foodOrder, Date.now());
  }

  /** What E does right now in first person: the target under the aim dot, or ending what he is in. */
  firstPersonTarget(): AlyxTarget | null {
    if (!this.firstPerson.active) {
      return null;
    }
    const here = { ...this.firstPerson.position, y: eyeHeight };
    const now = (id: string, label: string): AlyxTarget => ({ id, label, point: here, reach: 0 });
    if (this.alyxGame !== null) {
      return now("stop-game", "Udahan main");
    }
    if (this.alyxSeat !== null) {
      return now("stand", "Berdiri");
    }
    if (this.alyxHeld !== null) {
      return now("put-back", `Taruh balik ${pickableItems[this.alyxHeld.item] ?? "barang"}`);
    }
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    // With the bag in hand there is nothing else to pick up, only the bar to take it to.
    const carrying = this.foodOrder?.phase === "in-hand";
    const bagged = this.alyxMeal?.kind === "bag";
    const targets = this.alyxTargets().filter(
      (target) =>
        (!carrying || target.id === "bar-food" || target.id.startsWith("member:")) &&
        (!bagged || target.id === "bin-bag" || target.id.startsWith("member:")),
    );
    return pickTarget(targets, this.camera.position, (point) => {
      const projected = new Vector3(point.x, point.y, point.z).project(this.camera);
      return {
        dx: (projected.x * width) / 2,
        dy: (-projected.y * height) / 2,
        inFront: projected.z > -1 && projected.z < 1,
      };
    });
  }

  /** Everything in the room Alyx could use with E, wherever it is. */
  private alyxTargets(): AlyxTarget[] {
    const targets: AlyxTarget[] = [];
    const at = (object: Object3D, lift = 0): AlyxTarget["point"] => {
      const point = object.getWorldPosition(new Vector3());
      return { x: point.x, y: point.y + lift, z: point.z };
    };
    for (const memberId of memberIds) {
      const rig = this.rigs[memberId];
      if (!rig.avatar.root.visible) {
        continue;
      }
      const head = rig.avatar.poseTarget.node("head");
      const point = head === null ? { ...rig.actor.position, y: 0.8 } : at(head);
      targets.push({
        id: `member:${memberId}`,
        label: `Sapa ${roster[memberId].displayName}`,
        point,
        reach: greetReach,
      });
    }
    for (const owner of memberIds) {
      for (const [item, object] of Object.entries(this.office.workstations[owner].items)) {
        const name = pickableItems[item as DeskItem];
        if (name !== undefined && object.visible) {
          targets.push({ id: `item:${owner}:${item}`, label: `Ambil ${name}`, point: at(object), reach: handReach });
        }
      }
      const lamp = this.office.workstations[owner].lamp;
      const lit = this.alyxLamps.get(owner) ?? (this.autoLamps > 0.5 && !this.goneHome(owner));
      targets.push({
        id: `lamp:${owner}`,
        label: lit ? "Matiin lampu meja" : "Nyalain lampu meja",
        point: at(lamp.root, 0.3),
        reach: handReach,
      });
    }
    const piecePoint = (piece: { x: number; z: number }, y: number): AlyxTarget["point"] => ({
      x: piece.x,
      y,
      z: piece.z,
    });
    const toggle = (id: string, on: string, off: string): string => (this.alyxOn.has(id) ? off : on);
    const tv = furniture.find((piece) => piece.kind === "tv-wall");
    if (tv !== undefined) {
      targets.push({ id: "tv", label: toggle("tv", "Nyalain TV", "Matiin TV"), point: piecePoint(tv, 1.1), reach: 3 });
    }
    furniture
      .filter((piece) => piece.kind === "arcade")
      .forEach((piece, index) => {
        const id = `arcade:${index}`;
        targets.push({
          id,
          label: toggle(id, "Nyalain arcade", "Matiin arcade"),
          point: piecePoint(piece, 1.0),
          reach: handReach,
        });
      });
    targets.push(...this.orderTargets());
    const fridge = furniture.find((piece) => piece.kind === "fridge");
    if (fridge !== undefined) {
      targets.push({
        id: "fridge",
        label: toggle("fridge", "Buka kulkas", "Tutup kulkas"),
        point: piecePoint(fridge, 0.8),
        reach: handReach,
      });
    }
    this.office.meetingLaptops.forEach((laptop, index) => {
      if (this.meetingLaptopOwner(index) !== undefined) {
        return;
      }
      const id = `laptop:${index}`;
      targets.push({
        id,
        label: toggle(id, "Buka laptop", "Tutup laptop"),
        point: at(laptop.root, surface.desk),
        reach: handReach,
      });
    });
    for (const station of alyxSeats) {
      const { spot, seatHeight } = stations[station];
      if (this.life.occupant(station) === null && !this.stationCrowded(station)) {
        targets.push({
          id: `seat:${station}`,
          label: "Duduk",
          point: { ...spot, y: (seatHeight ?? 0.45) + 0.15 },
          reach: stepReach,
        });
      }
    }
    if (this.bowlFood < 0.99) {
      targets.push({
        id: "bowl",
        label: `Isi mangkok ${catName}`,
        point: { x: bowlSpot.x, y: 0.05, z: bowlSpot.z },
        reach: handReach,
      });
    }
    targets.push({
      id: "cat",
      label: `Elus ${catName}`,
      point: { x: this.cat.position.x, y: this.cat.height + 0.2, z: this.cat.position.z },
      reach: 1.4,
    });
    for (const station of ["pingpong-west", "pingpong-east"] as const) {
      const { spot } = stations[station];
      // The middle of his half of the table, where the eye goes when he looks at it.
      const towardTable = station === "pingpong-west" ? 0.75 : -0.75;
      if (this.life.occupant(station) === null && !this.stationCrowded(station)) {
        targets.push({
          id: `pingpong:${station}`,
          label: "Main pingpong",
          point: { x: spot.x + towardTable, y: surface.pingpong, z: spot.z },
          reach: stepReach,
        });
      }
    }
    return targets;
  }

  /** The courier's bag at the door, the bar to set it down on, and the box to open there. */
  private orderTargets(): AlyxTarget[] {
    const order = this.foodOrder;
    const bar = this.office.barFood.root.getWorldPosition(new Vector3());
    const barPoint = { x: bar.x, y: bar.y + 0.08, z: bar.z };
    const targets: AlyxTarget[] = [];
    if (order?.phase === "at-door") {
      targets.push({
        id: "order-bag",
        label: `Ambil ${foodNames[order.kind]}`,
        point: { x: deliveryBagSpot.x, y: 0.1, z: deliveryBagSpot.z },
        reach: handReach,
      });
    }
    if (order?.phase === "in-hand") {
      targets.push({
        id: "bar-food",
        label: this.food.boxOnBar ? "Bar masih ada makanan" : `Taruh ${foodNames[order.kind]} di bar`,
        point: barPoint,
        reach: handReach,
      });
    }
    if (this.food.boxOnBar && !this.food.open && this.food.kind !== null) {
      targets.push({ id: "open-food", label: `Buka ${foodNames[this.food.kind]}`, point: barPoint, reach: handReach });
    }
    // With both hands free: a piece from the open box, or the empty box folded into a bin bag.
    const handsFree = this.alyxHeld === null && order?.phase !== "in-hand" && this.alyxMeal === null;
    if (handsFree && this.food.boxOnBar && this.food.open && this.food.kind !== null) {
      const kind = this.food.kind;
      if (piecesOnOffer(this.food) > 0) {
        const verb = drinkKinds.includes(kind) ? "Minum" : "Makan";
        targets.push({ id: "eat-food", label: `${verb} ${foodNames[kind]}`, point: barPoint, reach: handReach });
      } else if (!this.someoneClearingBox()) {
        targets.push({ id: "wrap-box", label: "Bungkus jadi sampah", point: barPoint, reach: handReach });
      }
    }
    if (this.alyxMeal?.kind === "bag" && trashBin !== undefined) {
      targets.push({
        id: "bin-bag",
        label: "Buang ke tempat sampah",
        point: { x: trashBin.x, y: 0.45, z: trashBin.z },
        reach: handReach,
      });
    }
    return targets;
  }

  /**
   * An empty box Alyx ate the last of and left: once he is out of first person and a minute has
   * gone by with nobody clearing it, it is binned, so the team can order the next food.
   */
  private clearForgottenBox(): void {
    const forgotten = this.food.boxOnBar && this.food.left === 0 && !this.someoneClearingBox();
    if (!forgotten) {
      this.emptyBoxSince = null;
      return;
    }
    const now = Date.now();
    this.emptyBoxSince ??= now;
    if (!this.firstPerson.active && now - this.emptyBoxSince > 60_000) {
      this.food = binBox(this.food, now);
      this.emptyBoxSince = null;
    }
  }

  /** A teammate is already on the way to bin the empty box, or carrying it there. */
  private someoneClearingBox(): boolean {
    return memberIds.some((memberId) => {
      const errand = this.lifeSteps[memberId]?.errand;
      return errand === "take-box" || errand === "bin-box";
    });
  }

  /** Alyx's bite of the food: the piece shrinks as it is eaten, and the hand goes down after. */
  private updateAlyxMeal(): void {
    const meal = this.alyxMeal;
    const next = stepMeal(meal, Date.now());
    if (meal?.kind === "eating" && next === null) {
      this.alyxHands.hold(null);
      this.alyxPiece = null;
    }
    this.alyxMeal = next;
    if (next?.kind === "eating" && this.alyxPiece !== null) {
      const left = pieceLeft((Date.now() - next.startedAt) / 1000);
      this.alyxPiece.scale.setScalar(Math.max(0.001, left));
    }
  }

  /** Seconds into Alyx's current bite, for the hand at the mouth, or 0 when not eating. */
  private alyxEating(): number {
    const meal = this.alyxMeal;
    return meal?.kind === "eating" ? eatLift((Date.now() - meal.startedAt) / 1000) : 0;
  }

  /** E in first person: does whatever the target under the aim dot offers. */
  private interactAsAlyx(): void {
    const target = this.firstPersonTarget();
    if (target === null) {
      return;
    }
    const [kind, first, second] = target.id.split(":");
    switch (kind) {
      case "member":
        this.greetAsAlyx(first as MemberId);
        return;
      case "item":
        this.takeAsAlyx(first as DeskMember, second as DeskItem);
        return;
      case "put-back":
        this.alyxHeld = null;
        this.alyxHands.hold(null);
        return;
      case "order-bag":
        this.foodOrder = pickUpOrder(this.foodOrder);
        this.alyxHands.hold(handPropModel("food-bag"));
        return;
      case "bar-food": {
        // Only onto an empty bar: with food still there the bag stays in hand.
        const kind = this.foodOrder?.kind;
        const placed = kind === undefined ? null : setDownOrder(this.food, kind);
        if (placed !== null) {
          this.food = placed;
          this.foodOrder = null;
          this.alyxHands.hold(null);
        }
        return;
      }
      case "open-food":
        this.food = openBox(this.food);
        return;
      case "eat-food": {
        const kind = this.food.kind;
        const taken = takePiece(this.food);
        if (kind !== null && taken.took) {
          this.food = taken.food;
          this.alyxMeal = { kind: "eating", food: kind, startedAt: Date.now() };
          this.alyxPiece = handPropModel(pieceProps[kind]);
          this.alyxHands.hold(this.alyxPiece);
        }
        return;
      }
      case "wrap-box":
        // The empty box goes into a bin bag in his hand; the bar is clear for the next order.
        this.food = binBox(this.food, Date.now());
        this.alyxMeal = { kind: "bag" };
        this.alyxHands.hold(handPropModel("trash-bag"));
        return;
      case "bin-bag":
        this.alyxMeal = null;
        this.alyxHands.hold(null);
        if (trashBin !== undefined) {
          this.sound.play("door-close", { x: trashBin.x, y: 0.4, z: trashBin.z });
        }
        return;
      case "stand":
      case "stop-game":
        this.firstPerson.release();
        return;
      case "seat":
        this.sitAsAlyx(target.id.slice("seat:".length) as StationId);
        return;
      case "pingpong":
        this.playAsAlyx(first as StationId);
        return;
      case "cat":
        this.petCat();
        return;
      case "bowl":
        this.bowlFood = 1;
        this.bowlRefilledAt = this.elapsed;
        return;
      case "lamp": {
        const owner = first as DeskMember;
        const lit = this.alyxLamps.get(owner) ?? (this.autoLamps > 0.5 && !this.goneHome(owner));
        this.alyxLamps.set(owner, !lit);
        this.applyDaylight();
        return;
      }
      default:
        // The TV, an arcade, the fridge or a meeting laptop.
        if (this.alyxOn.has(target.id)) {
          this.alyxOn.delete(target.id);
        } else {
          this.alyxOn.add(target.id);
        }
    }
  }

  /** The teammate turns to him, smiles, waves back and answers. */
  private greetAsAlyx(memberId: MemberId): void {
    if (this.bossGreeting(memberId) !== null) {
      return;
    }
    this.alyxWaveAt = this.elapsed;
    this.bossGreetedAt[memberId] = this.elapsed;
    const rig = this.rigs[memberId];
    if (isWalking(rig.actor)) {
      rig.walkHabits.wave(this.elapsed);
    }
    this.chatter.announce(
      memberId,
      bossLine(memberId, this.dayPart()),
      this.elapsed + 0.4,
      this.elapsed + bossAnswerSeconds,
    );
  }

  /** Picks the thing up off its desk; the owner leaves anything that needs it alone until it is back. */
  private takeAsAlyx(owner: DeskMember, item: DeskItem): void {
    const object = this.office.workstations[owner].items[item];
    if (object === undefined) {
      return;
    }
    this.alyxHeld = { owner, item, object };
    this.alyxHands.hold(object.clone(true));
  }

  private sitAsAlyx(station: StationId): void {
    const { spot, approach, facing, seatHeight } = stations[station];
    this.alyxSeat = station;
    this.firstPerson.anchorAt(
      {
        spot,
        eye: (seatHeight ?? 0.45) + seatedEye,
        standAt: approach,
        onLeave: () => {
          this.alyxSeat = null;
        },
      },
      // The camera looks along -z at yaw 0, a seated avatar along +z.
      facing + Math.PI,
    );
  }

  /** Takes his end of the table, paddle in hand; a teammate on a break comes over to play. */
  private playAsAlyx(station: StationId): void {
    const { spot, facing } = stations[station];
    this.alyxGame = { station, partner: null, askedAt: Number.NEGATIVE_INFINITY };
    // His hands are drawn close to the eye, so the paddle shrinks to sit in the hand at its size.
    const paddle = handPropModel("paddle");
    paddle.scale.setScalar(0.62);
    this.alyxHands.hold(paddle);
    this.firstPerson.anchorAt(
      { spot, eye: eyeHeight, standAt: spot, onLeave: () => this.endAlyxGame() },
      facing + Math.PI,
    );
  }

  private endAlyxGame(): void {
    const partner = this.alyxGame?.partner ?? null;
    if (partner !== null) {
      this.life.endBossGame(partner, Date.now());
    }
    this.alyxGame = null;
    this.alyxHands.hold(this.alyxHeld === null ? null : this.alyxHeld.object.clone(true));
  }

  /** Keeps asking for an opponent every couple of seconds until someone is free. */
  private updateAlyxGame(): void {
    const game = this.alyxGame;
    if (game === null) {
      return;
    }
    // An opponent who never made it to the table, or was called to work, is replaced.
    if (game.partner !== null && this.lifeSteps[game.partner]?.activity !== "pingpong") {
      game.partner = null;
      game.askedAt = this.elapsed;
    }
    if (game.partner !== null || this.elapsed - game.askedAt < 2) {
      return;
    }
    game.askedAt = this.elapsed;
    const other = game.station === "pingpong-west" ? "pingpong-east" : "pingpong-west";
    game.partner = this.life.playBoss(other, Date.now());
    if (game.partner !== null) {
      this.chatter.announce(game.partner, "Siap, Bos! Aku lawan.", this.elapsed, this.elapsed + 2.5);
    }
  }

  /** His opponent is at the other end and ready, so the ball is in play. */
  private alyxRally(): boolean {
    const game = this.alyxGame;
    if (game === null || game.partner === null) {
      return false;
    }
    const rig = this.rigs[game.partner];
    const other = game.station === "pingpong-west" ? "pingpong-east" : "pingpong-west";
    return rig.action === "pingpong" && rig.plan.station === other && !isWalking(rig.actor);
  }

  /** Whose laptop is open at this meeting seat, if anyone's. */
  private meetingLaptopOwner(index: number): MemberId | undefined {
    const seat = meetingStationIds[index];
    return memberIds.find(
      (memberId) =>
        this.lifeSteps[memberId]?.errand === "meeting-laptop" &&
        this.rigs[memberId].plan.station === seat &&
        this.rigs[memberId].laptop.place === "seat",
    );
  }

  /** Alyx strokes Mochi: she stays put, turns to him, shuts her eyes and purrs. */
  private petCat(): void {
    this.catPettedAt = this.elapsed;
    // A step in close enough to reach her back, or as close as there is room for.
    const from = this.firstPerson.position;
    const to =
      [petDistance, 0.55, 0.7]
        .map((distance) => petStandSpot(this.cat.position, from, distance))
        .find((spot) => this.alyxCanStand(spot)) ?? from;
    this.petWalk = { from, to };
    this.catLook = { point: this.firstPerson.position, until: this.elapsed + catPetSeconds };
    this.catSpeech = {
      text: catLine("petted", Math.random),
      startedAt: this.elapsed + 0.5,
      until: this.elapsed + catPetSeconds,
    };
  }

  /**
   * While he strokes her: a step in, down on his heels with his eyes on her, and back up at the
   * end. Standing and free to walk the rest of the time.
   */
  private crouchToCat(): void {
    const since = this.catPettedAt === null ? null : this.elapsed - this.catPettedAt;
    if (since === null || since > catPetSeconds || this.petWalk === null) {
      this.firstPerson.crouchTo(0, false);
      this.petWalk = null;
      return;
    }
    const step = Math.min(1, since / crouchSeconds);
    const eased = step * step * (3 - 2 * step);
    const { from, to } = this.petWalk;
    this.firstPerson.stepTo({ x: from.x + (to.x - from.x) * eased, z: from.z + (to.z - from.z) * eased });
    const down = crouchAmount(since, catPetSeconds);
    this.firstPerson.crouchTo(crouchDepth(eyeHeight, this.cat.height + catBackHeight) * down, true);
    // Eyes on her while getting down; once there the mouse is his again.
    if (since < crouchSeconds) {
      this.firstPerson.lookToward(this.catBack(), 0.2);
    }
  }

  /** The order app while the phone is out, with the office's time on its status bar. */
  private phoneShown(): { view: PickerView; clock: string } | null {
    const view = this.phoneView();
    if (view === null || !view.open) {
      return null;
    }
    // The office's own time, the same as the wall clock.
    return { view, clock: clockFace(jakartaTime(this.clock()), false) };
  }

  /** Her back and the way down, in the view's own frame, for the hand that strokes her. */
  private catInView(): { back: Vector3; down: Vector3 } | null {
    if (this.catPettedAt === null || this.elapsed - this.catPettedAt >= catPetSeconds) {
      return null;
    }
    this.camera.updateMatrixWorld();
    const { x, y, z } = this.catBack();
    const back = this.camera.worldToLocal(new Vector3(x, y, z));
    const toView = this.camera.quaternion.clone().invert();
    return { back, down: new Vector3(0, -1, 0).applyQuaternion(toView) };
  }

  /** The middle of Mochi's back, where a hand strokes her. */
  private catBack(): { x: number; y: number; z: number } {
    return { x: this.cat.position.x, y: this.cat.height + catBackHeight, z: this.cat.position.z };
  }

  /** Where Mochi goes next, from the hour and what the team is doing. */
  private chooseCatPlan(previous: CatSpotId | null): CatChoice {
    const unavailable = new Set<CatSpotId>();
    const beanbag = stations["beanbag-lounge"];
    const someoneOnBeanbag =
      this.life.occupant("beanbag-lounge") !== null ||
      memberIds.some((memberId) => distance(this.rigs[memberId].actor.position, beanbag.spot) < 0.5);
    if (someoneOnBeanbag) {
      unavailable.add("beanbag");
    }
    // Teammates working or idling at their own desk, whom she might drop in on.
    const atDesks = memberIds.filter((memberId) => {
      const rig = this.rigs[memberId];
      return (
        rig.avatar.root.visible &&
        rig.plan.station === `desk-${memberId}` &&
        (rig.action === "desk-idle" || rig.action === "type")
      );
    });
    if (atDesks.length === 0) {
      unavailable.add("visit");
    }
    // Keyboards she can get onto: an L-desk's short leg is her way up.
    const keyboards = atDesks.filter((memberId) => furniture.some((piece) => piece.id === `return-${memberId}`));
    if (keyboards.length === 0) {
      unavailable.add("keyboard");
    }
    const snacking = memberIds.some((memberId) => this.rigs[memberId].action === "snack");
    const plan = nextCatPlan(previous, jakartaHours(this.clock()), Math.random, {
      snacking,
      unavailable,
      hungry: this.catHunger >= hungryFrom,
      bowlFood: this.bowlFood,
      rally: this.office.pingpongBall.visible,
    });
    if (plan.spot === "keyboard") {
      const owner = keyboards[Math.floor(Math.random() * keyboards.length) % keyboards.length] as DeskMember;
      return { plan, target: this.keyboardPerch(owner) };
    }
    if (plan.spot !== "visit") {
      return { plan, target: catSpots[plan.spot] };
    }
    const visited = atDesks[Math.floor(Math.random() * atDesks.length) % atDesks.length] as MemberId;
    const desk = stations[`desk-${visited}`];
    const spot = navGrid.nearestFree(desk.approach);
    return {
      plan,
      target: { spot, height: 0, approach: spot, facing: Math.atan2(desk.spot.x - spot.x, desk.spot.z - spot.z) },
    };
  }

  /**
   * The way up onto a teammate's keyboard: walk to the end of their L-desk's short leg, hop up onto
   * it, cross the desktop to the keys, and curl up there facing them.
   */
  private keyboardPerch(owner: DeskMember): CatChoice["target"] {
    this.catNap = { owner, liftAt: null, lift: null };
    const leg = furniture.find((piece) => piece.id === `return-${owner}`) as (typeof furniture)[number];
    const keys = this.office.workstations[owner].keyboard.root.getWorldPosition(new Vector3());
    const chair = stations[`desk-${owner}`].spot;
    return {
      spot: { x: keys.x, z: keys.z },
      height: surface.desk + 0.025,
      approach: navGrid.nearestFree({ x: leg.x, z: leg.z }),
      facing: Math.atan2(chair.x - keys.x, chair.z - keys.z),
      perch: [{ x: leg.x, z: leg.z, height: surface.desk }],
    };
  }

  /** Mochi asleep on this teammate's keyboard: they cannot type until she is off it. */
  private catOnKeyboardOf(memberId: MemberId): boolean {
    return this.catNap?.owner === memberId && this.cat.spotId === "keyboard" && this.cat.arrivedAt !== null;
  }

  /**
   * The keyboard nap: once she has been there a while, the owner reaches over, lifts her and sets
   * her down beside the chair. If they get up first, she hops down on her own.
   */
  private updateCatNap(): void {
    const nap = this.catNap;
    if (nap === null) {
      return;
    }
    if (this.cat.spotId !== "keyboard") {
      this.catNap = null;
      return;
    }
    if (this.cat.arrivedAt === null) {
      return;
    }
    const owner = this.rigs[nap.owner];
    const atDesk = owner.plan.station === `desk-${nap.owner}` && !isWalking(owner.actor);
    if (!atDesk && nap.lift === null) {
      this.cat.land(navGrid.nearestFree(this.cat.position));
      this.catNap = null;
      return;
    }
    if (nap.liftAt === null) {
      nap.liftAt = this.elapsed + (this.cat.planDurationMs ?? 12_000) / 1000;
      return;
    }
    if (nap.lift === null) {
      if (this.elapsed < nap.liftAt) {
        return;
      }
      nap.lift = {
        startedAt: this.elapsed,
        from: { ...this.cat.position, height: this.cat.height },
        to: navGrid.nearestFree(stations[`desk-${nap.owner}`].approach),
      };
      const line = keyboardLines[Math.floor(Math.random() * keyboardLines.length)] ?? "Turun dulu ya, Mochi.";
      this.chatter.announce(nap.owner, line, this.elapsed, this.elapsed + 3);
      return;
    }
    const t = this.elapsed - nap.lift.startedAt;
    if (t < catLift.reach) {
      return;
    }
    const k = Math.min(1, (t - catLift.reach) / catLift.carry);
    const eased = k * k * (3 - 2 * k);
    const { from, to } = nap.lift;
    const position = { x: from.x + (to.x - from.x) * eased, z: from.z + (to.z - from.z) * eased };
    // Up off the keys, across, and down to the floor.
    const height = from.height * (1 - eased) + 0.12 * Math.sin(Math.PI * eased);
    this.cat.carry(position, height, this.cat.yaw);
    if (k >= 1) {
      this.cat.land(to);
      this.catSpeech = { text: catLine("lifted", Math.random), startedAt: this.elapsed, until: this.elapsed + 2 };
      this.catNap = null;
    }
  }

  /** Both hands round Mochi while lifting her off the keyboard, or null when nobody is. */
  private catLiftTargets(memberId: MemberId): HandTargets | null {
    const lift = this.catNap?.owner === memberId ? this.catNap.lift : null;
    if (lift === null || this.elapsed - lift.startedAt > catLift.reach + catLift.carry) {
      return null;
    }
    const yaw = this.rigs[memberId].actor.yaw;
    // The avatar's left, in the room: it faces +z with its left on +x.
    const left = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    const at = (side: number): Vector3 =>
      new Vector3(
        this.cat.position.x + left.x * 0.07 * side,
        this.cat.height + 0.1,
        this.cat.position.z + left.z * 0.07 * side,
      );
    return { ...noHandTargets, left: at(1), right: at(-1), tip: "wrist" };
  }

  /**
   * Feeding: she gets hungrier through the day, eats a third of the bowl when she gets to it, and a
   * teammate at the fridge fills it if it is empty.
   */
  private updateCatFood(delta: number, pose: string): void {
    this.catHunger = Math.min(1, this.catHunger + delta / hungerSeconds);
    const arrived = this.cat.arrivedAt;
    if (pose === "eat" && arrived !== null && this.catAte !== arrived && Date.now() - arrived > mealSeconds * 1000) {
      this.catAte = arrived;
      this.bowlFood = afterMeal(this.bowlFood);
      this.catHunger = 0;
    }
    if (this.bowlFood <= 0 && this.elapsed - this.bowlRefilledAt > 60) {
      const filler = memberIds.find((memberId) => this.rigs[memberId].action === "snack");
      if (filler !== undefined) {
        this.bowlFood = 1;
        this.bowlRefilledAt = this.elapsed;
        const line = refillLines[Math.floor(Math.random() * refillLines.length)] ?? "Nih, Mochi, makan dulu.";
        this.chatter.announce(filler, line, this.elapsed, this.elapsed + 3);
      }
    }
    this.bowl.setFood(this.bowlFood);
  }

  /** Moves and poses Mochi, and lets passing teammates say hello to her. */
  private updateCat(delta: number, now: number): void {
    const petted = this.catPettedAt !== null && this.elapsed - this.catPettedAt < catPetSeconds;
    const look = this.catLook !== null && this.elapsed < this.catLook.until ? this.catLook.point : null;
    const { position } = this.cat;
    const face = look === null ? null : Math.atan2(look.x - position.x, look.z - position.z);
    this.updateCatNap();
    const pose = this.cat.update(delta, now, (previous) => this.chooseCatPlan(previous), petted, face);
    this.updateCatFood(delta, pose);
    // Begging at the fridge: one plaintive meow once she gets there.
    const arrived = this.cat.arrivedAt;
    if (pose === "beg" && arrived !== null && this.catBegged !== arrived) {
      this.catBegged = arrived;
      this.catSpeech = { text: catLine("begging", Math.random), startedAt: this.elapsed, until: this.elapsed + 2.5 };
    }
    this.greetCat();
    this.voiceCat(petted);
    // Beside the ping-pong table her head follows the ball; otherwise whoever she looks at.
    const ball = this.office.pingpongBall;
    const watching = this.cat.spotId === "pingpong" && this.cat.arrivedAt !== null && ball.visible;
    const toward = watching ? Math.atan2(ball.position.x - position.x, ball.position.z - position.z) : face;
    const lookTurn = toward === null ? 0 : Math.atan2(Math.sin(toward - this.cat.yaw), Math.cos(toward - this.cat.yaw));
    this.catModel.root.position.set(this.cat.position.x, this.cat.height, this.cat.position.z);
    this.catModel.root.rotation.y = this.cat.yaw;
    this.catModel.update({
      pose,
      walkPhase: this.cat.walkPhase,
      time: this.elapsed,
      petted: petted ? Math.min(1, (this.elapsed - (this.catPettedAt ?? 0)) / 0.4) : 0,
      look: lookTurn,
    });
  }

  /** A teammate walking past says hello to Mochi, and she answers. */
  /** A meow as each of Mochi's lines starts, and a purr instead while she is stroked. */
  private voiceCat(petted: boolean): void {
    const at = { x: this.cat.position.x, y: this.cat.height + 0.25, z: this.cat.position.z };
    this.sound.setPurr(petted ? at : null);
    const line = this.catSpeech;
    if (line === null || this.elapsed < line.startedAt || this.meowedFor === line.startedAt) {
      return;
    }
    this.meowedFor = line.startedAt;
    if (!petted) {
      this.sound.play("meow", at);
    }
  }

  private greetCat(): void {
    if (this.elapsed - this.catGreetedLast < catGreetCooldown.anyone) {
      return;
    }
    for (const memberId of memberIds) {
      const rig = this.rigs[memberId];
      const last = this.catGreetedBy.get(memberId) ?? Number.NEGATIVE_INFINITY;
      if (
        !rig.avatar.root.visible ||
        !isWalking(rig.actor) ||
        this.elapsed - last < catGreetCooldown.each ||
        distance(rig.actor.position, this.cat.position) > catGreetDistance ||
        this.chatter.speechOf(memberId) !== null
      ) {
        continue;
      }
      this.catGreetedBy.set(memberId, this.elapsed);
      this.catGreetedLast = this.elapsed;
      const line = greetingsForCat[Math.floor(Math.random() * greetingsForCat.length)] ?? "Halo, Mochi.";
      this.chatter.announce(memberId, line, this.elapsed, this.elapsed + 2.5);
      rig.walkHabits.wave(this.elapsed);
      this.catLook = { point: rig.actor.position, until: this.elapsed + 3 };
      this.catSpeech = {
        text: catLine("greeted", Math.random),
        startedAt: this.elapsed + 0.8,
        until: this.elapsed + 2.8,
      };
      return;
    }
  }

  /** Leaving first person puts back what he carried and switched, so nothing is left stuck. */
  private resetAlyx(): void {
    this.alyxHeld = null;
    this.alyxMeal = null;
    this.alyxPiece = null;
    this.alyxHands.hold(null);
    this.foodOrder = dropOrder(this.foodOrder);
    this.alyxOn.clear();
    this.alyxLamps.clear();
    this.applyDaylight();
  }

  /** Seconds since Alyx greeted this teammate while they are still answering, otherwise null. */
  private bossGreeting(memberId: MemberId): number | null {
    const at = this.bossGreetedAt[memberId];
    if (at === undefined || !this.firstPerson.active) {
      return null;
    }
    const since = this.elapsed - at;
    return since <= bossAnswerSeconds ? since : null;
  }

  /**
   * Room for Alyx at `point`: clear of furniture and walls, and not inside anyone. Someone who
   * walks into him can always be stepped away from, so he never gets stuck.
   */
  private alyxCanStand(point: Point): boolean {
    if (!navGrid.isFree(point)) {
      return false;
    }
    const from = this.firstPerson.position;
    return memberIds.every((memberId) => {
      const rig = this.rigs[memberId];
      if (!rig.avatar.root.visible) {
        return true;
      }
      const after = distance(rig.actor.position, point);
      return after >= alyxPersonalSpace || after > distance(rig.actor.position, from);
    });
  }

  /** Draw calls in the last frame, every pass together. */
  drawCalls(): number {
    return this.lastDrawCalls;
  }

  private handleKey(event: KeyboardEvent): void {
    // In free camera and first-person mode the arrows walk instead of orbiting.
    if (this.freeCamera.active || this.firstPerson.active) {
      return;
    }
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
    // Tuned so a 16:10 window shows wall to wall, east wing included; narrower windows back off to keep the width.
    return Math.min(viewLimits.maxDistance, 20.5 * Math.max(1, 1.6 / aspect));
  }

  private createRig(memberId: MemberId, avatar: OfficeAvatar): MemberRig {
    const plan = this.planFor(memberId, Date.now(), null);
    const props = new HandProps(memberPropLooks[memberId]);
    const badge = new StatusBadge();
    this.scene.add(avatar.root, props.root, badge.root);
    this.office.workstations[memberId].screen.setWidget(widgetFor(memberId));
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
      inHandoff: false,
      props,
      hands: this.wrists(avatar),
      laptop: laptopView({ errand: null, arrived: false, stepElapsed: 0, remaining: 0 }),
      sippedIn: null,
      lift: 0,
      typingHands: null,
      mouseHabit: new MouseHabit(this.elapsed),
      workBeats: new WorkBeats(Math.random),
      workBeat: null,
      behavior: "idle",
      glyphIn: glyphEvery(),
      badge,
      reach: { left: null, right: null },
      reachTip: "wrist",
      reachApproach: { left: new Vector3(0, -1, 0), right: new Vector3(0, -1, 0) },
      review: 0,
      sidestep: 0,
      sidestepGoal: 0,
      walkHabits: new WalkHabits(this.elapsed),
      deskHabits: new DeskHabits(deskBits[memberId], Math.random, {
        sip: this.office.workstations[memberId].mugSide,
      }),
      chess: { square: 0, movedBy: null },
      reachRate,
      greeted: null,
      food: { piece: null, pieceStep: null, box: false, owesBin: false, bag: false },
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
    // Room-sized radius: a desk is small next to the room, so a wide radius would gray whole walls.
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
    const handoff = this.handoffs.planFor(memberId);
    if (handoff !== null) {
      // A brief or a report takes over from whatever they were doing, and their break plan
      // starts fresh afterwards.
      if (rig !== null && !rig.inHandoff) {
        this.life.interrupt(memberId, now);
        delete this.lifeSteps[memberId];
        rig.inHandoff = true;
      }
      return { station: handoff.station, action: handoff.action, mood: memberId === "twob" ? "working" : "done" };
    }
    if (rig !== null) {
      rig.inHandoff = false;
    }
    if (memberId === "twob") {
      const mood = this.twobReaction.mood;
      if (mood !== "idle") {
        if (rig !== null && !rig.wasWorking) {
          this.life.interrupt(memberId, now);
        }
        if (rig !== null) {
          rig.wasWorking = true;
        }
        delete this.lifeSteps[memberId];
        return twobPlan(mood, this.life.planFor(memberId, now));
      }
      if (rig !== null) {
        rig.wasWorking = false;
      }
      const step = this.life.planFor(memberId, now);
      this.lifeSteps[memberId] = step;
      return twobPlan("idle", step);
    }
    const behavior = memberBehavior(this.team[memberId], now);
    if (behavior !== "idle") {
      if (rig !== null && !rig.wasWorking) {
        this.life.interrupt(memberId, now);
      }
      if (rig !== null) {
        rig.wasWorking = true;
      }
      delete this.lifeSteps[memberId];
      return memberPlan(memberId, behavior, null);
    }
    if (rig !== null) {
      rig.wasWorking = false;
    }
    const step = this.life.planFor(memberId, now);
    this.lifeSteps[memberId] = step;
    return memberPlan(memberId, "idle", step);
  }

  /**
   * The badge over the head while real work runs (the tool in use, then a check mark), and the
   * fist pump and sparks at the desk the moment the work finishes there.
   */
  private updateWorkStatus(memberId: MemberId, rig: MemberRig, now: number, atDesk: boolean): void {
    const runtime = memberId === "twob" ? null : this.team[memberId];
    const behavior: MemberBehavior = runtime === null ? "idle" : memberBehavior(runtime, now);
    if (rig.behavior === "working" && behavior === "done" && atDesk) {
      rig.workBeats.celebrate();
      const keyboard = this.office.workstations[memberId].keyboard;
      this.deskEffects.burst(keyboard.root.localToWorld(new Vector3(0, 0.25, -0.2)));
    }
    rig.behavior = behavior;
    let kind: BadgeKind | null = null;
    let pop = 0;
    if (behavior === "working") {
      kind = toolKind(runtime?.lastTool ?? null);
    } else if (behavior === "done" && runtime?.finishedAt !== null && runtime !== null) {
      kind = "done";
      pop = (now - (runtime.finishedAt ?? now)) / Math.min(doneDurationMs, 500);
    }
    const head = rig.avatar.poseTarget.node("head");
    if (kind !== null && head !== null && rig.avatar.root.visible) {
      head.getWorldPosition(rig.badge.root.position);
      rig.badge.root.position.y += badgeAboveHead;
    } else {
      kind = null;
    }
    rig.badge.update(kind, this.elapsed, pop);
  }

  /**
   * Hands on the pantry counter: at the coffee machine one hand on the button and the other
   * holding the cup under the spout; at the sink both hands in the basin, scrubbing. Placed by
   * IK on the counter's own points, so they land there whatever the arms' length.
   */
  private counterTargets(rig: MemberRig, action: OfficeAction | null, arrived: boolean): HandTargets | null {
    if (!arrived) {
      return null;
    }
    const { position } = rig.actor;
    // The way from the member to a point, level, with the fingers tipped down onto it.
    const onto = (point: Vector3, down: number): Vector3 => {
      const dx = point.x - position.x;
      const dz = point.z - position.z;
      const length = Math.hypot(dx, dz) || 1;
      return new Vector3(dx / length, -down, dz / length).normalize();
    };
    // Along the counter, at right angles to the way to the point.
    const along = (point: Vector3, side: number): Vector3 => {
      const dx = point.x - position.x;
      const dz = point.z - position.z;
      const length = Math.hypot(dx, dz) || 1;
      return point.clone().add(new Vector3((-dz / length) * side, 0, (dx / length) * side));
    };
    if (action === "brew") {
      const { button, tray } = this.office.pantryReach;
      const press = button.getWorldPosition(new Vector3());
      const cup = tray.getWorldPosition(new Vector3()).add(new Vector3(0, 0.02, 0));
      return {
        left: cup,
        right: press,
        tip: "fingertip",
        approach: onto(press, 0.25),
        board: null,
        rate: 4,
      };
    }
    if (action === "wash") {
      const bowl = this.office.pantryReach.basin.getWorldPosition(new Vector3());
      const scrub = 0.03 * Math.sin(this.elapsed * 9);
      return {
        left: along(bowl, -0.07 + scrub),
        right: along(bowl, 0.07 - scrub),
        tip: "fingertip",
        approach: onto(bowl, 0.9),
        board: null,
        rate: 6,
      };
    }
    if (action === "snack" && (this.elapsed - rig.actionStartedAt) % 4 < 1.4) {
      // Into the fridge for something off the middle shelf; the bites in between are the pose's.
      const shelf = new Vector3(fridgeShelf.x, fridgeShelf.y, fridgeShelf.z);
      return { left: null, right: shelf, tip: "fingertip", approach: onto(shelf, 0.2), board: null, rate: 5 };
    }
    return null;
  }

  /** Advances the member's work surface and returns where the hand should be, if anywhere. */
  private updateSurface(memberId: MemberId, rig: MemberRig, delta: number): HandTargets {
    const action = rig.action;
    if (memberId in this.office.workstations) {
      const { screen, keyboard, mouse } = this.office.workstations[memberId as DeskMember];
      // Nobody types through a cat asleep on the keys.
      // A beat that needs a hand (chin in hand, a stretch, a fist pump) stops the typing for its length.
      const freed = rig.workBeat === null ? null : beatHands(rig.workBeat.kind);
      const typing =
        action === "type" &&
        rig.plan.station === `desk-${memberId}` &&
        !this.catOnKeyboardOf(memberId) &&
        freed?.left !== true &&
        freed?.right !== true;
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
      rig.glyphIn -= typed.length;
      if (typed.length > 0 && rig.glyphIn <= 0) {
        rig.glyphIn = glyphEvery();
        this.deskEffects.emitGlyph(keyboard.root.localToWorld(new Vector3(0, 0.05, 0)));
      }
      if (this.soundOn && typed.length > 0) {
        // A fast burst can type a few characters in one frame; two clicks are enough to hear it.
        const at = keyboard.root.getWorldPosition(keyScratch);
        for (let stroke = 0; stroke < Math.min(2, typed.length); stroke++) {
          this.sound.play("key", at);
        }
      }
      keyboard.update(delta);
      hands.update(delta);
      mouse.update(delta, mousing);
      if (rig.workBeat?.kind === "think" && action === "type") {
        // Chin in the right hand: the wrist just under and in front of the chin, the left hand
        // resting at the front edge of the keyboard.
        const head = rig.avatar.poseTarget.node("head");
        if (head !== null) {
          const chin = head.getWorldPosition(new Vector3());
          const yaw = rig.actor.yaw;
          chin.x += Math.sin(yaw) * 0.1;
          chin.z += Math.cos(yaw) * 0.1;
          chin.y -= 0.07;
          return {
            left: keyboard.root.localToWorld(new Vector3(-0.08, 0.03, 0.09)),
            right: chin,
            tip: "wrist",
            approach: null,
            board: null,
            rate: 4,
          };
        }
      }
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
        solveCcd(arm, withinReach(arm, aim));
        continue;
      }
      const length =
        hand.tip.getWorldPosition(new Vector3()).distanceTo(hand.pivot.getWorldPosition(new Vector3())) +
        fingertipBeyondBone;
      const wrist = aim.clone().addScaledVector(rig.reachApproach[side], -length);
      solveCcd(arm, withinReach(arm, wrist));
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
    // Whoever has gone out through the door is no longer standing at it, so the next one can leave.
    const otherRigs = memberIds
      .filter((other) => other !== memberId && !this.outThroughDoor(other))
      .map((other) => this.rigs[other].actor);
    // Alyx, walking the office in first person, is someone to go around too.
    const alyx = this.firstPerson.active ? [this.firstPerson.position] : [];
    const others = [...otherRigs.map((actor) => actor.position), ...alyx];
    const standing = [...otherRigs.filter((actor) => !isWalking(actor)).map((actor) => actor.position), ...alyx];
    rig.actor = stepActor(rig.actor, plan.station, delta, others, standing);
    const walking = isWalking(rig.actor);
    const arrived = !walking && rig.actor.target === plan.station;
    if (arrived) {
      this.life.arrived(memberId, now);
      this.handoffs.arrived(memberId, plan.station, now);
    }
    let action = walking ? null : plan.action;
    if (action === "pingpong" && !this.opponentReady(memberId)) {
      // The rally starts when the other player is at the table, not while they are still walking.
      action = "pingpong-wait";
    }
    if (action !== rig.action) {
      rig.action = action;
      rig.actionStartedAt = this.elapsed;
    }

    const step = this.lifeSteps[memberId] ?? null;
    const errand = step?.errand ?? null;
    // Errands time themselves on the life clock, from arriving at the step.
    const stepElapsed = arrived && step?.arrivedAt != null ? (now - step.arrivedAt) / 1000 : 0;
    const remaining = arrived && step?.arrivedAt != null ? (step.arrivedAt + step.durationMs - now) / 1000 : Infinity;
    this.mugs[memberId] = stepMug(this.mugs[memberId], {
      desk: `desk-${memberId}`,
      station: plan.station,
      arrived,
      errand,
      action,
      actionElapsed: this.elapsed - rig.actionStartedAt,
    });
    rig.laptop = laptopView({ errand, arrived, stepElapsed, remaining });
    this.updateDeskLock(memberId, errand, arrived, stepElapsed);
    this.updateFood(memberId, rig, step, arrived, stepElapsed, remaining, now);

    const atOwnDesk = action === "desk-idle" && plan.station === `desk-${memberId}`;
    const mug = this.mugs[memberId];
    const deskBit = rig.deskHabits.update(
      this.elapsed,
      atOwnDesk,
      (bit) =>
        (bit !== "sip" || (mug.place === "desk" && mug.level > 0)) &&
        // Alyx has walked off with what this bit needs.
        !(this.alyxHeld?.owner === memberId && deskBitSpec(bit).item === this.alyxHeld.item),
    );
    if (deskBit?.kind === "sip" && deskBit.elapsed >= reachSeconds + 1.5 && rig.sippedIn !== deskBit.startedAt) {
      this.mugs[memberId] = afterSip(mug);
      rig.sippedIn = deskBit.startedAt;
    }
    this.updateDeskItems(memberId, rig, deskBit);
    const atHomeDesk = action !== null && plan.station === `desk-${memberId}` && arrived;
    const typingHere = atHomeDesk && action === "type" && !this.catOnKeyboardOf(memberId);
    this.updateWorkStatus(memberId, rig, now, atHomeDesk);
    rig.workBeat = rig.workBeats.update(delta, atHomeDesk, !typingHere);
    const surfaceTargets = this.updateSurface(memberId, rig, delta);
    const handTargets =
      surfaceTargets !== noHandTargets
        ? surfaceTargets
        : deskBit !== null
          ? this.deskBitTargets(memberId, rig, deskBit)
          : (this.counterTargets(rig, action, arrived) ??
            this.foodTargets(rig, action, errand, arrived, stepElapsed) ??
            this.errandTargets(memberId, rig, errand, arrived, stepElapsed, remaining));
    // Offset each member's idle loops so the room does not move in lockstep.
    const phaseOffset = memberIds.indexOf(memberId) * 1.7;

    const { avatar, actor } = rig;
    // Up onto a board step and down again over a moment, not in one jump.
    rig.lift += (floorHeightAt(actor.position) - rig.lift) * (1 - Math.exp(-stepUpRate * delta));
    avatar.root.position.set(actor.position.x, rig.lift, actor.position.z);
    // Out through the door for food, or home for the night: along the hall and round the corner,
    // gone until the walk back in.
    const doorway = this.outThroughDoor(memberId) ? doorwayWalk(stepElapsed, remaining) : null;
    if (doorway !== null) {
      avatar.root.position.set(doorway.position.x, 0, doorway.position.z);
      // The actor turns from where the walk left off once the next step starts, instead of snapping.
      rig.actor = { ...actor, yaw: doorway.yaw };
    }
    avatar.root.visible = doorway === null || !doorway.gone;
    avatar.root.rotation.y = rig.actor.yaw;
    const seatHeight = stations[plan.station].seatHeight;
    const board = this.boardFocus(rig, handTargets, delta);
    // Something in the right hand while walking: the mug, the laptop on the way to a meeting, or food.
    const foodHeld = rig.food.bag
      ? "food-bag"
      : rig.food.box
        ? "food-box"
        : rig.food.piece === null
          ? null
          : pieceProps[rig.food.piece];
    const folder = rig.inHandoff && action !== "hand-over" ? "folder" : null;
    const carrying =
      this.mugs[memberId].place === "hand" ||
      rig.laptop.place === "hand" ||
      ((foodHeld !== null || folder !== null) && action === null);
    const gimmick = rig.walkHabits.update(this.elapsed, action === null, carrying);
    const pose = officePose({
      action: doorway?.walking === true ? null : action,
      walkPhase: doorway?.walking === true ? doorway.walkPhase : actor.walkPhase,
      time: this.elapsed + phaseOffset,
      actionElapsed: this.elapsed - rig.actionStartedAt,
      seat: action === null || seatHeight === null ? null : fitSeat(avatar.legs, seatHeight),
      keystrokes: rig.keystrokes,
      carrying,
      board,
      walkStyle: walkStyles[memberId],
      gimmick,
      chatter: this.chatter.reactionOf(memberId),
      chatGesture: this.chatter.gestureOf(memberId),
      lookYaw: this.lookYawFor(memberId, rig, gimmick?.kind === "wave"),
      bossWave: this.bossGreeting(memberId),
      pingpongBeat:
        action === "pingpong" && this.office.pingpongBall.visible
          ? pingpongBeat(this.elapsed, rig.actor.target === "pingpong-west" ? "west" : "east")
          : null,
      deskBit,
      fetchSide: this.errandSide(memberId, errand),
      workBeat: rig.workBeat,
    });
    rig.poseApplier.apply(avatar.poseTarget, pose, delta);

    const answering = this.bossGreeting(memberId);
    // The right hand leaves the keys or whatever it holds to wave back at the boss.
    const waving =
      answering !== null && action !== null && answering >= bossWaveWindow.from && answering <= bossWaveWindow.to;
    const lifting = this.catLiftTargets(memberId);
    this.reachFor(rig, lifting ?? (waving ? { ...handTargets, right: null } : handTargets), delta);

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
    rig.expressions = stepExpressionWeights(
      rig.expressions,
      answering === null ? targets : { ...targets, happy: 0.8 },
      delta,
    );
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
    // Rias drinks from a teacup; everyone else from their mug.
    const cup = memberId === "rias" ? "teacup" : "mug";
    const asCup = (kind: HandPropKind | null): HandPropKind | null => (kind === "mug" ? cup : kind);
    const fromDesk = asCup(deskBit === null ? null : deskBitProp(deskBit));
    const carried = rig.laptop.place === "hand" ? "laptop" : this.mugs[memberId].place === "hand" ? cup : null;
    const held =
      action !== null && usesHandIk(action)
        ? null
        : (foodHeld ??
          (rig.inHandoff ? "folder" : null) ??
          fromDesk ??
          plate ??
          (carried === "laptop" ? carried : null) ??
          asCup(propForAction(action)) ??
          carried ??
          onPhone);
    // Whatever was just taken stays in the hand that took it until the walk starts.
    const side =
      fromDesk !== null && deskBit !== null
        ? deskBit.hand
        : action === null
          ? "right"
          : this.errandSide(memberId, errand);
    rig.props.show(held, side);
    rig.props.setFill(this.mugs[memberId].level);
    rig.props.follow(rig.hands, rig.actor.yaw);
  }

  /**
   * Pairs at the bar, the high table or the pantry talk; anyone walking past a teammate on a break
   * waves and says hello.
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
    const westLeft = settledAt("bar-west-left", "chat");
    const westRight = settledAt("bar-west-right", "chat");
    if (westLeft !== null && westRight !== null) {
      pairs.push([westLeft, westRight]);
    }
    // At the high table, the first two to settle talk with each other.
    const huddling = (["collab-1", "collab-2", "collab-3"] as const)
      .map((station) => settledAt(station, "chat"))
      .filter((memberId): memberId is MemberId => memberId !== null);
    const [first, second] = huddling;
    if (first !== undefined && second !== undefined) {
      pairs.push([first, second]);
    }
    // At lunch, the two across the table from each other talk.
    for (let seat = 0; seat < 5; seat++) {
      const near = meetingStationIds[seat];
      const across = meetingStationIds[seat + 5];
      const first = near === undefined ? null : settledAt(near, "lunch");
      const second = across === undefined ? null : settledAt(across, "lunch");
      if (first !== null && second !== null) {
        pairs.push([first, second]);
      }
    }
    pairs.push(...this.updateStandup(settledAt));
    const brewing = settledAt("coffee", "brew");
    if (brewing !== null && brewing !== this.lastBrewer) {
      const machine = stations.coffee.spot;
      this.sound.play("coffee", { x: machine.x, y: 1, z: machine.z });
    }
    this.lastBrewer = brewing;
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

  /**
   * The round of updates at standup: the lead opens, everyone who came says what they finished
   * and what is next, the lead closes. After the round, neighbors in the circle chat quietly until
   * it breaks up. Returns those chatting pairs.
   */
  private updateStandup(
    settledAt: (station: StationId, action: OfficeAction) => MemberId | null,
  ): [MemberId, MemberId][] {
    const [leadSpot, ...circle] = standupStationIds;
    const lead = leadSpot === undefined ? null : settledAt(leadSpot, "standup-lead");
    const present = circle
      .map((station) => settledAt(station, "standup"))
      .filter((memberId): memberId is MemberId => memberId !== null);
    if (present.length === 0) {
      this.standup = { startedAt: null, order: [] };
      return [];
    }
    for (const memberId of [...(lead === null ? [] : [lead]), ...present]) {
      if (!this.standup.order.includes(memberId)) {
        this.standup.order.push(memberId);
      }
    }
    // It starts once the lead is at the board with someone to talk to, or without a lead once a
    // few have gathered.
    if (this.standup.startedAt === null && ((lead !== null && present.length > 0) || present.length >= 3)) {
      this.standup.startedAt = this.elapsed;
      const board = stations[leadSpot ?? "standup-1"].spot;
      this.sound.play("gong", { x: board.x, y: 1.4, z: board.z });
    }
    if (this.standup.startedAt === null) {
      return [];
    }
    const speakerOrder = this.standup.order.filter((memberId) => memberId === lead || present.includes(memberId));
    const opener = lead ?? speakerOrder[0];
    if (opener === undefined) {
      return [];
    }
    const turn = standupTurn(opener, speakerOrder, this.elapsed - this.standup.startedAt, officeDay(this.clock()));
    if (turn !== null) {
      const startedAt = this.elapsed - turn.elapsed;
      this.chatter.announce(turn.speaker, turn.text, startedAt, startedAt + standupTurnSeconds - 0.3);
      return [];
    }
    const pairs: [MemberId, MemberId][] = [];
    for (let index = 0; index + 1 < present.length; index += 2) {
      pairs.push([present[index] as MemberId, present[index + 1] as MemberId]);
    }
    return pairs;
  }

  /** Head turn toward a conversation partner, or toward whoever is being waved at. */
  private lookYawFor(memberId: MemberId, rig: MemberRig, waving: boolean): number {
    if (this.bossGreeting(memberId) !== null) {
      const boss = this.firstPerson.position;
      const { position, yaw } = rig.actor;
      return angleDelta(yaw, Math.atan2(boss.x - position.x, boss.z - position.z));
    }
    const handing = waving ? null : this.handoffs.partnerOf(memberId);
    const other = waving ? rig.greeted : (handing ?? this.chatter.partnerOf(memberId));
    if (other === null) {
      return 0;
    }
    // In conversation the turn follows the gaze: the opener looks over first, the other after.
    const weight = waving || handing !== null ? 1 : this.chatter.gazeOf(memberId);
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
    const meow = this.catSpeech;
    if (meow !== null && this.elapsed >= meow.startedAt && this.elapsed < meow.until) {
      const point = new Vector3(this.cat.position.x, this.cat.height + 0.32, this.cat.position.z).project(this.camera);
      if (point.z <= 1 && Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1) {
        anchors.push({
          memberId: "mochi",
          text: meow.text,
          x: ((point.x + 1) / 2) * width,
          y: ((1 - point.y) / 2) * height,
          shownFor: this.elapsed - meow.startedAt,
        });
      }
    }
    return anchors;
  }

  /** The side of the body the current errand's thing is on, which the reaching hand comes from. */
  private errandSide(memberId: MemberId, errand: Errand | null): ArmSide {
    const workstation = this.office.workstations[memberId];
    switch (errand) {
      case "get-mug":
        return workstation.mugSide;
      // Standing at the sink facing the wall, the rack is on the left.
      case "rack-mug":
        return "left";
      case "fetch-laptop":
      case "stow-laptop":
        // The desk faces the sitter with its own -x on their left.
        return workstation.drawer !== null && workstation.drawer.position.x < 0 ? "left" : "right";
      default:
        return "right";
    }
  }

  /**
   * The shared food changing hands: a piece taken at the bar (the last one makes the taker bin
   * the box), the empty box carried to the bin, and the fresh food brought in from outside. A
   * member called away halfway never leaves things half done: an owed box is binned and fetched
   * food is on the bar at once.
   */
  private updateFood(
    memberId: MemberId,
    rig: MemberRig,
    step: LifeChoice | null,
    arrived: boolean,
    stepElapsed: number,
    remaining: number,
    now: number,
  ): void {
    const hands = rig.food;
    const errand = step?.errand ?? null;
    const eating = step !== null && step.action === "eat";
    if (!eating) {
      hands.piece = null;
    }
    if (eating && arrived && stepElapsed >= pieceTakeSeconds && hands.pieceStep !== step.chosenAt) {
      hands.pieceStep = step.chosenAt;
      const taken = takePiece(this.food);
      this.food = taken.food;
      if (taken.took && this.food.kind !== null) {
        hands.piece = this.food.kind;
      }
      if (taken.emptied) {
        hands.owesBin = true;
        this.life.insertNext(
          memberId,
          [
            { station: "bar-food", action: "fetch", errand: "take-box" },
            { station: "trash", action: "fetch", errand: "bin-box" },
          ],
          now,
        );
      }
    }
    if (hands.owesBin && errand === "take-box" && arrived && stepElapsed >= foodHandoverSeconds) {
      // Off the bar it counts as binned, which starts the wait for the next food run.
      this.food = binBox(this.food, Date.now());
      hands.owesBin = false;
      hands.box = true;
    } else if (hands.owesBin && !eating && errand !== "take-box") {
      this.food = binBox(this.food, Date.now());
      hands.owesBin = false;
    }
    const binned = errand === "bin-box" && arrived && stepElapsed >= foodHandoverSeconds;
    if (hands.box && ((errand !== "take-box" && errand !== "bin-box") || binned)) {
      hands.box = false;
    }
    if (errand === "go-out" && arrived && remaining <= doorwayReturnSeconds) {
      hands.bag = true;
    }
    const setDown = errand === "set-food" ? arrived && stepElapsed >= foodHandoverSeconds : errand !== "go-out";
    if (hands.bag && setDown) {
      this.food = deliver(this.food);
      hands.bag = false;
    }
  }

  /** The hand onto the food at the end of the bar, or onto the bin, while food changes hands. */
  private foodTargets(
    rig: MemberRig,
    action: OfficeAction | null,
    errand: Errand | null,
    arrived: boolean,
    stepElapsed: number,
  ): HandTargets | null {
    if (!arrived) {
      return null;
    }
    const reaching =
      (action === "eat" && errand === null && stepElapsed < pieceTakeSeconds + 0.1) ||
      ((errand === "take-box" || errand === "set-food") && stepElapsed < foodHandoverSeconds + 0.2);
    const binning = errand === "bin-box" && stepElapsed < foodHandoverSeconds + 0.2;
    let target: Vector3 | null = null;
    if (reaching) {
      target = new Vector3(barFoodSpot.x, surface.barTable + 0.03, barFoodSpot.z);
    } else if (binning && trashBin !== undefined) {
      target = new Vector3(trashBin.x, 0.42, trashBin.z);
    }
    if (target === null) {
      return null;
    }
    return {
      left: null,
      right: target,
      tip: "fingertip",
      approach: this.fingersDown(rig),
      board: null,
      rate: deskReachRate,
    };
  }

  /**
   * Where the hand goes during an errand: onto the mug, into the drawer, onto the desk laptop's lid,
   * or onto the laptop at the meeting seat while setting it down and packing it up.
   */
  private errandTargets(
    memberId: MemberId,
    rig: MemberRig,
    errand: Errand | null,
    arrived: boolean,
    stepElapsed: number,
    remaining: number,
  ): HandTargets {
    if (errand === null || !arrived) {
      return noHandTargets;
    }
    const workstation = this.office.workstations[memberId];
    const t = stepElapsed;
    let target: Vector3 | null = null;
    switch (errand) {
      case "get-mug":
        target = t < mugPickSeconds + 0.2 ? workstation.mug.getWorldPosition(new Vector3()) : null;
        break;
      case "rack-mug":
        target =
          t < mugPickSeconds + 0.2
            ? this.office.rackCups[memberId].getWorldPosition(new Vector3()).setY(surface.counter + 0.04)
            : null;
        break;
      case "fetch-laptop":
      case "stow-laptop": {
        const until = errand === "fetch-laptop" ? laptopTakeSeconds : laptopPutSeconds;
        if (t < until + 0.25) {
          target =
            workstation.drawer !== null
              ? workstation.drawer.getWorldPosition(new Vector3())
              : (workstation.lid?.localToWorld(new Vector3(0, 0.22, 0)) ?? null);
        }
        break;
      }
      case "meeting-laptop": {
        const seat = meetingStationIds.indexOf(rig.plan.station as (typeof meetingStationIds)[number]);
        const laptop = this.office.meetingLaptops[seat];
        if (laptop !== undefined && (t < 1 || remaining < 1.8)) {
          target = laptop.root.getWorldPosition(new Vector3()).setY(surface.desk + 0.03);
        }
        break;
      }
      case "pack-up":
      case "unpack": {
        // A laptop's lid is shut or opened by its top edge; a desk PC is locked or signed into
        // at the keyboard.
        const [from, to] =
          workstation.lid !== null
            ? errand === "pack-up"
              ? [1.6, 2.7]
              : [0.3, 1.4]
            : errand === "pack-up"
              ? [0.6, lockAt + 0.2]
              : [signInFrom - 0.2, signedInAt];
        if (t >= from && t <= to) {
          target =
            workstation.lid !== null
              ? workstation.lid.localToWorld(new Vector3(0, 0.22, 0))
              : workstation.keyboard.root.getWorldPosition(new Vector3()).add(new Vector3(0, 0.03, 0));
        }
        break;
      }
      case "wash-mug":
        break;
    }
    if (target === null) {
      return noHandTargets;
    }
    const side = this.errandSide(memberId, errand);
    return {
      left: side === "left" ? target : null,
      right: side === "right" ? target : null,
      tip: "fingertip",
      approach: this.fingersDown(rig),
      board: null,
      rate: deskReachRate,
    };
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
      object.visible = item !== held && this.alyxHeld?.object !== object;
    }
    const mug = this.mugs[memberId];
    workstation.mug.visible = mug.place === "desk" && held !== "mug";
    setCupFill(workstation.mug, mug.level);
    this.office.rackCups[memberId].visible = mug.place === "rack";
    const { laptop } = rig;
    if (workstation.drawer !== null) {
      workstation.drawer.position.z = (workstation.drawer.userData.restZ as number) + drawerTravel * laptop.drawer;
    }
    if (workstation.lid !== null) {
      // The desk laptop itself goes to the meeting: keys and lid leave the desk together.
      const home = laptop.place === "home";
      workstation.lid.visible = home;
      workstation.keyboard.root.visible = home;
      const open = workstation.lid.userData.openAngle as number;
      workstation.lid.rotation.x = deskLidClosedAngle + (open - deskLidClosedAngle) * laptop.lid;
    }
    const { gadget } = workstation;
    gadget?.update(bit !== null && bit.kind === gadget.bit ? bit : null, this.elapsed);
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
    let tip: HandTargets["tip"] = "fingertip";
    const { gadget } = workstation;
    if (reachingForItem(bit) && spec.item !== null) {
      const item = spec.item === "mug" ? workstation.mug : workstation.items[spec.item];
      target = item?.getWorldPosition(new Vector3()) ?? null;
    } else if (gadget !== null && bit.kind === gadget.bit) {
      target = gadget.handTarget(bit);
      tip = gadget.tip;
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
    } else if (bit.kind === "key-tap" && workstation.items["security-key"] !== undefined) {
      // A couple of taps on the key's gold contact, the finger lifting off between them.
      const press = Math.max(0, Math.sin(bit.elapsed * 7));
      target = workstation.items["security-key"].localToWorld(new Vector3(0, 0.03 + 0.012 * press, 0.026));
    } else if (
      (bit.kind === "sticky" || bit.kind === "notes" || bit.kind === "sketch") &&
      workstation.writingPad !== null
    ) {
      // Short strokes across the note, notebook or tablet, the pen lifting off between them.
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
      left: bit.hand === "left" ? target : null,
      right: bit.hand === "right" ? target : null,
      tip,
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
    this.office.tv.update(delta, onSofa("game") ? "game" : onSofa("watch") || this.alyxOn.has("tv") ? "show" : "off");
    this.office.arcades.forEach((screen, index) => {
      const station = arcadeStationIds[index];
      const playing = (station !== undefined && usingAt(station, "arcade")) || this.alyxOn.has(`arcade:${index}`);
      screen.update(delta, playing ? "playing" : "attract");
    });
    this.office.treadmills.forEach((treadmill, index) => {
      const station = treadmillStationIds[index];
      treadmill.update(station !== undefined && usingAt(station, "run"), delta);
    });
    const boxer = memberIds.find((memberId) => {
      const rig = this.rigs[memberId];
      return rig.action === "box" && rig.plan.station === "punching-bag";
    });
    this.office.punchingBag.update(boxer === undefined ? null : this.elapsed - this.rigs[boxer].actionStartedAt, delta);
    this.office.aquarium.update(this.elapsed);
    this.office.rackLights.update(this.elapsed, usingAt("rack", "rack"));
    this.updateAlyxGame();
    this.updatePingpongBall(
      (usingAt("pingpong-west", "pingpong") && usingAt("pingpong-east", "pingpong")) || this.alyxRally(),
    );
    this.office.fridgeDoor.update(usingAt("fridge", "snack") || this.alyxOn.has("fridge"), delta);
    const door = stations.door.spot;
    this.foodOrder = stepOrder(this.foodOrder, Date.now());
    this.updateAlyxMeal();
    this.clearForgottenBox();
    this.deliveryBag.visible = this.foodOrder?.phase === "at-door";
    const doorOpen =
      courierAtDoor(this.foodOrder, Date.now()) ||
      memberIds.some((memberId) => {
        const rig = this.rigs[memberId];
        return rig.avatar.root.visible && distance(rig.actor.position, door) < doorOpenDistance;
      });
    this.office.entryDoor.update(doorOpen, delta);
    if (doorOpen !== this.doorWasOpen) {
      this.doorWasOpen = doorOpen;
      this.sound.play(doorOpen ? "door-open" : "door-close", { x: door.x, y: 1, z: door.z });
    }
    this.office.barFood.update(this.food, delta);
    this.office.sink.update(usingAt("sink", "wash"), this.elapsed);
    const cook = memberIds.find((memberId) => {
      const rig = this.rigs[memberId];
      return rig.action === "oven" && rig.plan.station === "oven";
    });
    const step = cook === undefined ? null : ovenStep(this.elapsed - this.rigs[cook].actionStartedAt);
    this.office.oven.update(step?.oven ?? "off", step?.foodInside ?? false, delta, this.elapsed);
    this.office.lunchBoxes.forEach((lunch, index) => {
      const seat = meetingStationIds[index];
      lunch.visible = memberIds.some((memberId) => {
        const step = this.lifeSteps[memberId];
        return step?.activity === "lunch" && step.station === seat && step.arrivedAt !== null;
      });
    });
    this.office.meetingLaptops.forEach((laptop, index) => {
      const seat = meetingStationIds[index];
      const owner = memberIds.find(
        (memberId) =>
          this.lifeSteps[memberId]?.errand === "meeting-laptop" &&
          this.rigs[memberId].plan.station === seat &&
          this.rigs[memberId].laptop.place === "seat",
      );
      if (owner === undefined) {
        // Alyx's own, opened at an empty seat.
        laptop.update(
          delta,
          this.alyxOn.has(`laptop:${index}`) ? { lid: 1, screenOn: true, shell: alyxLaptopShell } : null,
        );
        return;
      }
      const { lid, screenOn } = this.rigs[owner].laptop;
      laptop.update(delta, { lid, screenOn, shell: memberPropLooks[owner].shell });
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
      this.lastRallyLeg = null;
      return;
    }
    const west = stations["pingpong-west"].spot;
    const east = stations["pingpong-east"].spot;
    const leg = rallyLeg(this.elapsed);
    if (this.lastRallyLeg !== null) {
      for (const hit of rallyHits(this.lastRallyLeg, leg)) {
        this.sound.play(hit, ball.position);
      }
    }
    this.lastRallyLeg = leg;
    // 0..1 west to east, 1..2 back again; the ends stay just inside the paddles.
    const t = leg < 1 ? leg : 2 - leg;
    const fromX = west.x + 0.3;
    const toX = east.x - 0.3;
    // Two hops per crossing: one over the net, one off the receiver's half.
    const hop = Math.abs(Math.sin(t * Math.PI * 2));
    ball.position.set(fromX + (toX - fromX) * t, surface.pingpong + 0.02 + 0.16 * hop, west.z);
  }

  private chooseFocus(now: number): CloseupFocus | null {
    if (this.pinned !== null) {
      const memberId = this.pinned;
      const row = statusRows(this.team, this.twobStatus, now, (memberId) => this.presenceOf(memberId)).find(
        (candidate) => candidate.memberId === memberId,
      );
      const detail = row === undefined ? "" : rowDetail(row, now);
      const status = row === undefined ? "" : ` · ${statusLabels[row.status]}${detail === "" ? "" : ` (${detail})`}`;
      return { memberId, label: `${this.focusLabel(memberId, null)}${status}` };
    }
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
    const tool = best.memberId === "twob" ? null : this.team[best.memberId].lastTool;
    const focus = { memberId: best.memberId, label: this.focusLabel(best.memberId, tool) };
    this.heldFocus = { focus, shot: this.liveShot(best.memberId), until: now + closeupHoldMs };
    return focus;
  }

  /** At the door on the way out for food or home: walking the hall, round the corner, or back in. */
  private outThroughDoor(memberId: MemberId): boolean {
    const errand = this.lifeSteps[memberId]?.errand;
    const actor = this.rigs[memberId].actor;
    return (errand === "go-out" || errand === "go-home") && actor.target === "door" && !isWalking(actor);
  }

  /** In the room, out for food, or gone home: only once they have walked out of sight. */
  private presenceOf(memberId: MemberId): Presence {
    if (this.rigs[memberId].avatar.root.visible) {
      return "in";
    }
    const errand = this.lifeSteps[memberId]?.errand;
    return errand === "go-home" ? "home" : errand === "go-out" ? "out" : "in";
  }

  /** "Name · Role · what they are doing", with the tool when there is one. */
  private focusLabel(memberId: MemberId, tool: string | null): string {
    const rig = this.rigs[memberId];
    const profile = roster[memberId];
    const home = this.lifeSteps[memberId]?.errand === "go-home";
    const activity = home
      ? rig.avatar.root.visible
        ? "heading home"
        : "gone home"
      : rig.action === null
        ? "walking"
        : actionLabels[rig.action];
    return `${profile.displayName} · ${profile.role} · ${activity}${tool === null ? "" : ` (${tool})`}`;
  }

  /** Shows a member's close-up until it is closed with null, as a preview of what they are up to. */
  pinCloseup(memberId: MemberId | null): void {
    this.pinned = memberId;
    this.heldFocus = null;
  }

  pinnedMember(): MemberId | null {
    return this.pinned;
  }

  /** The team member under a point on the page, nearest the camera first, or null for none. */
  memberAt(clientX: number, clientY: number): MemberId | null {
    const box = this.canvas.getBoundingClientRect();
    const toScreen = (point: Vector3): { x: number; y: number; depth: number } => {
      const projected = point.clone().project(this.camera);
      return {
        x: box.left + ((projected.x + 1) / 2) * box.width,
        y: box.top + ((1 - projected.y) / 2) * box.height,
        depth: projected.z,
      };
    };
    let hit: { memberId: MemberId; depth: number } | null = null;
    for (const memberId of memberIds) {
      const rig = this.rigs[memberId];
      if (!rig.avatar.root.visible) {
        continue;
      }
      const { x, z } = rig.actor.position;
      const feet = toScreen(new Vector3(x, rig.lift, z));
      // A seated person's head is lower, but the standing height still covers them comfortably.
      const head = toScreen(new Vector3(x, rig.lift + 1.05, z));
      const halfWidth = Math.max(8, (feet.y - head.y) * 0.22);
      const inside = clientY >= head.y && clientY <= feet.y && Math.abs(clientX - (feet.x + head.x) / 2) <= halfWidth;
      if (inside && feet.depth < 1 && (hit === null || feet.depth < hit.depth)) {
        hit = { memberId, depth: feet.depth };
      }
    }
    return hit?.memberId ?? null;
  }

  /** True when a point on the page is over the team status board on the back wall. */
  statusBoardAt(clientX: number, clientY: number): boolean {
    const box = this.canvas.getBoundingClientRect();
    const pointer = new Vector2(
      ((clientX - box.left) / box.width) * 2 - 1,
      -((clientY - box.top) / box.height) * 2 + 1,
    );
    this.pointerRay.setFromCamera(pointer, this.camera);
    return this.pointerRay.intersectObject(this.office.statusBoard.face, false).length > 0;
  }

  /** The status board's rows right now, for showing them large on the page. */
  statusNow(): { rows: StatusRow[]; now: number } {
    const now = Date.now();
    return { rows: statusRows(this.team, this.twobStatus, now, (memberId) => this.presenceOf(memberId)), now };
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
    const rig = this.rigs[memberId];
    // A previewed member away from their desk: follow them instead of showing an empty chair.
    if (memberId === this.pinned && !(rig.plan.station === `desk-${memberId}` && !isWalking(rig.actor))) {
      const { x, z } = rig.actor.position;
      return {
        eye: new Vector3(x + 0.85, rig.lift + 1.25, z + 1.05),
        target: new Vector3(x, rig.lift + 0.55, z),
      };
    }
    return this.office.closeups[memberId];
  }

  /**
   * The desk screen while its owner packs up, is away for the night, and signs back in: their
   * photo and name on a lock screen, the password dots filling in on the way back.
   */
  private updateDeskLock(memberId: MemberId, errand: Errand | null, arrived: boolean, stepElapsed: number): void {
    if (!(memberId in this.office.workstations)) {
      return;
    }
    const state = deskLock(errand, arrived, stepElapsed);
    const screen = this.office.workstations[memberId as DeskMember].screen;
    // The extra monitors go to sleep with the desk, near black rather than off, the way a
    // dimmed panel still catches a little light.
    const sleeping = state.kind !== "open";
    for (const panel of this.office.sideScreens[memberId as DeskMember]) {
      panel.color.setScalar(sleeping ? 0.06 : 1);
    }
    if (state.kind === "open") {
      screen.setLock(null);
      return;
    }
    const lock = {
      name: roster[memberId].displayName,
      photo: this.memberPhoto(memberId),
      clock: clockFace(jakartaTime(this.clock()), false),
      typed: state.kind === "signing-in" ? state.typed : null,
    };
    screen.setLock(lock);
  }

  /**
   * A head-and-shoulders photo of a member for their lock screen, taken once from their own model:
   * the avatar alone in a small lit scene, so a monitor in front of them is not in the shot.
   * Null until their real model has loaded.
   */
  private memberPhoto(memberId: MemberId): HTMLCanvasElement | null {
    const cached = this.photos.get(memberId);
    if (cached !== undefined) {
      return cached;
    }
    const avatar = this.rigs[memberId].avatar;
    const head = avatar.kind === "vrm" ? avatar.poseTarget.node("head") : null;
    if (head === null) {
      return null;
    }
    const size = 192;
    const target = new WebGLRenderTarget(size, size);
    target.texture.colorSpace = SRGBColorSpace;
    const studio = new Scene();
    studio.background = new Color("#3d2a63");
    const key = new DirectionalLight(0xffffff, 2.2);
    studio.add(new AmbientLight(0xffffff, 1.1), key);
    const parent = avatar.root.parent;
    const wasVisible = avatar.root.visible;
    avatar.root.visible = true;
    avatar.root.updateMatrixWorld(true);
    const face = head.getWorldPosition(new Vector3()).add(new Vector3(0, 0.03, 0));
    const yaw = avatar.root.rotation.y;
    const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const camera = new PerspectiveCamera(22, 1, 0.05, 10);
    camera.position.copy(face).addScaledVector(forward, 0.75);
    camera.lookAt(face);
    key.position.copy(camera.position).add(new Vector3(0.3, 0.5, 0));
    studio.add(avatar.root);
    const previous = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(target);
    this.renderer.render(studio, camera);
    const pixels = new Uint8Array(size * size * 4);
    this.renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
    this.renderer.setRenderTarget(previous);
    parent?.add(avatar.root);
    avatar.root.visible = wasVisible;
    target.dispose();
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (context === null) {
      console.error("[office] no 2D canvas for a lock screen photo");
      return null;
    }
    // The render target's rows run bottom up; the canvas's top down.
    const image = context.createImageData(size, size);
    for (let row = 0; row < size; row++) {
      image.data.set(pixels.subarray((size - 1 - row) * size * 4, (size - row) * size * 4), row * size * 4);
    }
    context.putImageData(image, 0, 0);
    this.photos.set(memberId, canvas);
    return canvas;
  }

  /** Out the door for the night, not just walking toward it. */
  private goneHome(memberId: MemberId): boolean {
    return this.lifeSteps[memberId]?.errand === "go-home" && !this.rigs[memberId].avatar.root.visible;
  }

  /** The time of day in the office, Jakarta time. */
  private dayPart(): DayPart {
    return dayPart(jakartaHours(this.clock()));
  }

  /**
   * Follows the Jakarta clock: daylight gives way to the office lights and the neon, the sun
   * turns orange through dawn and dusk, and the desk lamps come on for the evening.
   */
  private applyDaylight(): void {
    const sky = skyAt(jakartaHours(this.clock()));
    const { night, twilight } = sky;
    const mix = (key: keyof typeof lighting.day): number =>
      lighting.day[key] + (lighting.night[key] - lighting.day[key]) * night;
    this.hemisphere.intensity = mix("hemisphere");
    this.hemisphere.color.copy(roomDay).lerp(roomNight, night);
    this.sun.intensity = mix("sun");
    this.sun.color
      .copy(sunDay)
      .lerp(sunNight, night)
      .lerp(sunTwilight, 0.6 * twilight);
    this.windowFill.intensity = mix("windowFill");
    for (const light of this.neonGlow) {
      light.intensity = mix("neonGlow");
    }
    this.renderer.toneMappingExposure = mix("exposure");
    this.office.setSky(sky);
    // On once it is getting dark, not at the first hint of dusk, and only for whoever is still in.
    const lamps = Math.min(1, Math.max(0, (night - 0.35) / 0.4));
    this.autoLamps = lamps;
    const away = memberIds.filter((memberId) => this.goneHome(memberId));
    for (const memberId of memberIds) {
      const own = this.alyxLamps.get(memberId);
      this.office.workstations[memberId].lamp.setLevel(
        own === undefined ? (away.includes(memberId) ? 0 : lamps) : own ? 1 : 0,
      );
    }
    // The room lights go down as the office empties out for the night.
    const emptied = (away.length / memberIds.length) * night;
    this.hemisphere.intensity *= 1 - 0.45 * emptied;
    this.windowFill.intensity *= 1 - 0.3 * emptied;
    // The ceiling panels are the room lights Alyx looks up at, so they go down with them.
    this.office.enclosure.setLight(1 - 0.6 * emptied);
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
    const pace = paceFrame(timestamp, this.frameDueAt, this.display.fpsCap);
    this.frameDueAt = pace.dueAt;
    if (!pace.draw) {
      return;
    }
    const started = performance.now();
    this.timer.update(timestamp);
    const rawDelta = this.timer.getDelta();
    const delta = Math.min(rawDelta, 0.1);
    this.renderer.info.reset();
    this.elapsed += delta;
    const now = Date.now();
    this.onFrame();
    if (this.soundOn) {
      // Last frame's camera: a frame behind is nothing to the ear.
      this.soundRight.setFromMatrixColumn(this.camera.matrixWorld, 0);
      this.sound.setListener({
        position: this.camera.position,
        right: { x: this.soundRight.x, z: this.soundRight.z },
      });
    }

    this.updateChatter(delta);
    this.handoffs.update(now);
    const membersFrom = performance.now();
    for (const memberId of memberIds) {
      this.updateMember(memberId, delta, now);
    }
    this.teamMs += (performance.now() - membersFrom - this.teamMs) * 0.1;
    this.updateProps(delta);
    this.updateCat(delta, now);
    this.deskEffects.update(delta);
    if (now - this.lastDaylightAt > 1000) {
      this.lastDaylightAt = now;
      this.applyDaylight();
    }
    this.office.neon.update(this.elapsed, this.night);
    if (this.office.enclosure.root.visible) {
      this.office.enclosure.neon.update(this.elapsed, this.night);
    }
    this.office.wallClock.update(this.clock());
    this.office.statusBoard.update(
      statusRows(this.team, this.twobStatus, now, (memberId) => this.presenceOf(memberId)),
      now,
    );
    this.focus = this.chooseFocus(now);
    if (this.firstPerson.active) {
      this.crouchToCat();
      // The real time step, so walking keeps its pace even when frames are slow.
      this.firstPerson.update(Math.min(rawDelta, 0.25));
    } else if (this.freeCamera.active) {
      // The real time step, so walking keeps its pace even when frames are slow.
      this.freeCamera.update(Math.min(rawDelta, 0.25));
    } else {
      this.drift(delta, now);
      this.controls.update(delta);
    }

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, width, height);
    this.renderer.shadowMap.needsUpdate = true;
    // Ambient occlusion costs a second pass over the whole scene. At eye height in first person
    // that pass is most of the frame and the shading it adds is hard to see, so Alyx goes without.
    if (this.composer !== null && !this.firstPerson.active) {
      this.composer.render(delta);
    } else {
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
    }
    if (this.firstPerson.active) {
      const { walked, speed } = this.firstPerson.stride;
      const wave = this.alyxWaveAt === null ? null : this.elapsed - this.alyxWaveAt;
      const game = this.alyxGame;
      const swing =
        game !== null && this.alyxRally()
          ? pingpongSwing(pingpongBeat(this.elapsed, game.station === "pingpong-west" ? "west" : "east"))
          : 0;
      this.alyxHands.update(
        this.camera,
        walked,
        speed,
        {
          wave: wave !== null && wave <= waveSeconds ? wave : null,
          holding:
            this.alyxHeld !== null || game !== null || this.foodOrder?.phase === "in-hand" || this.alyxMeal !== null,
          swing,
          pet:
            this.catPettedAt !== null && this.elapsed - this.catPettedAt < catPetSeconds
              ? this.elapsed - this.catPettedAt
              : null,
          petAt: this.catInView(),
          phone: this.phoneShown(),
          eating: this.alyxEating(),
          // The same time as the wall clock: the computer's clock, in the office's time zone.
          time: jakartaTime(this.clock()),
        },
        this.night,
        Math.min(rawDelta, 0.25),
      );
      this.alyxHands.render(this.renderer);
    }

    if ((this.closeupEnabled || this.pinned !== null) && this.focus !== null) {
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
      // Close-up shots are framed for the open room and some start outside where a wall would be.
      const enclosure = this.office.enclosure.root;
      const enclosed = enclosure.visible;
      enclosure.visible = false;
      this.renderer.render(this.scene, this.closeupCamera);
      enclosure.visible = enclosed;
      this.renderer.setScissorTest(false);
    }
    this.lastDrawCalls = this.renderer.info.render.calls;
    this.cpuMs += (performance.now() - started - this.cpuMs) * 0.1;
  }
}
