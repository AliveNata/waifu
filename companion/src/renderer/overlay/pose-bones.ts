import type { CompanionFace, CompanionPose } from "../../shared/companion-pose.js";
import type { ExpressionWeights } from "../common/expressions.js";
import { addRotation, type BoneRotation, type PoseBones } from "../common/pose.js";
import { chestSwatSeconds, flickSnapSeconds } from "./hand-gestures.js";
import type { TouchGesture } from "./touch-reactions.js";
import type { TouchSide } from "./touch-zones.js";

/*
 * Axis notes for three-vrm normalized bones (model faces +Z, T-pose rest):
 * - right upper arm z: +1.22 hangs down, 0 points sideways, negative raises it overhead
 * - right lower arm y: positive folds the forearm forward and up (toward the chest)
 * - right lower arm z: negative folds it upward when the upper arm is held sideways
 * - left arm: the same with y and z negated
 * - fingers: right curls with +z, left with -z
 */

type Hand = "left" | "right";

/** Mirrors a rotation written for the right arm onto the left arm. */
function mirror(rotation: BoneRotation): BoneRotation {
  return { x: rotation.x, y: -rotation.y, z: -rotation.z };
}

function arm(bones: PoseBones, hand: Hand, upper: BoneRotation, lower: BoneRotation, wrist?: BoneRotation): void {
  const flip = hand === "left" ? mirror : (rotation: BoneRotation) => rotation;
  bones[`${hand}UpperArm`] = flip(upper);
  bones[`${hand}LowerArm`] = flip(lower);
  if (wrist !== undefined) {
    bones[`${hand}Hand`] = flip(wrist);
  }
}

const fingerNames = ["Index", "Middle", "Ring", "Little"] as const;

/** Curls each finger by its amount (0 straight, 1 a fist). The thumb folds across the palm. */
function fingers(bones: PoseBones, hand: Hand, curl: Record<(typeof fingerNames)[number] | "Thumb", number>): void {
  const sign = hand === "right" ? 1 : -1;
  for (const finger of fingerNames) {
    const amount = curl[finger];
    bones[`${hand}${finger}Proximal`] = { x: 0, y: 0, z: sign * 1.4 * amount };
    bones[`${hand}${finger}Intermediate`] = { x: 0, y: 0, z: sign * 1.5 * amount };
    bones[`${hand}${finger}Distal`] = { x: 0, y: 0, z: sign * 1.1 * amount };
  }
  const thumb = curl.Thumb;
  bones[`${hand}ThumbProximal`] = { x: 0, y: -sign * 0.6 * thumb, z: sign * 0.3 * thumb };
  bones[`${hand}ThumbDistal`] = { x: 0, y: -sign * 0.8 * thumb, z: 0 };
}

/** Eases in over the first `rise` seconds and back out over the last `fall` seconds of `total`. */
export function envelope(elapsed: number, total: number, rise = 0.35, fall = 0.4): number {
  if (elapsed <= 0 || elapsed >= total) {
    return 0;
  }
  const up = Math.min(1, elapsed / rise);
  const down = Math.min(1, (total - elapsed) / fall);
  const value = Math.min(up, down);
  return value * value * (3 - 2 * value);
}

function scaled(rotation: BoneRotation, amount: number): Partial<BoneRotation> {
  return { x: rotation.x * amount, y: rotation.y * amount, z: rotation.z * amount };
}

/** The hand on the side she was touched, or her right hand for the middle. */
function handFor(side: TouchSide): Hand {
  return side === "left" ? "left" : "right";
}

function smoothstep(value: number): number {
  const u = Math.min(1, Math.max(0, value));
  return u * u * (3 - 2 * u);
}

/** `from` moved toward `to` by `amount`, per axis. */
function blend(from: BoneRotation, to: BoneRotation, amount: number): BoneRotation {
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
    z: from.z + (to.z - from.z) * amount,
  };
}

const armDown: BoneRotation = { x: 0, y: 0, z: 1.22 };
const noBend: BoneRotation = { x: 0, y: 0, z: 0 };

/**
 * Touched on the chest: her right arm sweeps out across her front and knocks the pointer hand
 * aside, landing at `chestSwatSeconds` like the hand's own knock, then both arms fold over her
 * chest while she leans back and turns her face away and down.
 */
function coverChest(bones: PoseBones, elapsed: number, durationSeconds: number, turn: number): void {
  const k = envelope(elapsed, durationSeconds, 0.25, 0.6);
  // The swat: from reaching across, in front of her, out to her side.
  const sweep = smoothstep((elapsed - (chestSwatSeconds - 0.25)) / 0.35);
  const cover = smoothstep((elapsed - chestSwatSeconds - 0.15) / 0.4) * k;
  const swatUpper: BoneRotation = { x: 0, y: 1.35 - 1.15 * sweep, z: 0.4 };
  const swatLower: BoneRotation = { x: 0, y: 0.45, z: 0 };
  // Forearms across the chest, the same fold as the crossed-arms pose but higher and tighter.
  const coverUpper: BoneRotation = { x: -0.3, y: 1.05, z: 1.12 };
  const coverLower: BoneRotation = { x: 0, y: 1.95, z: 0 };
  const swat = k * (1 - cover);
  arm(
    bones,
    "right",
    blend(blend(armDown, swatUpper, swat), coverUpper, cover),
    blend(blend(noBend, swatLower, swat), coverLower, cover),
  );
  // The other arm covers up straight away.
  const left = smoothstep(elapsed / 0.35) * k;
  arm(bones, "left", blend(armDown, { x: -0.4, y: 1.0, z: 1.1 }, left), blend(noBend, { x: 0, y: 1.85, z: 0 }, left));
  bones.spine = addRotation(bones.spine, scaled({ x: -0.12, y: 0, z: 0 }, k));
  bones.chest = addRotation(bones.chest, scaled({ x: 0.06, y: 0, z: 0 }, k));
  bones.neck = addRotation(bones.neck, scaled({ x: 0.05, y: -0.15 * turn, z: 0 }, k));
  bones.head = addRotation(bones.head, scaled({ x: 0.14, y: -0.32 * turn, z: 0.06 * turn }, k));
}

export interface GestureInput {
  gesture: TouchGesture;
  elapsed: number;
  durationSeconds: number;
  side: TouchSide;
  /** Cursor direction, for following the hand: yaw positive is screen right. */
  aimYaw: number;
  aimPitch: number;
}

/** Adds a touch reaction's body language on top of the idle pose. */
export function applyTouchGesture(bones: PoseBones, input: GestureInput): void {
  const { elapsed, durationSeconds, side } = input;
  const k = envelope(elapsed, durationSeconds);
  // Screen side of the touch: her left is the viewer's right, and head yaw + turns toward her left.
  const toward = side === "left" ? 1 : side === "right" ? -1 : 0;
  switch (input.gesture) {
    case "lean-in":
      bones.head = addRotation(bones.head, scaled({ x: 0.1, y: 0, z: 0.12 * (toward || 1) }, k));
      bones.neck = addRotation(bones.neck, scaled({ x: 0.06, y: 0, z: 0.05 }, k));
      break;
    case "sleepy":
      bones.head = addRotation(bones.head, scaled({ x: 0.16, y: 0, z: 0.1 }, k));
      bones.spine = addRotation(bones.spine, scaled({ x: 0.04, y: 0, z: 0 }, k));
      break;
    case "tuck-hair": {
      const hand = handFor(side === "center" ? "right" : side);
      // Same hand-by-the-face arm as the peace pose, so the hand reaches her hair inside the close-up.
      arm(bones, hand, { x: -0.6 * k, y: 0, z: 1.22 - 0.4 * k }, { x: 0, y: 2.5 * k, z: 0 });
      bones.head = addRotation(bones.head, scaled({ x: 0, y: 0, z: -0.08 * (toward || 1) }, k));
      break;
    }
    case "giggle": {
      const shake = 0.04 * Math.sin(elapsed * 22) * k;
      bones.chest = addRotation(bones.chest, { x: shake });
      bones.head = addRotation(bones.head, { x: shake, z: 0.08 * k });
      break;
    }
    case "flinch": {
      // Her head snaps back when the finger hits, not when the click lands.
      const since = elapsed - flickSnapSeconds;
      const snap = since < 0 ? 0 : Math.exp(-since * 6) * k;
      bones.head = addRotation(bones.head, { x: -0.22 * snap });
      bones.neck = addRotation(bones.neck, { x: -0.08 * snap });
      break;
    }
    case "rub-forehead": {
      const rub = 0.08 * Math.sin(elapsed * 14) * k;
      arm(bones, "right", { x: -0.75, y: 0, z: 0.95 - 0.1 * k }, { x: 0, y: 2.45 * k, z: rub });
      bones.head = addRotation(bones.head, scaled({ x: 0.08, y: 0, z: 0 }, k));
      break;
    }
    case "surprise-smile": {
      const jump = Math.exp(-elapsed * 6);
      bones.head = addRotation(bones.head, { x: -0.12 * jump, y: 0.2 * toward * k });
      break;
    }
    case "pout-away":
    case "turn-away":
      // Away from where the touch came from; from the middle she turns to her right.
      bones.head = addRotation(bones.head, scaled({ x: -0.05, y: -0.45 * (toward || 1), z: 0 }, k));
      bones.neck = addRotation(bones.neck, scaled({ x: 0, y: -0.2 * (toward || 1), z: 0 }, k));
      if (input.gesture === "turn-away") {
        bones.spine = addRotation(bones.spine, scaled({ x: 0, y: -0.25 * (toward || 1), z: 0 }, k));
      }
      break;
    case "turn-nod": {
      const nod =
        elapsed > 0.5 ? 0.14 * Math.max(0, Math.sin((elapsed - 0.5) * 10)) * Math.exp(-(elapsed - 0.5) * 2) : 0;
      bones.head = addRotation(bones.head, { x: nod, y: 0.3 * toward * k });
      bones.neck = addRotation(bones.neck, scaled({ x: 0, y: 0.15 * toward, z: 0 }, k));
      break;
    }
    case "tilt-ask":
      bones.head = addRotation(bones.head, scaled({ x: -0.04, y: 0.2 * toward, z: 0.2 * (toward || 1) }, k));
      break;
    case "follow-hand": {
      const hand = handFor(side === "center" ? "right" : side);
      // Lift the arm forward toward the cursor so the hand trails it.
      const lift = Math.min(1.1, 0.6 - input.aimPitch);
      arm(
        bones,
        hand,
        { x: -lift * k, y: 0, z: 1.22 - 0.5 * k + (hand === "right" ? 1 : -1) * input.aimYaw * 0.4 * k },
        {
          x: 0,
          y: 0.35 * k,
          z: 0,
        },
      );
      break;
    }
    case "wave-small": {
      const hand = handFor(side === "center" ? "right" : side);
      const waveAngle = 0.25 * Math.sin(elapsed * 12) * k;
      arm(bones, hand, { x: -0.3, y: 0, z: 1.22 - 1.0 * k }, { x: 0, y: 2.2 * k, z: waveAngle });
      break;
    }
    case "step-back":
      bones.spine = addRotation(bones.spine, scaled({ x: -0.1, y: 0, z: 0 }, k));
      bones.head = addRotation(bones.head, scaled({ x: -0.1, y: 0, z: 0 }, k));
      break;
    case "cover-chest":
      coverChest(bones, elapsed, durationSeconds, toward || 1);
      break;
    case "scrunch": {
      const snap = Math.exp(-elapsed * 4) * k;
      bones.head = addRotation(bones.head, { x: -0.1 * snap, z: 0.06 * k });
      bones.chest = addRotation(bones.chest, { x: 0.03 * Math.sin(elapsed * 20) * k });
      break;
    }
  }
}

/** How long a requested pose holds before she goes back to idle. */
export const poseHoldSeconds = 6;

/** Poses that need her arms in the frame, so the close-up pulls back while they last. */
export function poseNeedsWideFrame(pose: CompanionPose | null): boolean {
  return pose !== null && pose !== "tongue";
}

/**
 * Where the wide frame centers, in meters relative to the usual close-up focus: lower for poses
 * at chest height, higher for poses with a hand above her head.
 */
export function poseFocusShift(pose: CompanionPose | null): number {
  return pose === "raise-hand" || pose === "stretch" ? 0.12 : -0.2;
}

/** Replaces the arms (and nudges head and spine) for a requested pose. */
export function applyCommandPose(bones: PoseBones, pose: CompanionPose, elapsed: number): void {
  const k = envelope(elapsed, poseHoldSeconds, 0.5, 0.6);
  const swing = (speed: number, size: number) => size * Math.sin(elapsed * speed) * k;
  switch (pose) {
    case "raise-hand":
      arm(bones, "right", { x: -0.25 * k, y: 0, z: 1.22 - 2.55 * k }, { x: 0, y: 0, z: -0.25 * k });
      fingers(bones, "right", { Thumb: 0, Index: 0, Middle: 0, Ring: 0, Little: 0 });
      bones.head = addRotation(bones.head, { z: -0.06 * k });
      break;
    case "ponder":
      arm(bones, "right", { x: -0.55 * k, y: 0, z: 1.22 + 0.05 * k }, { x: 0, y: 2.15 * k, z: 0 });
      arm(bones, "left", { x: -0.35 * k, y: 0, z: 1.22 - 0.05 * k }, { x: 0, y: 1.5 * k, z: 0 });
      fingers(bones, "right", { Thumb: 0.2 * k, Index: 0.35 * k, Middle: 0.6 * k, Ring: 0.7 * k, Little: 0.7 * k });
      bones.head = addRotation(bones.head, { x: -0.12 * k, z: 0.12 * k });
      break;
    case "wave":
      // Hand beside her face, like the peace pose, swaying side to side from the shoulder.
      arm(bones, "right", { x: -0.35 * k, y: 0, z: 1.22 - 0.55 * k + swing(9, 0.14) }, { x: 0, y: 2.2 * k, z: 0 });
      fingers(bones, "right", { Thumb: 0, Index: 0, Middle: 0, Ring: 0, Little: 0 });
      bones.head = addRotation(bones.head, { z: 0.08 * k });
      break;
    case "peace":
      arm(
        bones,
        "right",
        { x: -0.6 * k, y: 0, z: 1.22 - 0.35 * k },
        { x: 0, y: 2.4 * k, z: 0 },
        { x: 0, y: -0.3 * k, z: 0 },
      );
      fingers(bones, "right", { Thumb: k, Index: 0, Middle: 0, Ring: k, Little: k });
      bones.head = addRotation(bones.head, { z: -0.12 * k });
      break;
    case "thumbs-up":
      arm(
        bones,
        "right",
        { x: -0.95 * k, y: 0, z: 1.22 - 0.15 * k },
        { x: 0, y: 1.55 * k, z: 0 },
        { x: 0, y: 0, z: -0.4 * k },
      );
      fingers(bones, "right", { Thumb: 0, Index: k, Middle: k, Ring: k, Little: k });
      break;
    case "cross-arms":
      // Upper arms turned inward around their length, so the bent forearms fold across the chest.
      arm(bones, "right", { x: -0.25 * k, y: 1.0 * k, z: 1.22 - 0.07 * k }, { x: 0, y: 1.75 * k, z: 0 });
      arm(bones, "left", { x: -0.35 * k, y: 1.0 * k, z: 1.22 - 0.07 * k }, { x: 0, y: 1.7 * k, z: 0 });
      bones.head = addRotation(bones.head, { x: -0.04 * k, y: 0.15 * k });
      break;
    case "clap": {
      const together = 0.22 * Math.max(0, Math.sin(elapsed * 9)) * k;
      arm(bones, "right", { x: -0.75 * k, y: 0.65 * k + together, z: 1.22 - 0.22 * k }, { x: 0, y: 1.2 * k, z: 0 });
      arm(bones, "left", { x: -0.75 * k, y: 0.65 * k + together, z: 1.22 - 0.22 * k }, { x: 0, y: 1.2 * k, z: 0 });
      break;
    }
    case "scratch-head":
      arm(bones, "right", { x: -0.3 * k, y: 0, z: 1.22 - 2.0 * k }, { x: 0, y: 0, z: -1.7 * k + swing(14, 0.12) });
      fingers(bones, "right", { Thumb: 0.3 * k, Index: 0.4 * k, Middle: 0.4 * k, Ring: 0.4 * k, Little: 0.4 * k });
      bones.head = addRotation(bones.head, { x: 0.05 * k, z: -0.1 * k });
      break;
    case "stretch":
      arm(bones, "right", { x: 0, y: 0, z: 1.22 - 2.65 * k }, { x: 0, y: 0, z: -0.15 * k });
      arm(bones, "left", { x: 0, y: 0, z: 1.22 - 2.65 * k }, { x: 0, y: 0, z: -0.15 * k });
      bones.spine = addRotation(bones.spine, { x: -0.1 * k });
      bones.head = addRotation(bones.head, { x: -0.18 * k });
      break;
    case "tongue":
      bones.head = addRotation(bones.head, { x: 0.04 * k, z: 0.12 * k });
      break;
  }
}

/** Face for a pose or an asked-for expression. The tongue pose winks; the stage adds the tongue itself. */
export function commandFace(pose: CompanionPose | null, face: CompanionFace | null): ExpressionWeights {
  switch (face) {
    case "smile":
      return { happy: 0.6 };
    case "pout":
      return { angry: 0.3, sad: 0.15 };
    case "surprised":
      return { surprised: 0.8 };
    case "sad":
      return { sad: 0.65 };
    case "angry":
      return { angry: 0.65 };
    case "sleepy":
      return { relaxed: 0.6, blink: 0.45 };
    case null:
      break;
  }
  switch (pose) {
    case "ponder":
      return { relaxed: 0.25 };
    case "tongue":
      return { blinkRight: 1, happy: 0.2, aa: 0.25 };
    case "scratch-head":
      return { sad: 0.2, surprised: 0.15 };
    case null:
      return {};
    default:
      return { happy: 0.35 };
  }
}
