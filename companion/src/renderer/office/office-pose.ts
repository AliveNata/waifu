import { addRotation, armsRelaxed, type BoneRotation, type Pose, type PoseBones } from "../common/pose.js";
import { petPhase } from "./cat-petting.js";
import {
  type ActiveDeskBit,
  calendarStep,
  deskBitEnvelope,
  moodboardStep,
  piStep,
  reachingForItem,
  reachSeconds,
  safeStep,
  stampStep,
} from "./desk-habits.js";
import { type EatStyle, eatStyleFor, lunchMoment, speakerGestureKinds } from "./lunch-eating.js";
import type { ChatGesture, ChatReaction } from "./office-chatter.js";
import { type OfficeAction, ovenStep } from "./office-director.js";
import { people } from "./office-plan.js";
import type { SeatFit } from "./seating.js";
import type { ActiveGimmick, WalkStyle } from "./walk-life.js";
import { type ActiveWorkBeat, beatEnvelope } from "./work-beats.js";

/** Seconds into waving back at Alyx: the right hand goes up for this long. */
export const bossWaveWindow = { from: 0.3, to: 2.6 } as const;

export interface OfficePoseInput {
  /** Null while walking. */
  action: OfficeAction | null;
  /** Seconds since Alyx greeted this member in first person, or null; they wave back. */
  bossWave?: number | null;
  walkPhase: number;
  time: number;
  /** Seconds since the current action began. Drives one-shot gestures. */
  actionElapsed: number;
  /** How this avatar fits the seat at its station, or null when standing. */
  seat: SeatFit | null;
  /** Increments on every key press, so typing hands alternate with the text on screen. */
  keystrokes: number;
  /** Something held in the right hand while walking, such as a mug: that arm stays bent instead of swinging. */
  carrying: boolean;
  /** The pen, while working at a board; absent everywhere else. */
  board?: BoardFocus | null;
  /** The member's own way of walking; the plain cycle when absent. */
  walkStyle?: WalkStyle;
  /** Something done on the way (phone, stretch, wave), while walking. */
  gimmick?: ActiveGimmick | null;
  /** Small talk: talking, nodding along, or laughing. */
  chatter?: ChatReaction | null;
  /** Hands and posture during small talk at the bar. */
  chatGesture?: ChatGesture | null;
  /** Turns the head toward someone, in radians to the avatar's left. */
  lookYaw?: number;
  /**
   * Where the rally is for this player, 0..1 over one full there-and-back of the ball, with 0 the
   * moment it reaches their paddle. Absent while no ball is in play.
   */
  pingpongBeat?: number | null;
  /** Something being done with the things on the member's own desk, while idling there. */
  deskBit?: ActiveDeskBit | null;
  /** While fetching or putting something down: the side it is on, which the body leans toward. */
  fetchSide?: "left" | "right";
  /** A moment in the middle of typing: hand on the chin, leaning in, a glance, a stretch, a fist pump. */
  workBeat?: ActiveWorkBeat | null;
  /** The member's own way of eating at lunch; a default eater when absent. */
  eatStyle?: EatStyle;
}

const plainWalk: WalkStyle = { stride: 1, armSwing: 1, bounce: 1, sway: 1, lean: 0.04 };
/** An easy jog on the treadmill: longer strides, arms pumping, more bounce, leaning into it. */
const jogStyle: WalkStyle = { stride: 1.35, armSwing: 1.6, bounce: 2.2, sway: 0.8, lean: 0.12 };
/** Strides per second times 2π: a steady, unhurried jogging cadence. */
const jogRate = 2.6 * Math.PI;

/** One round of punches at the bag, in seconds: a right, a pause, a left, a pause. */
export const punchRound = 1.3;

/**
 * How far each fist is out, 0 at the guard and 1 at full reach, `time` seconds into the round.
 * The bag reads the same clock, so it swings back as each punch lands.
 */
export function punchReach(time: number): { left: number; right: number } {
  const t = (((time % punchRound) + punchRound) % punchRound) / punchRound;
  const jab = (start: number): number => {
    const local = (t - start) / 0.22;
    return local <= 0 || local >= 1 ? 0 : Math.sin(local * Math.PI);
  };
  return { right: jab(0), left: jab(0.5) };
}

/** The pen in the avatar's own frame (x to its left, y up from the floor, z ahead), plus the step back. */
export interface BoardFocus {
  x: number;
  y: number;
  z: number;
  /** 0..1: how far into stepping back to look the drawing over. */
  review: number;
  /** 0..1: shuffling sideways along the board to keep up with the pen. */
  stepping: number;
}

/** Pen lower than this, in the avatar's frame, and the writer starts bending the knees. */
const crouchBelowY = 0.55;
/** How much lower the pen goes before the crouch is as deep as it gets. */
const crouchRange = 0.25;
/** How far the hips drop in the deepest crouch. */
const crouchDrop = 0.11;
/** Pen higher than this and the writer goes up on tiptoe, lifting the hips this much. */
const tiptoeAboveY = 0.85;
const tiptoeLift = 0.03;

/** Eyes of someone standing, in the avatar's frame. */
const standingEyeY = people.eye;

/** Upper body of one action. Legs and hips come from the posture, so any action works standing or seated. */
interface UpperBody {
  bones: PoseBones;
  /** Extra hips motion when standing, such as a hop or a bounce. Ignored when seated. */
  standingHipsY?: number;
}

/** Thighs pitched forward (plus the seat's knee lift) with shins hanging straight down. */
function seatedLegs(seat: SeatFit): PoseBones {
  const thigh = 1.5 + seat.thighLift;
  return {
    leftUpperLeg: { x: -thigh, y: 0, z: 0.06 },
    rightUpperLeg: { x: -thigh, y: 0, z: -0.06 },
    leftLowerLeg: { x: thigh, y: 0, z: 0 },
    rightLowerLeg: { x: thigh, y: 0, z: 0 },
  };
}

/**
 * Short steps with a small hip sway. A wide stride drags long skirts and dresses
 * (skinned to the thighs) into stretched shapes; small swings keep them hanging naturally.
 */
function walkPose(phase: number, style: WalkStyle): Pose {
  const swing = Math.sin(phase);
  const bob = Math.abs(Math.cos(phase));
  const stride = 0.32 * style.stride;
  const arms = 0.3 * style.armSwing;
  // Each arm bends at the elbow as it comes forward and straightens as it goes back.
  const leftForward = Math.max(0, -swing);
  const rightForward = Math.max(0, swing);
  // Heel first as the foot lands in front, rolling onto the toes as it pushes off behind.
  const footRoll = 0.22 * style.stride * swing;
  // Twist through the body: hips turn with the stepping leg, the chest against them, and the
  // head against the chest so the eyes stay level and forward.
  const twist = 0.06 * style.sway * swing;
  return {
    bones: {
      ...armsRelaxed,
      leftUpperArm: addRotation(armsRelaxed.leftUpperArm, { x: arms * swing }),
      rightUpperArm: addRotation(armsRelaxed.rightUpperArm, { x: -arms * swing }),
      leftLowerArm: { x: 0, y: -0.2 - 0.45 * style.armSwing * leftForward, z: 0 },
      rightLowerArm: { x: 0, y: 0.2 + 0.45 * style.armSwing * rightForward, z: 0 },
      hips: { x: 0, y: twist, z: 0.025 * style.sway * swing },
      spine: { x: style.lean, y: -twist * 0.6, z: 0 },
      chest: { x: 0, y: -twist * 0.8, z: -0.012 * style.sway * swing },
      head: { x: 0.02 * bob, y: twist * 0.9, z: 0 },
      leftUpperLeg: { x: -stride * swing, y: 0, z: 0 },
      rightUpperLeg: { x: stride * swing, y: 0, z: 0 },
      // Knees only bend backward: a lot on the leg swinging through, a little on the one carrying
      // the weight, never locked straight.
      leftLowerLeg: { x: 0.08 + 0.45 * style.stride * Math.max(0, -Math.cos(phase)), y: 0, z: 0 },
      rightLowerLeg: { x: 0.08 + 0.45 * style.stride * Math.max(0, Math.cos(phase)), y: 0, z: 0 },
      leftFoot: { x: -footRoll, y: 0, z: 0 },
      rightFoot: { x: footRoll, y: 0, z: 0 },
    },
    // Lowest as the feet pass each other, highest over the standing leg.
    hipsOffsetY: 0.014 * style.bounce * bob - 0.006,
  };
}

/** Upper body overrides for a gimmick on the move; the legs keep walking underneath. */
function gimmickBones(gimmick: ActiveGimmick, input: OfficePoseInput): PoseBones {
  const t = gimmick.elapsed / gimmick.duration;
  switch (gimmick.kind) {
    case "look-around":
      // A glance one way, then the other, then eyes front again.
      return { head: { x: -0.05, y: 0.65 * Math.sin(t * Math.PI * 2), z: 0 } };
    case "phone":
      return {
        head: { x: 0.38, y: 0, z: 0 },
        rightUpperArm: { x: -0.55, y: 0, z: 1.1 },
        rightLowerArm: { x: 0, y: 1.7, z: 0 },
      };
    case "stretch": {
      // Arms up and back down within the gimmick, eased so it does not snap.
      const up = Math.sin(Math.min(1, t) * Math.PI);
      return {
        head: { x: -0.18 * up, y: 0, z: 0 },
        leftUpperArm: { x: 0, y: 0, z: -1.22 + 2.4 * up },
        rightUpperArm: { x: 0, y: 0, z: 1.22 - 2.4 * up },
        leftLowerArm: { x: 0, y: -0.25 * (1 - up), z: 0 },
        rightLowerArm: { x: 0, y: 0.25 * (1 - up), z: 0 },
      };
    }
    case "wave":
      return {
        rightUpperArm: { x: 0, y: 0, z: 0.05 },
        rightLowerArm: { x: 0, y: 0, z: -1.4 + 0.35 * Math.sin(input.time * 9) },
        head: { x: 0, y: 0, z: -0.12 },
      };
  }
}

/** Head motion of small talk, on top of whatever the body is doing. */
function chatterHead(reaction: ChatReaction, time: number): { x: number; y: number; z: number } {
  switch (reaction) {
    case "talk":
      return { x: 0.05 * Math.sin(time * 5), y: 0, z: 0.04 * Math.sin(time * 1.7) };
    case "nod":
      // A nod every second or so, not a constant bobble.
      return { x: 0.16 * Math.max(0, Math.sin(time * 6)) * (Math.sin(time * 1.1) > 0 ? 1 : 0.3), y: 0, z: 0 };
    case "laugh":
      return { x: -0.15 + 0.06 * Math.sin(time * 16), y: 0, z: 0.08 };
    case "acknowledge":
      // One small nod as their eyes meet.
      return { x: 0.12 * Math.max(0, Math.sin(time * 4)), y: 0, z: 0.04 };
  }
}

type Side = "left" | "right";

/**
 * Sets one arm from rotations written for the right arm; the left arm mirrors y and z. Right arm:
 * upper z 1.22 hangs down, 0 sideways, x negative raises it forward; lower y positive folds the
 * forearm forward and up.
 */
function setArm(bones: PoseBones, side: Side, upper: BoneRotation, lower: BoneRotation): void {
  const flip = (rotation: BoneRotation): BoneRotation =>
    side === "left" ? { x: rotation.x, y: -rotation.y, z: -rotation.z } : rotation;
  bones[`${side}UpperArm`] = flip(upper);
  bones[`${side}LowerArm`] = flip(lower);
}

/** Fingers curled except the index, for pointing. */
function pointingFingers(bones: PoseBones, side: Side, amount: number): void {
  const sign = side === "right" ? 1 : -1;
  for (const finger of ["Middle", "Ring", "Little"] as const) {
    for (const joint of fingerJoints) {
      bones[`${side}${finger}${joint}`] = { x: 0, y: 0, z: sign * 1.3 * amount };
    }
  }
}

/**
 * Hands and posture during small talk, eased in over the first moments of a line. Each kind is
 * one of the ways people actually hold themselves in conversation, so a long chat at the bar
 * keeps changing shape instead of looping one motion.
 */
function chatGestureBones(gesture: ChatGesture, time: number): PoseBones {
  const k = Math.min(1, gesture.elapsed / 0.35);
  const ease = k * k * (3 - 2 * k);
  const blend = (value: number, rest: number): number => rest + (value - rest) * ease;
  const bones: PoseBones = {};
  const beat = Math.sin(time * 4);
  switch (gesture.kind) {
    case "explain":
      // Both forearms up, palms out, beating gently with the words, out of step with each other.
      setArm(
        bones,
        "right",
        { x: blend(-0.45, 0), y: 0, z: blend(1.0, 1.22) },
        { x: 0, y: blend(1.35 + 0.25 * beat, 0.25), z: 0 },
      );
      setArm(
        bones,
        "left",
        { x: blend(-0.4, 0), y: 0, z: blend(1.05, 1.22) },
        { x: 0, y: blend(1.25 + 0.25 * Math.sin(time * 4 + 2), 0.25), z: 0 },
      );
      break;
    case "point":
      // Arm out toward something, a little jab at the start.
      setArm(
        bones,
        "right",
        {
          x: blend(-1.05 - 0.08 * Math.exp(-gesture.elapsed * 3) * Math.sin(gesture.elapsed * 12), 0),
          y: 0,
          z: blend(0.85, 1.22),
        },
        { x: 0, y: blend(0.25, 0.25), z: 0 },
      );
      pointingFingers(bones, "right", ease);
      break;
    case "count":
      // Left hand up, right index tapping its fingers one by one.
      setArm(bones, "left", { x: blend(-0.5, 0), y: 0, z: blend(1.0, 1.22) }, { x: 0, y: blend(1.5, 0.25), z: 0 });
      setArm(
        bones,
        "right",
        { x: blend(-0.55, 0), y: blend(0.35, 0), z: blend(1.0, 1.22) },
        { x: 0, y: blend(1.7 + 0.12 * Math.sin(time * 5), 0.25), z: 0 },
      );
      pointingFingers(bones, "right", ease);
      break;
    case "chin":
      // Hand to the chin, head tipped, thinking it over.
      setArm(bones, "right", { x: blend(-0.6, 0), y: 0, z: blend(1.25, 1.22) }, { x: 0, y: blend(2.15, 0.25), z: 0 });
      bones.head = { x: -0.1 * ease, y: 0, z: 0.12 * ease };
      break;
    case "shrug": {
      // Shoulders up once, forearms out with palms up, then a softer hold.
      const lift = Math.exp(-gesture.elapsed * 2.5) * Math.sin(Math.min(Math.PI, gesture.elapsed * 4));
      setArm(bones, "right", { x: blend(-0.2, 0), y: 0, z: blend(1.0, 1.22) }, { x: 0, y: blend(1.1, 0.25), z: 0 });
      setArm(bones, "left", { x: blend(-0.2, 0), y: 0, z: blend(1.0, 1.22) }, { x: 0, y: blend(1.1, 0.25), z: 0 });
      bones.rightShoulder = { x: 0, y: 0, z: -0.25 * lift };
      bones.leftShoulder = { x: 0, y: 0, z: 0.25 * lift };
      bones.head = { x: 0, y: 0, z: 0.1 * ease };
      break;
    }
    case "hips":
      // Hands on hips, elbows out: sure of what they are saying.
      setArm(
        bones,
        "right",
        { x: blend(0.25, 0), y: blend(-0.4, 0), z: blend(0.8, 1.22) },
        { x: 0, y: blend(1.7, 0.25), z: 0 },
      );
      setArm(
        bones,
        "left",
        { x: blend(0.25, 0), y: blend(-0.4, 0), z: blend(0.8, 1.22) },
        { x: 0, y: blend(1.7, 0.25), z: 0 },
      );
      break;
    case "clasp": {
      // Hands together in front, a little bounce of excitement.
      const bounce = 0.06 * Math.abs(Math.sin(time * 7));
      setArm(
        bones,
        "right",
        { x: blend(-0.75 - bounce, 0), y: blend(0.65, 0), z: blend(1.0, 1.22) },
        { x: 0, y: blend(1.2, 0.25), z: 0 },
      );
      setArm(
        bones,
        "left",
        { x: blend(-0.75 - bounce, 0), y: blend(0.65, 0), z: blend(1.0, 1.22) },
        { x: 0, y: blend(1.2, 0.25), z: 0 },
      );
      break;
    }
    case "wave-off":
      // A loose flap of the hand: "no way".
      setArm(
        bones,
        "right",
        { x: blend(-0.5, 0), y: 0, z: blend(1.0, 1.22) },
        { x: 0, y: blend(1.6, 0.25), z: blend(0.35 * Math.sin(time * 10), 0) },
      );
      break;
    case "arms-crossed":
      setArm(
        bones,
        "right",
        { x: blend(-0.25, 0), y: blend(1.0, 0), z: blend(1.15, 1.22) },
        { x: 0, y: blend(1.75, 0.25), z: 0 },
      );
      setArm(
        bones,
        "left",
        { x: blend(-0.35, 0), y: blend(1.0, 0), z: blend(1.15, 1.22) },
        { x: 0, y: blend(1.7, 0.25), z: 0 },
      );
      break;
    case "head-tilt":
      bones.head = { x: 0, y: 0, z: 0.18 * ease };
      break;
    case "cover-laugh":
      // Hand up over the mouth, shoulders shaking.
      setArm(bones, "right", { x: blend(-0.55, 0), y: 0, z: blend(1.25, 1.22) }, { x: 0, y: blend(2.35, 0.25), z: 0 });
      bones.chest = { x: 0.04 * Math.sin(time * 15) * ease, y: 0, z: 0 };
      break;
    case "relaxed":
      break;
  }
  return bones;
}

/** Every rotation in `to` blended in from `from` by `t`; bones `to` leaves out stay as they were. */
function blendBones(from: PoseBones, to: PoseBones, t: number): PoseBones {
  const result: PoseBones = { ...from };
  for (const [name, target] of Object.entries(to) as [keyof PoseBones, BoneRotation | undefined][]) {
    if (target === undefined) {
      continue;
    }
    const base = from[name] ?? { x: 0, y: 0, z: 0 };
    result[name] = {
      x: base.x + (target.x - base.x) * t,
      y: base.y + (target.y - base.y) * t,
      z: base.z + (target.z - base.z) * t,
    };
  }
  return result;
}

/** The bones a work beat moves, at full strength. The hands it frees are let go by the stage. */
function workBeatBones(beat: ActiveWorkBeat): PoseBones {
  const bones: PoseBones = {};
  const t = beat.elapsed;
  switch (beat.kind) {
    case "think":
      // Back from the keys, chin on the right hand, a slow nod as the idea lands.
      bones.spine = { x: 0.1, y: 0, z: 0 };
      bones.head = { x: 0.08 + 0.05 * Math.max(0, Math.sin(t * 2.4)), y: -0.12, z: 0.05 };
      setArm(bones, "right", { x: -0.95, y: 0, z: 0.85 }, { x: 0, y: 2.25, z: 0 });
      break;
    case "lean":
      // Right up to the screen to read a line, the head tipped back up to it.
      bones.spine = { x: 0.5, y: 0, z: 0 };
      bones.chest = { x: 0.12, y: 0, z: 0 };
      bones.head = { x: -0.12, y: 0.03 * Math.sin(t * 1.5), z: 0 };
      break;
    case "glance":
      // A look across at the side screen, shoulders turning a little with it.
      bones.head = { x: 0.04, y: 0.6 * beat.side, z: 0 };
      bones.chest = { x: 0.08, y: 0.15 * beat.side, z: 0 };
      break;
    case "stretch":
      // Arms straight up, back arched, head back.
      bones.spine = { x: -0.14, y: 0, z: 0 };
      bones.head = { x: -0.18, y: 0, z: 0 };
      bones.leftUpperArm = { x: 0, y: 0, z: 1.2 + 0.05 * Math.sin(t * 3) };
      bones.rightUpperArm = { x: 0, y: 0, z: -1.2 - 0.05 * Math.sin(t * 3) };
      bones.leftLowerArm = { x: 0, y: -0.15, z: 0 };
      bones.rightLowerArm = { x: 0, y: 0.15, z: 0 };
      break;
    case "fist": {
      // Done: the right fist pumps twice, head up.
      const pump = Math.max(0, Math.sin(t * 7));
      bones.spine = { x: -0.05, y: 0, z: 0 };
      bones.head = { x: -0.1, y: 0, z: 0 };
      setArm(bones, "right", { x: -0.3, y: 0, z: -0.35 - 0.35 * pump }, { x: 0, y: 1.9, z: 0 });
      Object.assign(bones, curledFingers(1.1));
      break;
    }
  }
  return bones;
}

function typeBody(input: OfficePoseInput): UpperBody {
  const typing = typingBones(input);
  const beat = input.workBeat ?? null;
  if (beat === null) {
    return { bones: typing };
  }
  return { bones: blendBones(typing, workBeatBones(beat), beatEnvelope(beat)) };
}

function typingBones(input: OfficePoseInput): PoseBones {
  // The hand that "pressed" the last key dips; the other lifts a little.
  const leftHandActive = input.keystrokes % 2 === 0;
  const dip = 0.12;
  return {
    // Leaning in brings the shoulders over the keyboard; the head tips back up to the screen.
    spine: { x: 0.3, y: 0, z: 0 },
    chest: { x: 0.08, y: 0, z: 0 },
    head: { x: 0.02, y: 0.04 * Math.sin(input.time * 0.6), z: 0 },
    leftUpperArm: { x: -0.75, y: 0, z: -1.15 },
    rightUpperArm: { x: -0.75, y: 0, z: 1.15 },
    leftLowerArm: { x: 0, y: -1.1, z: leftHandActive ? dip : -0.04 },
    rightLowerArm: { x: 0, y: 1.1, z: leftHandActive ? 0.04 : -dip },
    ...curledFingers(0.32),
  };
}

const curlingFingers = ["Index", "Middle", "Ring", "Little"] as const;
const fingerJoints = ["Proximal", "Intermediate", "Distal"] as const;

/**
 * Fingers bent at every joint, the relaxed curve of hands over a keyboard. In the normalized rig
 * fingers lie along x, so bending them down toward the palm turns about z: negative on the left
 * hand, positive on the right.
 */
function curledFingers(amount: number): PoseBones {
  const bones: PoseBones = {};
  for (const finger of curlingFingers) {
    for (const joint of fingerJoints) {
      bones[`left${finger}${joint}`] = { x: 0, y: 0, z: -amount };
      bones[`right${finger}${joint}`] = { x: 0, y: 0, z: amount };
    }
  }
  return bones;
}

function deskIdleBody(input: OfficePoseInput): UpperBody {
  if (input.deskBit !== undefined && input.deskBit !== null) {
    return deskBitBody(input.deskBit, input);
  }
  return {
    bones: {
      spine: { x: -0.06, y: 0, z: 0 },
      head: { x: 0.02, y: 0.45 * Math.sin(input.time * 0.25), z: 0.05 * Math.sin(input.time * 0.4) },
      leftUpperArm: { x: -0.35, y: 0, z: -1.25 },
      rightUpperArm: { x: -0.35, y: 0, z: 1.25 },
      leftLowerArm: { x: 0, y: -0.6, z: 0 },
      rightLowerArm: { x: 0, y: 0.6, z: 0 },
    },
  };
}

/** 0..1, eased: leaning toward the desk while a hand goes out to an item or puts it back. */
function reachLean(bit: ActiveDeskBit): number {
  if (!reachingForItem(bit)) {
    return 0;
  }
  const fromStart = bit.elapsed / reachSeconds;
  const fromEnd = (bit.duration - bit.elapsed) / reachSeconds;
  const k = Math.min(1, Math.max(0, Math.min(fromStart, fromEnd) * 2));
  return k * k * (3 - 2 * k);
}

/** 0..1 back and forth with `period` seconds per round trip, resting at 0 at the start. */
function cycle(seconds: number, period: number): number {
  return 0.5 - 0.5 * Math.cos((seconds / period) * Math.PI * 2);
}

function mixRotation(from: BoneRotation, to: BoneRotation, t: number): BoneRotation {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t };
}

/**
 * Doing something with what is on the desk. Reaching out and putting things back is IK on the
 * bit's hand, so the pose leans the body toward the desk and turns the chest to the item's side;
 * in between, the pose shows what the member does with the thing in their hand.
 */
function deskBitBody(bit: ActiveDeskBit, input: OfficePoseInput): UpperBody {
  const { hand } = bit;
  const toward = hand === "left" ? 1 : -1;
  const lean = reachLean(bit);
  // Seconds into using the thing, after picking it up.
  const using = Math.max(0, bit.elapsed - reachSeconds);
  const bones: PoseBones = {
    // Leaning sideways too brings the shoulder over things off to the side of the keyboard.
    spine: { x: -0.02 + 0.28 * lean, y: 0, z: -0.22 * toward * lean },
    chest: { x: 0.06 * lean, y: 0.22 * toward * lean, z: 0 },
    head: { x: 0.2 * lean, y: 0.25 * toward * lean, z: 0 },
    leftUpperArm: { x: -0.35, y: 0, z: -1.25 },
    rightUpperArm: { x: -0.35, y: 0, z: 1.25 },
    leftLowerArm: { x: 0, y: -0.6, z: 0 },
    rightLowerArm: { x: 0, y: 0.6, z: 0 },
  };
  const other: Side = hand === "left" ? "right" : "left";
  switch (bit.kind) {
    case "kanban-check":
      // Leaning in to the sprint board on the right-hand screen, hand to the chin, a small nod.
      bones.spine = { x: 0.18, y: 0, z: 0 };
      bones.head = { x: 0.04 + 0.05 * Math.max(0, Math.sin(bit.elapsed * 3)), y: -0.4, z: -0.05 };
      setArm(bones, "right", { x: -0.9, y: 0, z: 0.9 }, { x: 0, y: 2.2, z: 0 });
      break;
    case "monitor-check":
      // Up close to the job runs on the vertical screen, hands on the desk edge.
      bones.spine = { x: 0.3, y: 0, z: 0 };
      bones.head = { x: -0.06, y: -0.42 + 0.06 * Math.sin(bit.elapsed * 1.3), z: 0 };
      setArm(bones, "left", { x: -0.6, y: 0, z: 1.1 }, { x: 0, y: 0.9, z: 0 });
      setArm(bones, "right", { x: -0.6, y: 0, z: 1.1 }, { x: 0, y: 0.9, z: 0 });
      break;
    case "planner": {
      // Open in both hands, head bowed over it, a page turned now and then.
      const page = Math.max(0, Math.sin(using * 1.4) - 0.85) * 5;
      setArm(bones, "left", { x: -0.35, y: 0, z: 1.3 }, { x: 0, y: 1.35, z: 0 });
      setArm(bones, "right", { x: -0.35 - 0.15 * page, y: 0, z: 1.3 }, { x: 0, y: 1.35 - 0.3 * page, z: 0 });
      bones.head = addRotation(bones.head, { x: 0.28 });
      break;
    }
    case "duck": {
      // Held up at eye level and talked to, squeezed now and then.
      setArm(bones, hand, { x: -1.0, y: 0, z: 0.75 }, { x: 0, y: 1.6, z: 0 });
      bones.head = addRotation(bones.head, { x: 0.04, y: 0.15 * toward, z: 0.12 * Math.sin(using * 1.5) });
      Object.assign(bones, curledFingers(0.35 + 0.4 * Math.max(0, Math.sin(using * 4))));
      break;
    }
    case "console": {
      // Held up in both hands in front of the chest, thumbs going, leaning into the game.
      const thumbs = 0.05 * Math.sin(input.time * 11);
      setArm(bones, "left", { x: -0.6, y: 0, z: 0.95 }, { x: 0, y: 1.9, z: thumbs });
      setArm(bones, "right", { x: -0.6, y: 0, z: 0.95 }, { x: 0, y: 1.9, z: -thumbs });
      bones.spine = { x: 0.12, y: 0, z: 0.04 * Math.sin(using * 0.9) };
      bones.head = { x: 0.25, y: 0, z: 0 };
      break;
    }
    case "plush-hug":
      // Arms wrapped round it at the chest, rocking a little side to side.
      setArm(bones, "left", { x: -0.6, y: 0, z: 0.95 }, { x: 0, y: 1.85, z: 0 });
      setArm(bones, "right", { x: -0.6, y: 0, z: 0.95 }, { x: 0, y: 1.85, z: 0 });
      bones.spine = { x: 0.06, y: 0, z: 0.09 * Math.sin(using * 2.2) };
      bones.head = { x: 0.12, y: 0, z: 0.18 };
      break;
    case "cake": {
      // Fork from the plate up to the mouth, a bite, back down for the next.
      const bite = cycle(using, 2.2);
      const atPlate = { upper: { x: -0.85, y: 0, z: 0.95 }, lower: { x: 0, y: 1.0, z: 0 } };
      const atMouth = { upper: { x: -0.6, y: 0, z: 1.0 }, lower: { x: 0, y: 2.3, z: 0 } };
      setArm(
        bones,
        hand,
        mixRotation(atPlate.upper, atMouth.upper, bite),
        mixRotation(atPlate.lower, atMouth.lower, bite),
      );
      bones.head = { x: 0.22 - 0.2 * bite, y: 0.15 * toward * (1 - bite), z: 0 };
      break;
    }
    case "rose":
      // Brought up to the face for the scent, eyes half closed.
      setArm(bones, hand, { x: -0.7, y: 0, z: 0.95 }, { x: 0, y: 2.25, z: 0 });
      bones.head = { x: 0.1, y: 0, z: -0.12 };
      bones.spine = { x: -0.05, y: 0, z: 0 };
      break;
    case "mic":
      // Leaning into the boom mic at the back left, the free hand talking along.
      bones.spine = { x: 0.2, y: 0, z: 0 };
      bones.chest = { x: 0, y: 0.25, z: 0 };
      bones.head = { x: -0.06, y: 0.3, z: 0.05 * Math.sin(bit.elapsed * 2) };
      setArm(bones, "right", { x: -0.7, y: 0, z: 1.0 }, { x: 0, y: 1.4 + 0.25 * Math.sin(bit.elapsed * 3), z: 0 });
      break;
    case "desk-selfie":
      Object.assign(bones, selfieBody({ ...input, actionElapsed: bit.elapsed }).bones);
      break;
    case "sip": {
      // A sip, the cup lowered to the chest, another sip.
      const sip = cycle(using, 2.6);
      setArm(
        bones,
        hand,
        mixRotation({ x: -0.55, y: 0, z: 1.1 }, { x: -0.6, y: 0, z: 0.95 }, sip),
        mixRotation({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 2.3, z: 0 }, sip),
      );
      setArm(bones, other, { x: -0.5, y: 0, z: 1.15 }, { x: 0, y: 1.3, z: 0 });
      bones.head = { x: 0.12 - 0.18 * sip, y: 0, z: 0.05 };
      break;
    }
    case "chess":
      // After the move: chin on the hand, studying the board on the left.
      if (!reachingForItem(bit)) {
        setArm(bones, "right", { x: -0.95, y: 0, z: 0.85 }, { x: 0, y: 2.3, z: 0 });
        bones.head = { x: 0.3, y: 0.3, z: 0.08 };
        bones.spine = { x: 0.15, y: 0, z: 0 };
      }
      break;
    case "sticky":
      // Writing on the pad at the right: IK keeps the marker on it, the other hand holds it down.
      // Turned to the pad rather than bent over it, clear of the laptop lid.
      bones.spine = { x: 0.1, y: 0, z: 0.12 };
      bones.chest = { x: 0.04, y: -0.25, z: 0 };
      bones.head = { x: 0.3, y: -0.3, z: 0 };
      setArm(bones, other, { x: -0.65, y: 0, z: 1.05 }, { x: 0, y: 1.0, z: 0 });
      break;
    case "idea-pop":
      // Sits up straight, index finger up: she has it.
      bones.spine = { x: -0.1, y: 0, z: 0 };
      bones.head = { x: -0.12, y: 0, z: -0.08 };
      setArm(bones, "right", { x: -0.5, y: 0, z: 1.0 }, { x: 0, y: 2.0, z: 0 });
      pointingFingers(bones, "right", 1);
      break;
    case "clipboard": {
      // Clipboard up in the left hand, the right hand ticking items off down the list.
      if (reachingForItem(bit)) {
        break;
      }
      const tick = cycle(using, 1.6);
      // Both hands in front of the chest, as round a handheld: the board in one, the other on it.
      setArm(bones, "left", { x: -0.6, y: 0, z: 0.95 }, { x: 0, y: 1.9, z: 0 });
      setArm(bones, "right", { x: -0.62 - 0.06 * tick, y: 0, z: 0.9 }, { x: 0, y: 1.95 + 0.12 * tick, z: 0 });
      pointingFingers(bones, "right", 1);
      bones.head = { x: 0.3, y: 0.08, z: 0 };
      break;
    }
    case "hourglass": {
      // Held up at eye level and turned over, then watched while the sand runs.
      if (reachingForItem(bit)) {
        break;
      }
      const turn = Math.min(1, using / 0.6);
      setArm(bones, hand, { x: -0.95, y: 0, z: 0.8 }, { x: 0.6 * Math.sin(turn * Math.PI), y: 1.7, z: 0 });
      bones.head = { x: 0.02, y: 0.12 * toward, z: 0.06 };
      break;
    }
    case "notes":
    case "sketch":
      // Writing in the notebook, or drawing on the tablet, by the right hand: IK keeps the pen on
      // it, the body turned a little to it and the free hand resting on the desk.
      bones.spine = { x: 0.16, y: 0, z: 0.06 };
      bones.chest = { x: 0.04, y: -0.2, z: 0 };
      bones.head = { x: 0.35, y: -0.25, z: 0 };
      setArm(bones, other, { x: -0.6, y: 0, z: 1.1 }, { x: 0, y: 1.0, z: 0 });
      break;
    case "desk-read": {
      // The book open in both hands over the desk, head bowed, a page turned now and then.
      if (reachingForItem(bit)) {
        break;
      }
      const page = Math.max(0, Math.sin(using * 1.1) - 0.85) * 5;
      setArm(bones, "left", { x: -0.35, y: 0, z: 1.3 }, { x: 0, y: 1.35, z: 0 });
      setArm(bones, "right", { x: -0.35 - 0.15 * page, y: 0, z: 1.3 }, { x: 0, y: 1.35 - 0.3 * page, z: 0 });
      bones.head = { x: 0.3, y: 0, z: 0.03 * Math.sin(using * 0.5) };
      break;
    }
    case "key-tap":
      // Reaching over to the key in the hub: IK puts the fingertip on it, eyes on the screen.
      bones.spine = { x: 0.12, y: 0, z: -0.1 * toward };
      bones.chest = { x: 0, y: 0.15 * toward, z: 0 };
      bones.head = { x: 0.05, y: 0.1, z: 0 };
      pointingFingers(bones, hand, 1);
      break;
    case "padlock":
      // Turned over in the hand in front of the chest, the shackle clicked now and then.
      if (reachingForItem(bit)) {
        break;
      }
      setArm(bones, hand, { x: -0.85, y: 0, z: 0.85 }, { x: 0.25 * Math.sin(using * 2.4), y: 1.95, z: 0 });
      Object.assign(bones, curledFingers(0.4 + 0.5 * Math.max(0, Math.sin(using * 5))));
      bones.head = { x: 0.25, y: 0.1 * toward, z: 0 };
      break;
    case "swatch":
      // The fan held up beside the screen, eyes going from the colors to the screen and back.
      if (reachingForItem(bit)) {
        break;
      }
      setArm(bones, hand, { x: -1.05, y: 0, z: 0.7 }, { x: 0, y: 1.5, z: 0 });
      bones.head = { x: 0.0, y: (0.1 + 0.18 * Math.sin(using * 1.2)) * toward, z: 0.05 };
      break;
    case "calendar": {
      // Turned to the calendar on the return: the page flipped over, a date tapped, a nod.
      const step = calendarStep(bit.elapsed);
      leanToReturn(bones, toward, deskBitEnvelope(bit));
      if (step.hand === "face") {
        pointingFingers(bones, hand, 1);
      }
      if (step.hand === null) {
        bones.head = addRotation(bones.head, { x: 0.08 * Math.max(0, Math.sin(bit.elapsed * 4)) });
      }
      break;
    }
    case "stamp": {
      const step = stampStep(bit.elapsed);
      if (reachingForItem(bit)) {
        leanToReturn(bones, toward, reachLean(bit));
        break;
      }
      if (step.hand !== null) {
        leanToReturn(bones, toward, 1);
        break;
      }
      // Stamp lifted, looking the stamped sheet over.
      leanToReturn(bones, toward, 0.6);
      setArm(bones, hand, { x: -0.85, y: 0, z: 0.9 }, { x: 0, y: 1.8, z: 0 });
      Object.assign(bones, curledFingers(0.8));
      break;
    }
    case "safe": {
      const step = safeStep(bit.elapsed);
      leanToReturn(bones, toward, deskBitEnvelope(bit));
      if (step.hand === "dial") {
        Object.assign(bones, curledFingers(0.6));
      } else if (step.hand === null && step.door > 0.5) {
        // Bent down to look inside.
        bones.spine = addRotation(bones.spine, { x: 0.12 });
        bones.head = addRotation(bones.head, { x: 0.15 });
      }
      break;
    }
    case "phone-test": {
      // The phone in the holding hand, the other hand tapping through the build.
      if (reachingForItem(bit)) {
        leanToReturn(bones, toward, reachLean(bit));
        break;
      }
      const tap = cycle(using, 0.7);
      setArm(bones, hand, { x: -0.6, y: 0, z: 0.95 }, { x: 0, y: 1.9, z: 0 });
      setArm(bones, other, { x: -0.62 - 0.05 * tap, y: 0, z: 0.9 }, { x: 0, y: 1.95 + 0.1 * tap, z: 0 });
      pointingFingers(bones, other, 1);
      bones.head = { x: 0.32, y: 0.06 * toward, z: 0 };
      break;
    }
    case "moodboard": {
      const step = moodboardStep(bit.elapsed);
      leanToReturn(bones, toward, deskBitEnvelope(bit));
      if (step.hand) {
        pointingFingers(bones, hand, 1);
      } else {
        // Sitting back to judge it, hand to the chin, head on one side.
        setArm(bones, hand, { x: -0.9, y: 0, z: 0.9 }, { x: 0, y: 2.2, z: 0 });
        bones.head = addRotation(bones.head, { z: 0.15 * toward });
      }
      break;
    }
    case "printout": {
      // The sheet up in both hands, reading the chart down, a small nod at the numbers.
      if (reachingForItem(bit)) {
        leanToReturn(bones, toward, reachLean(bit));
        break;
      }
      setArm(bones, "left", { x: -0.7, y: 0, z: 0.9 }, { x: 0, y: 1.85, z: 0 });
      setArm(bones, "right", { x: -0.7, y: 0, z: 0.9 }, { x: 0, y: 1.85, z: 0 });
      bones.spine = { x: -0.02, y: 0, z: 0 };
      bones.head = { x: 0.28 + 0.05 * Math.max(0, Math.sin(using * 2.5)), y: 0, z: 0 };
      break;
    }
    case "pi-reseat": {
      const step = piStep(bit.elapsed);
      leanToReturn(bones, toward, deskBitEnvelope(bit));
      if (step.hand) {
        Object.assign(bones, curledFingers(0.7));
      }
      break;
    }
  }
  return { bones };
}

/**
 * Turned in the chair to the short leg of the L-desk, which is beside the sitter rather than in
 * front: more chest turn and sideways lean than reaching across the main desk.
 */
function leanToReturn(bones: PoseBones, toward: number, amount: number): void {
  bones.spine = { x: 0.14 * amount, y: 0, z: -0.3 * toward * amount };
  bones.chest = { x: 0.05 * amount, y: 0.5 * toward * amount, z: 0 };
  bones.head = { x: 0.3 * amount, y: 0.55 * toward * amount, z: 0 };
}

/**
 * Taking something or putting it down: a mug, the laptop from the drawer, a clean mug off the
 * rack. IK puts the hand on it; the body leans forward and over to that side to get there.
 */
function fetchBody(input: OfficePoseInput): UpperBody {
  const toward = input.fetchSide === "left" ? 1 : -1;
  return {
    bones: {
      spine: { x: 0.32, y: 0, z: -0.2 * toward },
      chest: { x: 0.06, y: 0.2 * toward, z: 0 },
      head: { x: 0.25, y: 0.25 * toward, z: 0 },
      ...armsRelaxed,
    },
  };
}

/**
 * Standing at the bar with a piece of the shared food: leaning in to take it, then bites, the
 * hand going up to the mouth and back down between them.
 */
function eatBody(input: OfficePoseInput): UpperBody {
  const taking = input.actionElapsed < 0.9;
  const bite = 0.5 - 0.5 * Math.cos(Math.max(0, input.actionElapsed - 1) * 2.4);
  const bones: PoseBones = {
    ...armsRelaxed,
    spine: { x: taking ? 0.2 : 0.02, y: 0, z: 0 },
    head: { x: taking ? 0.25 : 0.05 - 0.08 * bite, y: 0, z: 0 },
  };
  setArm(bones, "right", { x: -0.5 - 0.1 * bite, y: 0, z: 1.15 - 0.2 * bite }, { x: 0, y: 1.2 + 1.0 * bite, z: 0 });
  return { bones };
}

function stretchBody(input: OfficePoseInput): UpperBody {
  // Arms go up for a big stretch, then settle down again.
  const raised = input.actionElapsed < 2.5;
  return {
    bones: {
      spine: { x: -0.12, y: 0, z: 0 },
      head: { x: -0.15, y: 0, z: 0 },
      leftUpperArm: { x: 0, y: 0, z: raised ? 1.2 : -1.25 },
      rightUpperArm: { x: 0, y: 0, z: raised ? -1.2 : 1.25 },
      leftLowerArm: { x: 0, y: raised ? 0 : -0.6, z: 0 },
      rightLowerArm: { x: 0, y: raised ? 0 : 0.6, z: 0 },
    },
  };
}

/**
 * Drawing and sticking notes. IK moves the right hand onto the board; the head follows the pen
 * and the shoulders turn part of the way with it, the way people track their own handwriting.
 * Reviewing, they lean back with the marker lowered to look the whole thing over.
 */
function boardBody(input: OfficePoseInput): UpperBody {
  const focus = input.board ?? null;
  const ahead = Math.max(0.2, focus?.z ?? 1);
  const turn = focus === null ? 0 : Math.max(-0.9, Math.min(0.9, Math.atan2(focus.x, ahead)));
  const tilt = focus === null ? 0 : Math.max(-0.6, Math.min(0.5, Math.atan2(standingEyeY - focus.y, ahead)));
  const review = focus?.review ?? 0;
  const drawingArm = { upper: { x: -0.9, y: 0, z: 0.3 }, lower: { x: 0, y: 0.6, z: 0 } };
  const loweredArm = { upper: { x: -0.2, y: 0, z: 1.2 }, lower: { x: 0, y: 0.9, z: 0 } };
  const mix = (a: number, b: number): number => a + (b - a) * review;
  // Small quick steps while shuffling along the board or onto its step, feet together once there.
  const shuffle = 0.22 * (focus?.stepping ?? 0) * Math.sin(input.time * 11);
  // Knees bend to reach the lowest lines: thighs forward, shins back by twice as much, which keeps
  // the feet under the hips while the hips drop.
  const crouch = focus === null ? 0 : Math.max(0, Math.min(1, (crouchBelowY - focus.y) / crouchRange));
  const thigh = 0.85 * crouch * (1 - review);
  // Up on the toes for the top line.
  const tiptoe = focus === null ? 0 : Math.max(0, Math.min(1, (focus.y - tiptoeAboveY) / 0.1)) * (1 - review);
  return {
    standingHipsY: 0.008 * Math.abs(shuffle) * 4 - crouchDrop * crouch * (1 - review) + tiptoeLift * tiptoe,
    bones: {
      ...armsRelaxed,
      leftUpperLeg: { x: -shuffle - thigh, y: 0, z: 0 },
      rightUpperLeg: { x: shuffle - thigh, y: 0, z: 0 },
      leftLowerLeg: { x: Math.max(0, shuffle) * 1.4 + thigh * 2, y: 0, z: 0 },
      rightLowerLeg: { x: Math.max(0, -shuffle) * 1.4 + thigh * 2, y: 0, z: 0 },
      // Toes pointed down, heels off the floor.
      leftFoot: { x: 0.55 * tiptoe, y: 0, z: 0 },
      rightFoot: { x: 0.55 * tiptoe, y: 0, z: 0 },
      // Leaning in toward the board while writing (more when crouched), back while looking it over.
      spine: { x: mix(0.1 + 0.25 * crouch, -0.12), y: turn * 0.3, z: 0 },
      chest: { x: 0, y: turn * 0.15, z: 0 },
      rightUpperArm: {
        x: mix(drawingArm.upper.x, loweredArm.upper.x),
        y: 0,
        z: mix(drawingArm.upper.z, loweredArm.upper.z),
      },
      rightLowerArm: { x: 0, y: mix(drawingArm.lower.y, loweredArm.lower.y), z: 0 },
      // Looking the drawing over: a slow scan across it with the head tipped a little.
      head: {
        x: tilt * (1 - review) + mix(0, -0.05),
        y: turn * 0.55 * (1 - review) + review * 0.25 * Math.sin(input.time * 0.9),
        z: 0.06 * Math.sin(input.time * 0.8) + review * 0.08,
      },
    },
  };
}

function readBody(input: OfficePoseInput): UpperBody {
  // Both forearms forward as if holding an open book, head bowed over it, a page turn now and then.
  const pageTurn = Math.max(0, Math.sin(input.time * 0.35) - 0.9) * 4;
  return {
    bones: {
      leftUpperArm: { x: -0.35, y: 0, z: -1.3 },
      rightUpperArm: { x: -0.35 - 0.2 * pageTurn, y: 0, z: 1.3 },
      leftLowerArm: { x: 0, y: -1.35, z: 0 },
      rightLowerArm: { x: 0, y: 1.35 - 0.4 * pageTurn, z: 0 },
      head: { x: 0.3, y: 0, z: 0.03 * Math.sin(input.time * 0.5) },
    },
  };
}

function ponderBody(input: OfficePoseInput): UpperBody {
  // Right hand to the chin, left arm across the waist, small sway while thinking.
  return {
    bones: {
      leftUpperArm: { x: -0.3, y: 0, z: -1.3 },
      leftLowerArm: { x: 0, y: -1.5, z: 0 },
      rightUpperArm: { x: -0.5, y: 0, z: 1.25 },
      rightLowerArm: { x: 0, y: 2.1, z: 0 },
      head: { x: -0.08, y: 0.15 * Math.sin(input.time * 0.3), z: 0.14 },
      spine: { x: 0, y: 0, z: 0.03 * Math.sin(input.time * 0.5) },
    },
  };
}

function cheerBody(input: OfficePoseInput): UpperBody {
  const hopping = input.actionElapsed < 1.6;
  return {
    bones: {
      ...armsRelaxed,
      leftUpperArm: { x: 0, y: 0, z: hopping ? 0.9 : -1.22 },
      rightUpperArm: { x: 0, y: 0, z: hopping ? -0.9 : 1.22 },
    },
    standingHipsY: hopping ? 0.07 * Math.abs(Math.sin(input.actionElapsed * 7)) : 0,
  };
}

function waveBody(input: OfficePoseInput): UpperBody {
  return {
    bones: {
      ...armsRelaxed,
      rightUpperArm: { x: 0, y: 0, z: 0.05 },
      rightLowerArm: { x: 0, y: 0, z: -1.4 + 0.35 * Math.sin(input.time * 8) },
      head: { x: 0, y: 0, z: -0.12 },
    },
  };
}

function relaxBody(input: OfficePoseInput): UpperBody {
  return {
    bones: {
      spine: { x: -0.1, y: 0, z: 0 },
      head: { x: 0.04 * Math.sin(input.time * 0.5), y: 0.25 * Math.sin(input.time * 0.15), z: 0.08 },
      leftUpperArm: { x: -0.25, y: 0, z: -1.3 },
      rightUpperArm: { x: -0.25, y: 0, z: 1.3 },
    },
  };
}

function watchBody(input: OfficePoseInput): UpperBody {
  // Leaning back, eyes on the screen; now and then a laugh shakes the shoulders.
  const laugh = Math.max(0, Math.sin(input.time * 0.21) - 0.92) * 6;
  return {
    bones: {
      spine: { x: -0.16, y: 0, z: 0 },
      chest: { x: 0.08 * laugh * Math.sin(input.time * 18), y: 0, z: 0 },
      head: { x: -0.02 - 0.1 * laugh, y: 0.04 * Math.sin(input.time * 0.2), z: 0.05 },
      leftUpperArm: { x: -0.3, y: 0, z: -1.25 },
      rightUpperArm: { x: -0.3, y: 0, z: 1.25 },
      leftLowerArm: { x: 0, y: -0.7, z: 0 },
      rightLowerArm: { x: 0, y: 0.7, z: 0 },
    },
  };
}

function gameBody(input: OfficePoseInput): UpperBody {
  // Hands meet in front holding a controller; thumbs twitch, the body leans into the game.
  const thumbs = 0.05 * Math.sin(input.time * 11);
  return {
    bones: {
      spine: { x: 0.14, y: 0, z: 0.04 * Math.sin(input.time * 0.9) },
      head: { x: -0.04, y: 0, z: 0 },
      leftUpperArm: { x: -0.5, y: 0, z: -1.05 },
      rightUpperArm: { x: -0.5, y: 0, z: 1.05 },
      leftLowerArm: { x: 0, y: -1.5, z: thumbs },
      rightLowerArm: { x: 0, y: 1.5, z: -thumbs },
    },
  };
}

function brewBody(input: OfficePoseInput): UpperBody {
  // Hands busy at the machine: one holds the cup, the other works the buttons.
  return {
    bones: {
      // Leaning over the counter toward the machine; the arms are placed on it by IK.
      spine: { x: 0.25, y: 0, z: 0 },
      head: { x: 0.18, y: 0.05 * Math.sin(input.time * 0.7), z: 0 },
      leftUpperArm: { x: -0.85, y: 0, z: -1.0 },
      rightUpperArm: { x: -0.95 + 0.1 * Math.sin(input.time * 2.4), y: 0, z: 1.0 },
      leftLowerArm: { x: 0, y: -0.9, z: 0 },
      rightLowerArm: { x: 0, y: 0.7, z: 0 },
    },
  };
}

function snackBody(input: OfficePoseInput): UpperBody {
  // Reach into the fridge, then a few bites, then reach again.
  const cycle = input.actionElapsed % 4;
  const reaching = cycle < 1.4;
  return {
    bones: {
      ...armsRelaxed,
      spine: { x: reaching ? 0.15 : 0, y: 0, z: 0 },
      head: { x: reaching ? 0.05 : -0.05, y: 0, z: reaching ? 0 : 0.08 },
      rightUpperArm: reaching ? { x: -1.35, y: 0, z: 0.55 } : { x: -0.55, y: 0, z: 1.1 },
      rightLowerArm: reaching ? { x: 0, y: 0.2, z: 0 } : { x: 0, y: 2.2, z: 0 },
    },
  };
}

function arcadeBody(input: OfficePoseInput): UpperBody {
  // Left hand on the stick, right hand mashing buttons, bouncing with the game.
  return {
    bones: {
      spine: { x: 0.12, y: 0, z: 0.05 * Math.sin(input.time * 3.1) },
      head: { x: 0.08, y: 0, z: 0 },
      leftUpperArm: { x: -0.8, y: 0, z: -1.0 + 0.06 * Math.sin(input.time * 4) },
      rightUpperArm: { x: -0.8, y: 0, z: 1.0 },
      leftLowerArm: { x: 0, y: -0.75, z: 0 },
      rightLowerArm: { x: 0, y: 0.75, z: -0.08 * Math.abs(Math.sin(input.time * 14)) },
    },
    standingHipsY: 0.012 * Math.abs(Math.sin(input.time * 6)),
  };
}

function boxBody(input: OfficePoseInput): UpperBody {
  // Fists up by the chin, one snapping out at a time at chest height, weight on the balls of the
  // feet with a little bounce.
  const reach = punchReach(input.actionElapsed);
  const bones: PoseBones = {
    // Fists, every finger bent tight into the palm.
    ...curledFingers(1.5),
    spine: { x: 0.14, y: 0.12 * (reach.right - reach.left), z: 0 },
    head: { x: 0.12, y: 0, z: 0 },
    leftUpperLeg: { x: -0.18, y: 0, z: 0 },
    rightUpperLeg: { x: 0.12, y: 0, z: 0 },
    leftLowerLeg: { x: 0.22, y: 0, z: 0 },
    rightLowerLeg: { x: 0.14, y: 0, z: 0 },
  };
  for (const side of ["left", "right"] as const) {
    const out = reach[side];
    // Given as the right arm: setArm mirrors it for the left.
    setArm(bones, side, { x: -0.9 - 0.45 * out, y: 0, z: 0.9 + 0.3 * out }, { x: 0, y: 2.2 - 2.0 * out, z: 0 });
  }
  return { bones, standingHipsY: 0.008 * Math.abs(Math.sin(input.time * 7)) };
}

function handOverBody(input: OfficePoseInput): UpperBody {
  // The folder comes up from the side and goes out at chest height, with a small bow, then held
  // there while the other takes it.
  const reach = Math.min(1, input.actionElapsed / 0.6);
  const ease = reach * reach * (3 - 2 * reach);
  const bones: PoseBones = {
    ...armsRelaxed,
    spine: { x: 0.12 * ease, y: 0, z: 0 },
    head: { x: 0.12 * ease, y: 0, z: 0 },
  };
  setArm(
    bones,
    "right",
    mixRotation({ x: -0.3, y: 0, z: 1.3 }, { x: -1.3, y: 0, z: 1.15 }, ease),
    mixRotation({ x: 0, y: 1.4, z: 0 }, { x: 0, y: 0.25, z: 0 }, ease),
  );
  return { bones };
}

function waitReportBody(input: OfficePoseInput): UpperBody {
  // Waiting their turn with the report held to the chest, weight shifting now and then.
  const shift = Math.sin(input.time * 0.8);
  const bones: PoseBones = {
    hips: { x: 0, y: 0, z: 0.03 * shift },
    spine: { x: 0.02, y: 0, z: -0.02 * shift },
    head: { x: 0.05, y: 0.1 * Math.sin(input.time * 0.3), z: 0 },
  };
  setArm(bones, "right", { x: -0.45, y: 0, z: 1.2 }, { x: 0, y: 1.6, z: 0 });
  setArm(bones, "left", { x: -0.4, y: 0, z: 1.25 }, { x: 0, y: 1.3, z: 0 });
  return { bones };
}

function gazeBody(input: OfficePoseInput): UpperBody {
  // Bent a little toward the glass, hands clasped behind the back, eyes following a fish.
  return {
    bones: {
      spine: { x: 0.16, y: 0, z: 0 },
      head: { x: 0.1, y: 0.35 * Math.sin(input.time * 0.6), z: 0.05 * Math.sin(input.time * 0.6) },
      leftUpperArm: { x: 0.35, y: 0, z: -1.15 },
      rightUpperArm: { x: 0.35, y: 0, z: 1.15 },
      leftLowerArm: { x: 0, y: -0.9, z: 0 },
      rightLowerArm: { x: 0, y: 0.9, z: 0 },
    },
  };
}

function waterBody(input: OfficePoseInput): UpperBody {
  // Watering can held out over the pot, tilting as it pours.
  const pour = 0.25 + 0.1 * Math.sin(input.time * 1.3);
  return {
    bones: {
      ...armsRelaxed,
      spine: { x: 0.1, y: 0, z: 0 },
      head: { x: 0.32, y: 0, z: 0 },
      rightUpperArm: { x: -1.0, y: 0, z: 1.0 },
      rightLowerArm: { x: 0, y: 0.4, z: -pour },
    },
  };
}

function loungeBody(input: OfficePoseInput): UpperBody {
  // Sunk into the beanbag, phone held up at the chest, scrolling.
  const scroll = 0.04 * Math.max(0, Math.sin(input.time * 1.7));
  return {
    bones: {
      spine: { x: -0.3, y: 0, z: 0 },
      head: { x: 0.18, y: 0.05 * Math.sin(input.time * 0.3), z: 0.1 },
      leftUpperArm: { x: -0.45, y: 0, z: -1.2 },
      rightUpperArm: { x: -0.45, y: 0, z: 1.2 },
      leftLowerArm: { x: 0, y: -1.9, z: 0 },
      rightLowerArm: { x: 0, y: 1.9, z: -scroll },
    },
  };
}

function selfieBody(input: OfficePoseInput): UpperBody {
  // Phone held high in the right hand, peace sign by the face, a new pose every few seconds.
  const pose = Math.floor(input.actionElapsed / 3) % 2;
  return {
    bones: {
      spine: { x: -0.05, y: 0, z: pose === 0 ? 0.06 : -0.04 },
      head: { x: -0.12, y: -0.25, z: pose === 0 ? 0.18 : -0.1 },
      rightUpperArm: { x: -1.3, y: 0, z: 0.3 },
      rightLowerArm: { x: 0, y: 0.45, z: 0 },
      leftUpperArm: pose === 0 ? { x: -0.65, y: 0, z: -0.45 } : { x: -0.2, y: 0, z: -1.15 },
      leftLowerArm: pose === 0 ? { x: 0, y: -2.0, z: 0 } : { x: 0, y: -1.6, z: 0 },
    },
  };
}

function rackBody(input: OfficePoseInput): UpperBody {
  // One hand on the rack, checking the status lights, head tilting from unit to unit.
  return {
    bones: {
      ...armsRelaxed,
      spine: { x: 0.04, y: 0, z: 0 },
      head: { x: -0.08 + 0.12 * Math.sin(input.time * 0.4), y: 0.15 * Math.sin(input.time * 0.55), z: 0 },
      rightUpperArm: { x: -1.1, y: 0, z: 0.7 },
      rightLowerArm: { x: 0, y: 0.3, z: 0 },
    },
  };
}

function chatBody(input: OfficePoseInput): UpperBody {
  // Between lines: hands resting, weight shifting from side to side now and then.
  const shift = 0.05 * Math.sin(input.time * 0.37) + 0.03 * Math.sin(input.time * 0.91);
  if (input.chatGesture !== undefined && input.chatGesture !== null) {
    return {
      bones: {
        ...armsRelaxed,
        hips: { x: 0, y: 0, z: shift },
        spine: { x: 0.05, y: 0, z: -shift * 0.6 },
        ...chatGestureBones(input.chatGesture, input.time),
      },
    };
  }
  return {
    bones: {
      hips: { x: 0, y: 0, z: shift },
      spine: { x: 0.05, y: 0, z: -shift * 0.6 },
      head: { x: 0.08 * Math.sin(input.time * 2.3), y: 0.08 * Math.sin(input.time * 0.7), z: 0.05 },
      leftUpperArm: { x: -0.4, y: 0, z: -1.2 },
      rightUpperArm: { x: -0.4, y: 0, z: 1.2 },
      leftLowerArm: { x: 0, y: -1.2 - 0.3 * Math.sin(input.time * 1.7), z: 0 },
      rightLowerArm: { x: 0, y: 1.2 + 0.3 * Math.sin(input.time * 2.1 + 1), z: 0 },
    },
  };
}

/**
 * Running standup by the board: explaining with open hands, now and then counting off on the
 * fingers, unless a line of small talk has its own gesture.
 */
function standupLeadBody(input: OfficePoseInput): UpperBody {
  if (input.chatGesture !== undefined && input.chatGesture !== null) {
    return chatBody(input);
  }
  const kind = Math.sin(input.actionElapsed * 0.4) > -0.3 ? "explain" : "count";
  return chatBody({ ...input, chatGesture: { kind, elapsed: input.actionElapsed % 6 } });
}

/**
 * Lunch at the meeting table, in the member's own way: bites at their own pace, pauses to chew
 * and look about, sit back or poke around the box, and a stop to talk when it is their line.
 */
function lunchBody(input: OfficePoseInput): UpperBody {
  const style = input.eatStyle ?? eatStyleFor("twob");
  const moment = lunchMoment(input.actionElapsed - 1, style);
  const bite = moment.kind === "bite" ? moment.amount : 0;
  const pausing = moment.kind === "bite" ? 0 : moment.amount;
  const sitBack = moment.kind === "sit-back" ? pausing : 0;
  const picking = moment.kind === "pick" ? pausing : 0;
  const look = moment.kind === "chew" ? moment.look * pausing : 0;
  const lean = 0.06 + 0.1 * style.lean;
  const bones: PoseBones = {
    ...armsRelaxed,
    spine: { x: lean - 0.08 * bite - (lean + 0.06) * sitBack + 0.05 * picking, y: 0.08 * look, z: 0 },
    head: { x: 0.3 - 0.25 * bite - 0.25 * sitBack + 0.1 * picking, y: 0.35 * look, z: 0.04 * look },
  };
  // The chopsticks: down at the box, up to the mouth on a bite, a little lower and still while
  // pausing, stirring about the box while picking.
  const stir = picking * 0.12 * Math.sin(input.time * 5);
  setArm(
    bones,
    "right",
    mixRotation({ x: -0.75, y: 0, z: 1.0 + 0.15 * sitBack }, { x: -0.6, y: 0, z: 1.0 }, bite),
    mixRotation({ x: 0, y: 1.1 - 0.3 * sitBack + stir, z: 0 }, { x: 0, y: 2.3, z: 0 }, bite),
  );
  switch (style.freeHand) {
    case "box":
      setArm(bones, "left", { x: -0.7, y: 0, z: 1.1 }, { x: 0, y: 1.0, z: 0 });
      break;
    case "table":
      // Forearm along the table edge, the hand out beside the box.
      setArm(bones, "left", { x: -0.55, y: 0.25, z: 1.15 }, { x: 0, y: 1.25, z: 0 });
      break;
    case "lap":
      setArm(bones, "left", { x: -0.2, y: 0, z: 1.25 }, { x: 0, y: 0.7, z: 0 });
      break;
  }
  const gesture = input.chatGesture ?? null;
  if (gesture !== null && speakerGestureKinds.has(gesture.kind)) {
    // Their line: chopsticks held low over the box, the other hand doing the talking.
    const talking = chatGestureBones(gesture, input.time);
    if (talking.leftUpperArm !== undefined && talking.leftLowerArm !== undefined) {
      bones.leftUpperArm = talking.leftUpperArm;
      bones.leftLowerArm = talking.leftLowerArm;
    }
    setArm(bones, "right", { x: -0.75, y: 0, z: 1.05 }, { x: 0, y: 1.0, z: 0 });
    bones.head = { x: 0.1, y: 0, z: 0 };
  }
  return { bones };
}

function meetingBody(input: OfficePoseInput): UpperBody {
  // Laptop work at the team table, looking up to talk every so often.
  const talking = Math.sin(input.time * 0.33) > 0.4;
  if (talking) {
    return chatBody(input);
  }
  const typing = typeBody(input);
  return { bones: { ...typing.bones, head: { x: 0.2, y: 0.05 * Math.sin(input.time * 0.5), z: 0 } } };
}

/**
 * Forehand stroke against the ball's timing: a short wind-up before it arrives, the paddle moving
 * forward through contact, the follow-through right after. Negative is the wind-up.
 */
export function pingpongSwing(beat: number | null): number {
  if (beat === null) {
    return 0;
  }
  // -0.5..0.5 of a rally, 0 at contact.
  const around = beat > 0.5 ? beat - 1 : beat;
  const windUp = -0.5 * Math.sin(Math.PI * Math.min(1, Math.max(0, (around + 0.32) / 0.22)));
  const stroke = Math.sin(Math.PI * Math.min(1, Math.max(0, (around + 0.1) / 0.3)));
  return around < -0.1 ? windUp : stroke;
}

function pingpongBody(input: OfficePoseInput): UpperBody {
  // Ready stance, paddle out front, the swing timed to the ball, a little bounce on the toes.
  const swing = pingpongSwing(input.pingpongBeat ?? null);
  return {
    bones: {
      ...armsRelaxed,
      spine: { x: 0.18, y: -0.35 * swing, z: 0 },
      head: { x: -0.1, y: 0.25 * swing, z: 0 },
      rightUpperArm: { x: -0.7 - 0.3 * swing, y: -0.6 * swing, z: 0.9 },
      rightLowerArm: { x: 0, y: 0.9 - 0.6 * swing, z: 0 },
      leftUpperArm: { x: -0.4, y: 0, z: -1.1 },
      leftLowerArm: { x: 0, y: -0.8, z: 0 },
      leftUpperLeg: { x: -0.25, y: 0, z: 0.12 },
      rightUpperLeg: { x: -0.25, y: 0, z: -0.12 },
      leftLowerLeg: { x: 0.45, y: 0, z: 0 },
      rightLowerLeg: { x: 0.45, y: 0, z: 0 },
    },
    standingHipsY: -0.03 + 0.02 * Math.abs(Math.sin(input.time * 6.9)),
  };
}

/** Paddle ready, bouncing lightly on the toes while the opponent walks over. */
function pingpongWaitBody(input: OfficePoseInput): UpperBody {
  return {
    bones: {
      ...armsRelaxed,
      spine: { x: 0.1, y: 0, z: 0 },
      head: { x: 0, y: 0.2 * Math.sin(input.time * 0.6), z: 0 },
      rightUpperArm: { x: -0.6, y: 0, z: 0.95 },
      rightLowerArm: { x: 0, y: 0.8, z: 0 },
    },
    standingHipsY: 0.008 * Math.abs(Math.sin(input.time * 4)),
  };
}

/** Hands under the tap, rubbing together, head bowed over the sink. */
function washBody(input: OfficePoseInput): UpperBody {
  const scrub = Math.sin(input.time * 9);
  return {
    bones: {
      ...armsRelaxed,
      // Over the basin; the hands are placed in it by IK.
      spine: { x: 0.28, y: 0, z: 0 },
      head: { x: 0.3, y: 0, z: 0 },
      rightUpperArm: { x: -0.75, y: 0.35, z: 1.0 },
      rightLowerArm: { x: 0, y: 0.95 + 0.15 * scrub, z: 0 },
      leftUpperArm: { x: -0.75, y: -0.35, z: -1.0 },
      leftLowerArm: { x: 0, y: -0.95 + 0.15 * scrub, z: 0 },
    },
  };
}

/**
 * At the oven: crouching with both hands at the low door while putting food in and taking it out,
 * standing and watching through the window while it cooks, then holding the plate.
 */
function ovenBody(input: OfficePoseInput): UpperBody {
  const step = ovenStep(input.actionElapsed);
  if (step.reaching) {
    return {
      bones: {
        ...armsRelaxed,
        spine: { x: 0.45, y: 0, z: 0 },
        head: { x: 0.2, y: 0, z: 0 },
        rightUpperArm: { x: -0.95, y: 0.2, z: 1.0 },
        rightLowerArm: { x: 0, y: 0.35, z: 0 },
        leftUpperArm: { x: -0.95, y: -0.2, z: -1.0 },
        leftLowerArm: { x: 0, y: -0.35, z: 0 },
        leftUpperLeg: { x: -0.85, y: 0, z: 0.1 },
        rightUpperLeg: { x: -0.85, y: 0, z: -0.1 },
        leftLowerLeg: { x: 1.7, y: 0, z: 0 },
        rightLowerLeg: { x: 1.7, y: 0, z: 0 },
      },
      standingHipsY: -0.11,
    };
  }
  if (step.plateInHand) {
    return {
      bones: {
        ...armsRelaxed,
        head: { x: 0.25, y: 0, z: 0 },
        rightUpperArm: { x: -0.45, y: 0, z: 1.15 },
        rightLowerArm: { x: 0, y: 1.3, z: 0 },
      },
    };
  }
  // Waiting: bent a little to peer through the window, hands loosely together.
  return {
    bones: {
      ...armsRelaxed,
      spine: { x: 0.18, y: 0, z: 0 },
      head: { x: 0.4, y: 0.06 * Math.sin(input.time * 0.8), z: 0 },
      rightUpperArm: { x: -0.35, y: 0.5, z: 1.1 },
      rightLowerArm: { x: 0, y: 1.0, z: 0 },
      leftUpperArm: { x: -0.35, y: -0.5, z: -1.1 },
      leftLowerArm: { x: 0, y: -1.0, z: 0 },
    },
  };
}

/**
 * Down on their heels beside Mochi, deeper than reaching into the oven, leaning over her.
 * The right hand goes to her back by reaching, so only the body and the left arm are posed here.
 */
function petCatBody(input: OfficePoseInput): UpperBody {
  const { down } = petPhase(input.actionElapsed);
  return {
    bones: {
      ...armsRelaxed,
      spine: { x: 0.6 * down, y: 0, z: 0 },
      head: { x: 0.2 * down, y: 0, z: 0 },
      // The free hand rests on the knee.
      leftUpperArm: { x: -0.6 * down, y: -0.2 * down, z: -1.15 },
      leftLowerArm: { x: 0, y: -0.6 * down, z: 0 },
      leftUpperLeg: { x: -1.15 * down, y: 0, z: 0.15 * down },
      rightUpperLeg: { x: -1.15 * down, y: 0, z: -0.15 * down },
      leftLowerLeg: { x: 2.3 * down, y: 0, z: 0 },
      rightLowerLeg: { x: 2.3 * down, y: 0, z: 0 },
    },
    // Lower than the oven crouch: right down on their heels, so a short arm reaches the floor.
    standingHipsY: -0.24 * down,
  };
}

function upperBody(action: OfficeAction, input: OfficePoseInput): UpperBody {
  switch (action) {
    case "pet-cat":
      return petCatBody(input);
    case "wash":
      return washBody(input);
    case "oven":
      return ovenBody(input);
    case "fetch":
    case "pick":
    // Reaching for the door handle on the way out; once through, nobody sees the pose.
    case "out":
      return fetchBody(input);
    case "eat":
      return eatBody(input);
    case "type":
      return typeBody(input);
    case "desk-idle":
      return deskIdleBody(input);
    case "stretch":
      return stretchBody(input);
    case "draw":
    case "stick":
      return boardBody(input);
    case "read":
      return readBody(input);
    case "ponder":
      return ponderBody(input);
    case "cheer":
      return cheerBody(input);
    case "wave":
      return waveBody(input);
    case "relax":
      return relaxBody(input);
    case "watch":
      return watchBody(input);
    case "game":
      return gameBody(input);
    case "brew":
      return brewBody(input);
    case "snack":
      return snackBody(input);
    case "arcade":
      return arcadeBody(input);
    case "water":
      return waterBody(input);
    case "lounge":
      return loungeBody(input);
    case "selfie":
      return selfieBody(input);
    case "rack":
      return rackBody(input);
    case "chat":
    case "standup":
      return chatBody(input);
    case "standup-lead":
      return standupLeadBody(input);
    case "lunch":
      return lunchBody(input);
    case "meeting":
      return meetingBody(input);
    case "pingpong":
      return pingpongBody(input);
    case "pingpong-wait":
      return pingpongWaitBody(input);
    case "run": {
      const stride = walkPose(input.time * jogRate, jogStyle);
      return { bones: stride.bones, standingHipsY: stride.hipsOffsetY };
    }
    case "box":
      return boxBody(input);
    case "gaze":
      return gazeBody(input);
    case "hand-over":
      return handOverBody(input);
    case "wait-report":
      return waitReportBody(input);
  }
}

export function officePose(input: OfficePoseInput): Pose {
  let pose: Pose;
  if (input.action === null) {
    pose = walkPose(input.walkPhase, input.walkStyle ?? plainWalk);
    if (input.carrying) {
      pose.bones.rightUpperArm = { x: -0.3, y: 0, z: 1.3 };
      pose.bones.rightLowerArm = { x: 0, y: 1.4, z: 0 };
    }
    if (input.gimmick !== undefined && input.gimmick !== null) {
      pose.bones = { ...pose.bones, ...gimmickBones(input.gimmick, input) };
    }
  } else {
    const body = upperBody(input.action, input);
    // Typing blends its own beats in; any other action at the desk (the stretch or cheer after
    // finished work) takes the fist pump over the top of it.
    const beat = input.workBeat ?? null;
    if (beat !== null && input.action !== "type") {
      body.bones = blendBones(body.bones, workBeatBones(beat), beatEnvelope(beat));
    }
    pose =
      input.seat === null
        ? { bones: body.bones, hipsOffsetY: body.standingHipsY ?? 0 }
        : { bones: { ...body.bones, ...seatedLegs(input.seat) }, hipsOffsetY: -input.seat.hipsDrop };
  }
  if (input.chatter !== undefined && input.chatter !== null) {
    pose.bones.head = addRotation(pose.bones.head, chatterHead(input.chatter, input.time));
    if (input.chatter === "laugh") {
      pose.bones.chest = addRotation(pose.bones.chest, { x: -0.06 + 0.04 * Math.sin(input.time * 16) });
    }
  }
  if (input.lookYaw !== undefined && input.lookYaw !== 0) {
    // Mostly the head, a little of the chest, the way people turn to someone beside them.
    const yaw = Math.max(-1, Math.min(1, input.lookYaw));
    pose.bones.head = addRotation(pose.bones.head, { y: yaw * 0.7 });
    pose.bones.chest = addRotation(pose.bones.chest, { y: yaw * 0.25 });
  }
  const wave = input.bossWave ?? null;
  // Waving back at the boss, standing or seated; a walker waves with their walk gimmick instead.
  if (wave !== null && input.action !== null && wave >= bossWaveWindow.from && wave <= bossWaveWindow.to) {
    const { rightUpperArm, rightLowerArm } = waveBody(input).bones;
    if (rightUpperArm !== undefined && rightLowerArm !== undefined) {
      pose.bones.rightUpperArm = rightUpperArm;
      pose.bones.rightLowerArm = rightLowerArm;
    }
  }
  const breath = 0.015 * Math.sin((input.time * 2 * Math.PI) / 4);
  pose.bones.chest = addRotation(pose.bones.chest, { x: breath });
  // Hands are always posed, straight unless a pose bends them. IK turns a hand to point the
  // fingers onto keys or a button; a bone no pose ever names is never put back, so without
  // this the last turn stayed on the hand through every pose that came after.
  pose.bones.leftHand ??= { x: 0, y: 0, z: 0 };
  pose.bones.rightHand ??= { x: 0, y: 0, z: 0 };
  return pose;
}
