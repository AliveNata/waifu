import type { Gesture } from "../common/conversation.js";
import { addRotation, armsRelaxed, type Pose, type PoseBones } from "../common/pose.js";

export interface SpeakerPoseInput {
  gesture: Gesture;
  /** Seconds since the current line started. Gestures play once at the start of a line. */
  lineElapsed: number;
  time: number;
  talking: boolean;
}

/** Close-up pose for whoever is speaking. Gestures settle back to a relaxed stance after a couple of seconds. */
export function speakerPose(input: SpeakerPoseInput): Pose {
  const breath = Math.sin((input.time * 2 * Math.PI) / 4.2);
  const t = input.lineElapsed;
  const bones: PoseBones = {
    ...armsRelaxed,
    spine: { x: 0.015 * breath, y: 0, z: 0 },
    chest: { x: 0.02 * breath, y: 0, z: 0 },
    head: {
      // Small bobs while talking read as emphasis without looking mechanical.
      x: input.talking ? 0.035 * Math.sin(input.time * 7) : 0,
      y: 0.05 * Math.sin(input.time * 0.6),
      z: 0.03 * Math.sin(input.time * 0.45),
    },
  };

  switch (input.gesture) {
    case "nod": {
      const nod = 0.18 * Math.sin(t * 9) * Math.exp(-t * 1.6);
      bones.head = addRotation(bones.head, { x: Math.max(0, nod) });
      break;
    }
    case "shake": {
      // A slow, damped head shake: "not quite" rather than a hard "no".
      const shake = 0.13 * Math.sin(t * 8) * Math.exp(-t * 1.3);
      bones.head = addRotation(bones.head, { y: shake, x: 0.04 * Math.exp(-t) });
      break;
    }
    case "point": {
      // Right arm swings forward toward the viewer for the first two seconds.
      const raise = t < 2 ? Math.min(1, t * 4) : Math.max(0, 1 - (t - 2) * 2);
      bones.rightUpperArm = { x: -1.0 * raise, y: 0, z: 1.22 - 0.75 * raise };
      bones.rightLowerArm = { x: 0, y: 0.25 * raise, z: 0 };
      bones.head = addRotation(bones.head, { z: -0.08 * raise });
      break;
    }
    case "think":
      bones.rightUpperArm = { x: -0.5, y: 0, z: 1.25 };
      bones.rightLowerArm = { x: 0, y: 2.1, z: 0 };
      bones.head = addRotation(bones.head, { x: -0.08, z: 0.14 });
      break;
    case "cheer": {
      const up = t < 1.8;
      const bounce = up ? 0.1 * Math.abs(Math.sin(t * 8)) : 0;
      bones.leftUpperArm = { x: 0, y: 0, z: up ? 0.85 + bounce : -1.22 };
      bones.rightUpperArm = { x: 0, y: 0, z: up ? -0.85 - bounce : 1.22 };
      break;
    }
    case "none":
      break;
  }
  return { bones, hipsOffsetY: 0 };
}
