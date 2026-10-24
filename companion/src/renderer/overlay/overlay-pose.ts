import type { CompanionPose } from "../../shared/companion-pose.js";
import type { Mood } from "../../shared/reaction.js";
import { addRotation, armsRelaxed, clamp, type Pose, type PoseBones } from "../common/pose.js";
import { type ActiveFidget, applyFidget, applyMoodVariant } from "./idle-fidgets.js";
import { applyCommandPose, applyTouchGesture, type GestureInput } from "./pose-bones.js";

export interface OverlayPoseInput {
  mood: Mood;
  /** Seconds since the page started. Drives breathing. */
  time: number;
  /** Seconds since the current mood began. Drives one-shot gestures like the nod. */
  moodElapsed: number;
  /** Cursor direction in radians. Positive yaw is screen right, positive pitch is below the face. */
  aimYaw: number;
  aimPitch: number;
  /** A touch reaction playing on top of the mood, if any. */
  touch?: GestureInput | null;
  /** A pose asked for from the office chat, if any. It wins over the touch for the arms. */
  command?: { pose: CompanionPose; elapsed: number } | null;
  /** Something she does on her own while nothing else is going on. */
  fidget?: ActiveFidget | null;
  /** Which of a mood's few ways of holding herself this one uses, picked when it started. */
  variant?: number;
}

const maxHeadYaw = 0.7;
const maxHeadPitch = 0.45;

/** How strongly the head follows the cursor per mood: lower when she is busy. */
const cursorFollow: Record<Mood, number> = {
  idle: 1,
  greeting: 0.8,
  thinking: 0.3,
  working: 0.25,
  waiting: 0.6,
  done: 0.7,
};

export function cursorAim(dx: number, dy: number): { yaw: number; pitch: number } {
  // Screen pixels to a gentle angle: a cursor ~600px away reads as a full turn.
  return { yaw: Math.atan(dx / 600), pitch: Math.atan(dy / 600) };
}

export function overlayPose(input: OverlayPoseInput): Pose {
  const breath = Math.sin((input.time * 2 * Math.PI) / 4.2);
  const follow = cursorFollow[input.mood];
  const headYaw = clamp(input.aimYaw * follow, -maxHeadYaw, maxHeadYaw);
  const headPitch = clamp(input.aimPitch * follow, -maxHeadPitch, maxHeadPitch);

  const bones: PoseBones = {
    ...armsRelaxed,
    spine: { x: 0.015 * breath, y: 0, z: 0 },
    chest: { x: 0.02 * breath, y: 0, z: 0 },
    neck: { x: headPitch * 0.4, y: headYaw * 0.4, z: 0 },
    head: { x: headPitch * 0.6, y: headYaw * 0.6, z: 0.02 * Math.sin(input.time * 0.7) },
  };

  switch (input.mood) {
    case "thinking":
      bones.head = addRotation(bones.head, { x: -0.12, z: 0.14 });
      break;
    case "working":
      bones.head = addRotation(bones.head, { x: 0.2 });
      bones.spine = addRotation(bones.spine, { x: 0.04 });
      break;
    case "waiting":
      bones.spine = addRotation(bones.spine, { x: 0.06 });
      bones.head = addRotation(bones.head, { z: -0.1 });
      break;
    case "done": {
      // Two quick nods that fade out over about a second and a half.
      const nod = 0.16 * Math.sin(input.moodElapsed * 11) * Math.exp(-input.moodElapsed * 2);
      bones.head = addRotation(bones.head, { x: Math.max(0, nod) });
      break;
    }
    case "greeting":
      bones.head = addRotation(bones.head, { z: 0.12 });
      break;
    case "idle":
      break;
  }
  applyMoodVariant(bones, input.mood, input.variant ?? 0, input.moodElapsed);
  if (input.fidget != null) {
    applyFidget(bones, input.fidget);
  }

  if (input.touch != null) {
    applyTouchGesture(bones, input.touch);
  }
  if (input.command != null) {
    applyCommandPose(bones, input.command.pose, input.command.elapsed);
  }
  return { bones, hipsOffsetY: 0 };
}
