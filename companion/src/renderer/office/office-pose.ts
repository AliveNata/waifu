import type { Mood } from "../../shared/reaction.js";
import { addRotation, armsRelaxed, type Pose, type PoseBones } from "../common/pose.js";
import type { ActorActivity } from "./office-actor.js";

export interface OfficePoseInput {
  activity: ActorActivity;
  mood: Mood;
  time: number;
  moodElapsed: number;
  /** How far the hips drop when sitting, in the model's own units. Measured per model by the chibi setup. */
  sitDrop: number;
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

function typingPose(time: number, sitDrop: number): Pose {
  const tap = Math.sin(time * 17);
  return {
    bones: {
      ...seatedLegs,
      spine: { x: 0.12, y: 0, z: 0 },
      head: { x: 0.18, y: 0.05 * Math.sin(time * 0.6), z: 0 },
      leftUpperArm: { x: -0.75, y: 0, z: -1.15 },
      rightUpperArm: { x: -0.75, y: 0, z: 1.15 },
      leftLowerArm: { x: 0, y: -1.1, z: 0.05 * tap },
      rightLowerArm: { x: 0, y: 1.1, z: -0.05 * tap },
    },
    hipsOffsetY: -sitDrop,
  };
}

function boardPose(time: number): Pose {
  const write = Math.sin(time * 3.2);
  return {
    bones: {
      ...armsRelaxed,
      rightUpperArm: { x: -0.9, y: 0, z: 0.35 + 0.12 * write },
      rightLowerArm: { x: 0, y: 0.7, z: 0 },
      head: { x: -0.1, y: 0, z: 0.12 },
    },
    hipsOffsetY: 0,
  };
}

function relaxPose(time: number, sitDrop: number): Pose {
  return {
    bones: {
      ...seatedLegs,
      spine: { x: -0.1, y: 0, z: 0 },
      head: { x: 0.04 * Math.sin(time * 0.5), y: 0.25 * Math.sin(time * 0.15), z: 0.08 },
      leftUpperArm: { x: -0.25, y: 0, z: -1.3 },
      rightUpperArm: { x: -0.25, y: 0, z: 1.3 },
    },
    hipsOffsetY: -sitDrop,
  };
}

function frontPose(mood: Mood, time: number, moodElapsed: number): Pose {
  switch (mood) {
    case "greeting":
    case "waiting": {
      // Greeting waves fast; waiting waves slower and keeps going to get attention.
      const speed = mood === "greeting" ? 9 : 5;
      return {
        bones: {
          ...armsRelaxed,
          rightUpperArm: { x: 0, y: 0, z: 0.05 },
          rightLowerArm: { x: 0, y: 0, z: -1.4 + 0.35 * Math.sin(time * speed) },
          head: { x: 0, y: 0, z: -0.12 },
        },
        hipsOffsetY: 0,
      };
    }
    case "done": {
      // A few small hops with both arms up, then she settles.
      const hopping = moodElapsed < 1.6;
      const hop = hopping ? 0.07 * Math.abs(Math.sin(moodElapsed * 7)) : 0;
      return {
        bones: {
          ...armsRelaxed,
          leftUpperArm: { x: 0, y: 0, z: hopping ? 0.9 : -1.22 },
          rightUpperArm: { x: 0, y: 0, z: hopping ? -0.9 : 1.22 },
        },
        hipsOffsetY: hop,
      };
    }
    default:
      return { bones: { ...armsRelaxed }, hipsOffsetY: 0 };
  }
}

export function officePose(input: OfficePoseInput): Pose {
  const breath = 0.015 * Math.sin((input.time * 2 * Math.PI) / 4);
  let pose: Pose;
  if (input.activity.kind === "walk") {
    pose = walkPose(input.activity.phase);
  } else {
    switch (input.activity.activity) {
      case "sit-type":
        pose = typingPose(input.time, input.sitDrop);
        break;
      case "stand-board":
        pose = boardPose(input.time);
        break;
      case "sit-relax":
        pose = relaxPose(input.time, input.sitDrop);
        break;
      case "stand-front":
        pose = frontPose(input.mood, input.time, input.moodElapsed);
        break;
    }
  }
  pose.bones.chest = addRotation(pose.bones.chest, { x: breath });
  return pose;
}
