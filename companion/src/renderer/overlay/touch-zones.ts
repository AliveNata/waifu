import type { VRMHumanBoneName } from "@pixiv/three-vrm";

/** Where on 2B a click landed, in the words the reactions are written in. */
export type TouchZone = "head" | "hair" | "forehead" | "cheek" | "nose" | "shoulder" | "hand" | "body";
/** Her own left or right, not the screen's: she faces the viewer, so her left is screen right. */
export type TouchSide = "left" | "right" | "center";

export interface TouchProbe {
  /** Material of the mesh that was hit. VRoid names them by part, like `Hair_00_HAIR` or `Face_00_SKIN`. */
  materialName: string;
  /** The humanoid bone nearest to the hit point, or null when none is close. */
  bone: VRMHumanBoneName | null;
  /** Hit point relative to the head bone in meters: x toward her left, y up, z toward the viewer. */
  head: { x: number; y: number; z: number };
  /** Eye height above the head bone, in meters. */
  eyeHeight: number;
}

const handBones: ReadonlySet<string> = new Set(["leftHand", "rightHand", "leftLowerArm", "rightLowerArm"]);
const shoulderBones: ReadonlySet<string> = new Set(["leftShoulder", "rightShoulder", "leftUpperArm", "rightUpperArm"]);
const headBones: ReadonlySet<string> = new Set(["head", "neck", "leftEye", "rightEye", "jaw"]);

/*
 * Measured on the VRoid base model (eyes about 6 cm above the head bone): the crown sits about
 * 12 cm above the eyes, the bangs over the forehead about 6 cm above and 11 cm forward, the brow
 * skin 2 cm above, the nose tip 4 cm below.
 */
/** Hair this far above the eyes is the top of the head, where a pat lands. */
const crownAboveEyes = 0.06;
/** Bangs in front of the forehead: low enough, central enough, and far enough forward. */
const bangsBelowCrown = 0.09;
const bangsHalfWidth = 0.045;
const bangsForward = 0.08;
/** Skin this far above the eyes is the forehead. */
const foreheadAboveEyes = 0.012;
/** Half the width of the nose band, from the bridge between the eyes down to the tip. */
const noseHalfWidth = 0.018;
const noseTop = 0.012;
const noseBottom = -0.055;
/** Eye height on the model those numbers came from; other heads scale by their own. */
const measuredEyeHeight = 0.062;
const sideDeadZone = 0.02;

function sideOf(x: number): TouchSide {
  if (x > sideDeadZone) {
    return "left";
  }
  return x < -sideDeadZone ? "right" : "center";
}

function sideOfBone(bone: string): TouchSide {
  return bone.startsWith("left") ? "left" : "right";
}

function isFinger(bone: string): boolean {
  return /(Thumb|Index|Middle|Ring|Little)/.test(bone);
}

export function classifyTouch(probe: TouchProbe): { zone: TouchZone; side: TouchSide } {
  const { bone, head, eyeHeight } = probe;
  if (bone !== null && (handBones.has(bone) || isFinger(bone))) {
    return { zone: "hand", side: sideOfBone(bone) };
  }
  if (bone !== null && shoulderBones.has(bone)) {
    return { zone: "shoulder", side: sideOfBone(bone) };
  }
  const isHair = /hair/i.test(probe.materialName);
  const nearHead = bone !== null && headBones.has(bone);
  if (!isHair && !nearHead) {
    return { zone: "body", side: sideOf(head.x) };
  }
  // A bigger or smaller head keeps its proportions, so every distance scales with the eyes.
  const scale = Math.min(1.8, Math.max(0.6, eyeHeight / measuredEyeHeight));
  const aboveEyes = (head.y - eyeHeight) / scale;
  const x = head.x / scale;
  if (isHair) {
    // Flicking someone's forehead usually lands on their bangs.
    if (aboveEyes < bangsBelowCrown && Math.abs(x) < bangsHalfWidth && head.z / scale > bangsForward) {
      return { zone: "forehead", side: "center" };
    }
    return aboveEyes > crownAboveEyes ? { zone: "head", side: "center" } : { zone: "hair", side: sideOf(x) };
  }
  if (aboveEyes > foreheadAboveEyes) {
    return { zone: "forehead", side: "center" };
  }
  if (Math.abs(x) < noseHalfWidth && aboveEyes <= noseTop && aboveEyes > noseBottom) {
    return { zone: "nose", side: "center" };
  }
  // Cheeks, and the mouth and chin below the nose, all read as "she poked my face".
  return { zone: "cheek", side: sideOf(x) };
}
