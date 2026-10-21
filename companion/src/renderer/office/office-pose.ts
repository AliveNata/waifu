import { addRotation, armsRelaxed, type Pose, type PoseBones } from "../common/pose.js";
import type { OfficeAction } from "./office-director.js";
import type { SeatFit } from "./seating.js";

export interface OfficePoseInput {
  /** Null while walking. */
  action: OfficeAction | null;
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

/** Eyes of a standing chibi, in the avatar's frame. */
const standingEyeY = 0.88;

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
function walkPose(phase: number): Pose {
  const swing = Math.sin(phase);
  const bob = Math.abs(Math.cos(phase));
  return {
    bones: {
      ...armsRelaxed,
      leftUpperArm: addRotation(armsRelaxed.leftUpperArm, { x: 0.3 * swing }),
      rightUpperArm: addRotation(armsRelaxed.rightUpperArm, { x: -0.3 * swing }),
      hips: { x: 0, y: 0.06 * swing, z: 0.025 * swing },
      leftUpperLeg: { x: -0.32 * swing, y: 0, z: 0 },
      rightUpperLeg: { x: 0.32 * swing, y: 0, z: 0 },
      // Knees only bend backward, on the leg that is swinging through.
      leftLowerLeg: { x: 0.45 * Math.max(0, -Math.cos(phase)), y: 0, z: 0 },
      rightLowerLeg: { x: 0.45 * Math.max(0, Math.cos(phase)), y: 0, z: 0 },
      spine: { x: 0.04, y: -0.04 * swing, z: 0 },
    },
    hipsOffsetY: 0.014 * bob,
  };
}

function typeBody(input: OfficePoseInput): UpperBody {
  // The hand that "pressed" the last key dips; the other lifts a little.
  const leftHandActive = input.keystrokes % 2 === 0;
  const dip = 0.12;
  return {
    bones: {
      // Leaning in brings the shoulders over the keyboard; the head tips back up to the screen.
      spine: { x: 0.3, y: 0, z: 0 },
      chest: { x: 0.08, y: 0, z: 0 },
      head: { x: 0.02, y: 0.04 * Math.sin(input.time * 0.6), z: 0 },
      leftUpperArm: { x: -0.75, y: 0, z: -1.15 },
      rightUpperArm: { x: -0.75, y: 0, z: 1.15 },
      leftLowerArm: { x: 0, y: -1.1, z: leftHandActive ? dip : -0.04 },
      rightLowerArm: { x: 0, y: 1.1, z: leftHandActive ? 0.04 : -dip },
    },
  };
}

function deskIdleBody(input: OfficePoseInput): UpperBody {
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
  // Small quick steps while shuffling along the board, feet together again once there.
  const shuffle = 0.22 * (focus?.stepping ?? 0) * Math.sin(input.time * 11);
  return {
    standingHipsY: 0.008 * Math.abs(shuffle) * 4,
    bones: {
      ...armsRelaxed,
      leftUpperLeg: { x: -shuffle, y: 0, z: 0 },
      rightUpperLeg: { x: shuffle, y: 0, z: 0 },
      leftLowerLeg: { x: Math.max(0, shuffle) * 1.4, y: 0, z: 0 },
      rightLowerLeg: { x: Math.max(0, -shuffle) * 1.4, y: 0, z: 0 },
      // Leaning in toward the board while writing, back while looking it over.
      spine: { x: mix(0.1, -0.12), y: turn * 0.3, z: 0 },
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
      spine: { x: 0.1, y: 0, z: 0 },
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
  // Talking with the hands, nodding along.
  return {
    bones: {
      spine: { x: 0.05, y: 0, z: 0 },
      head: { x: 0.08 * Math.sin(input.time * 2.3), y: 0.08 * Math.sin(input.time * 0.7), z: 0.05 },
      leftUpperArm: { x: -0.4, y: 0, z: -1.2 },
      rightUpperArm: { x: -0.4, y: 0, z: 1.2 },
      leftLowerArm: { x: 0, y: -1.2 - 0.3 * Math.sin(input.time * 1.7), z: 0 },
      rightLowerArm: { x: 0, y: 1.2 + 0.3 * Math.sin(input.time * 2.1 + 1), z: 0 },
    },
  };
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

function pingpongBody(input: OfficePoseInput): UpperBody {
  // Ready stance, paddle out front, a forehand swing about once a second and a hop on the return.
  const cycle = (input.time * 1.1) % 1;
  const swing = cycle < 0.3 ? Math.sin((cycle / 0.3) * Math.PI) : 0;
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

function upperBody(action: OfficeAction, input: OfficePoseInput): UpperBody {
  switch (action) {
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
      return chatBody(input);
    case "meeting":
      return meetingBody(input);
    case "pingpong":
      return pingpongBody(input);
    case "pingpong-wait":
      return pingpongWaitBody(input);
  }
}

export function officePose(input: OfficePoseInput): Pose {
  let pose: Pose;
  if (input.action === null) {
    pose = walkPose(input.walkPhase);
    if (input.carrying) {
      pose.bones.rightUpperArm = { x: -0.3, y: 0, z: 1.3 };
      pose.bones.rightLowerArm = { x: 0, y: 1.4, z: 0 };
    }
  } else {
    const body = upperBody(input.action, input);
    pose =
      input.seat === null
        ? { bones: body.bones, hipsOffsetY: body.standingHipsY ?? 0 }
        : { bones: { ...body.bones, ...seatedLegs(input.seat) }, hipsOffsetY: -input.seat.hipsDrop };
  }
  const breath = 0.015 * Math.sin((input.time * 2 * Math.PI) / 4);
  pose.bones.chest = addRotation(pose.bones.chest, { x: breath });
  return pose;
}
