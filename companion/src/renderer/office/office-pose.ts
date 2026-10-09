import { addRotation, armsRelaxed, type Pose, type PoseBones } from "../common/pose.js";
import type { OfficeAction } from "./office-director.js";

export interface OfficePoseInput {
  /** Null while walking. */
  action: OfficeAction | null;
  walkPhase: number;
  time: number;
  /** Seconds since the current action began. Drives one-shot gestures. */
  actionElapsed: number;
  /** How far the hips drop when sitting, in the avatar's own pose units. */
  sitDrop: number;
  /** Increments on every key press, so typing hands alternate with the text on screen. */
  keystrokes: number;
}

const seatedLegs: PoseBones = {
  leftUpperLeg: { x: -1.5, y: 0, z: 0.06 },
  rightUpperLeg: { x: -1.5, y: 0, z: -0.06 },
  leftLowerLeg: { x: 1.5, y: 0, z: 0 },
  rightLowerLeg: { x: 1.5, y: 0, z: 0 },
};

function walkPose(phase: number): Pose {
  const swing = Math.sin(phase);
  const bob = Math.abs(Math.cos(phase));
  return {
    bones: {
      ...armsRelaxed,
      leftUpperArm: addRotation(armsRelaxed.leftUpperArm, { x: 0.45 * swing }),
      rightUpperArm: addRotation(armsRelaxed.rightUpperArm, { x: -0.45 * swing }),
      leftUpperLeg: { x: -0.55 * swing, y: 0, z: 0 },
      rightUpperLeg: { x: 0.55 * swing, y: 0, z: 0 },
      // Knees only bend backward, on the leg that is swinging through.
      leftLowerLeg: { x: 0.7 * Math.max(0, -Math.cos(phase)), y: 0, z: 0 },
      rightLowerLeg: { x: 0.7 * Math.max(0, Math.cos(phase)), y: 0, z: 0 },
      spine: { x: 0.05, y: 0, z: 0 },
    },
    hipsOffsetY: 0.025 * bob,
  };
}

function typePose(input: OfficePoseInput): Pose {
  // The hand that "pressed" the last key dips; the other lifts a little.
  const leftHandActive = input.keystrokes % 2 === 0;
  const dip = 0.12;
  return {
    bones: {
      ...seatedLegs,
      spine: { x: 0.12, y: 0, z: 0 },
      head: { x: 0.16, y: 0.04 * Math.sin(input.time * 0.6), z: 0 },
      leftUpperArm: { x: -0.75, y: 0, z: -1.15 },
      rightUpperArm: { x: -0.75, y: 0, z: 1.15 },
      leftLowerArm: { x: 0, y: -1.1, z: leftHandActive ? dip : -0.04 },
      rightLowerArm: { x: 0, y: 1.1, z: leftHandActive ? 0.04 : -dip },
    },
    hipsOffsetY: -input.sitDrop,
  };
}

function deskIdlePose(input: OfficePoseInput): Pose {
  return {
    bones: {
      ...seatedLegs,
      spine: { x: -0.06, y: 0, z: 0 },
      head: { x: 0.02, y: 0.45 * Math.sin(input.time * 0.25), z: 0.05 * Math.sin(input.time * 0.4) },
      leftUpperArm: { x: -0.35, y: 0, z: -1.25 },
      rightUpperArm: { x: -0.35, y: 0, z: 1.25 },
      leftLowerArm: { x: 0, y: -0.6, z: 0 },
      rightLowerArm: { x: 0, y: 0.6, z: 0 },
    },
    hipsOffsetY: -input.sitDrop,
  };
}

function stretchPose(input: OfficePoseInput): Pose {
  // Arms go up for a big stretch, then settle back to the desk.
  const raised = input.actionElapsed < 2.5;
  return {
    bones: {
      ...seatedLegs,
      spine: { x: -0.12, y: 0, z: 0 },
      head: { x: -0.15, y: 0, z: 0 },
      leftUpperArm: { x: 0, y: 0, z: raised ? 1.2 : -1.25 },
      rightUpperArm: { x: 0, y: 0, z: raised ? -1.2 : 1.25 },
      leftLowerArm: { x: 0, y: raised ? 0 : -0.6, z: 0 },
      rightLowerArm: { x: 0, y: raised ? 0 : 0.6, z: 0 },
    },
    hipsOffsetY: -input.sitDrop,
  };
}

/** Base for drawing and sticking notes. IK then moves the right hand onto the board. */
function boardPose(input: OfficePoseInput): Pose {
  return {
    bones: {
      ...armsRelaxed,
      rightUpperArm: { x: -0.9, y: 0, z: 0.3 },
      rightLowerArm: { x: 0, y: 0.6, z: 0 },
      head: { x: 0.02, y: 0, z: 0.06 * Math.sin(input.time * 0.8) },
    },
    hipsOffsetY: 0,
  };
}

function readPose(input: OfficePoseInput): Pose {
  // Both forearms forward as if holding an open book, head bowed over it.
  return {
    bones: {
      leftUpperArm: { x: -0.35, y: 0, z: -1.3 },
      rightUpperArm: { x: -0.35, y: 0, z: 1.3 },
      leftLowerArm: { x: 0, y: -1.35, z: 0 },
      rightLowerArm: { x: 0, y: 1.35, z: 0 },
      head: { x: 0.3, y: 0, z: 0.03 * Math.sin(input.time * 0.5) },
    },
    hipsOffsetY: 0,
  };
}

function ponderPose(input: OfficePoseInput): Pose {
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
    hipsOffsetY: 0,
  };
}

function cheerPose(input: OfficePoseInput): Pose {
  const hopping = input.actionElapsed < 1.6;
  const hop = hopping ? 0.07 * Math.abs(Math.sin(input.actionElapsed * 7)) : 0;
  return {
    bones: {
      ...armsRelaxed,
      leftUpperArm: { x: 0, y: 0, z: hopping ? 0.9 : -1.22 },
      rightUpperArm: { x: 0, y: 0, z: hopping ? -0.9 : 1.22 },
    },
    hipsOffsetY: hop,
  };
}

function wavePose(input: OfficePoseInput): Pose {
  return {
    bones: {
      ...armsRelaxed,
      rightUpperArm: { x: 0, y: 0, z: 0.05 },
      rightLowerArm: { x: 0, y: 0, z: -1.4 + 0.35 * Math.sin(input.time * 8) },
      head: { x: 0, y: 0, z: -0.12 },
    },
    hipsOffsetY: 0,
  };
}

function relaxPose(input: OfficePoseInput): Pose {
  return {
    bones: {
      ...seatedLegs,
      spine: { x: -0.1, y: 0, z: 0 },
      head: { x: 0.04 * Math.sin(input.time * 0.5), y: 0.25 * Math.sin(input.time * 0.15), z: 0.08 },
      leftUpperArm: { x: -0.25, y: 0, z: -1.3 },
      rightUpperArm: { x: -0.25, y: 0, z: 1.3 },
    },
    hipsOffsetY: -input.sitDrop,
  };
}

export function officePose(input: OfficePoseInput): Pose {
  let pose: Pose;
  switch (input.action) {
    case null:
      pose = walkPose(input.walkPhase);
      break;
    case "type":
      pose = typePose(input);
      break;
    case "desk-idle":
      pose = deskIdlePose(input);
      break;
    case "stretch":
      pose = stretchPose(input);
      break;
    case "draw":
    case "stick":
      pose = boardPose(input);
      break;
    case "read":
      pose = readPose(input);
      break;
    case "ponder":
      pose = ponderPose(input);
      break;
    case "cheer":
      pose = cheerPose(input);
      break;
    case "wave":
      pose = wavePose(input);
      break;
    case "relax":
      pose = relaxPose(input);
      break;
  }
  const breath = 0.015 * Math.sin((input.time * 2 * Math.PI) / 4);
  pose.bones.chest = addRotation(pose.bones.chest, { x: breath });
  return pose;
}
