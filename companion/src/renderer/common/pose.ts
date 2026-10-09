import type { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";

export interface BoneRotation {
  x: number;
  y: number;
  z: number;
}

export type PoseBones = Partial<Record<VRMHumanBoneName, BoneRotation>>;

export interface Pose {
  bones: PoseBones;
  /** Vertical offset of the hips in meters (sitting, bouncing). */
  hipsOffsetY: number;
}

/**
 * Axis conventions for three-vrm normalized bones (model faces +Z, T-pose rest):
 * - upper arm z: left arm down is negative, right arm down is positive
 * - head/spine x: positive bends forward (look down, lean in)
 * - head y: positive turns toward the character's left (screen right)
 * - upper leg x: negative swings the leg forward
 */
export const armsRelaxed: PoseBones = {
  leftUpperArm: { x: 0, y: 0, z: -1.22 },
  rightUpperArm: { x: 0, y: 0, z: 1.22 },
  leftLowerArm: { x: 0, y: -0.25, z: 0 },
  rightLowerArm: { x: 0, y: 0.25, z: 0 },
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function addRotation(base: BoneRotation | undefined, delta: Partial<BoneRotation>): BoneRotation {
  return {
    x: (base?.x ?? 0) + (delta.x ?? 0),
    y: (base?.y ?? 0) + (delta.y ?? 0),
    z: (base?.z ?? 0) + (delta.z ?? 0),
  };
}

/**
 * Applies a pose with exponential smoothing so mood changes blend instead of
 * snapping. The smoothed values persist between frames until reset().
 */
export class PoseApplier {
  private readonly smoothed = new Map<VRMHumanBoneName, BoneRotation>();
  private smoothedHipsOffset = 0;
  private hipsRestY: number | null = null;

  constructor(private readonly responsiveness = 8) {}

  reset(): void {
    this.smoothed.clear();
    this.smoothedHipsOffset = 0;
    this.hipsRestY = null;
  }

  apply(vrm: VRM, pose: Pose, deltaSeconds: number): void {
    const blend = 1 - Math.exp(-deltaSeconds * this.responsiveness);
    const touched = new Set<VRMHumanBoneName>([
      ...this.smoothed.keys(),
      ...(Object.keys(pose.bones) as VRMHumanBoneName[]),
    ]);

    for (const boneName of touched) {
      const target = pose.bones[boneName] ?? { x: 0, y: 0, z: 0 };
      const current = this.smoothed.get(boneName) ?? { x: 0, y: 0, z: 0 };
      const next = {
        x: current.x + (target.x - current.x) * blend,
        y: current.y + (target.y - current.y) * blend,
        z: current.z + (target.z - current.z) * blend,
      };
      this.smoothed.set(boneName, next);
      vrm.humanoid.getNormalizedBoneNode(boneName)?.rotation.set(next.x, next.y, next.z);
    }

    const hips = vrm.humanoid.getNormalizedBoneNode("hips");
    if (hips !== null) {
      this.hipsRestY ??= hips.position.y;
      this.smoothedHipsOffset += (pose.hipsOffsetY - this.smoothedHipsOffset) * blend;
      hips.position.y = this.hipsRestY + this.smoothedHipsOffset;
    }
  }
}
