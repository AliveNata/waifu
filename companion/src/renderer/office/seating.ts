/**
 * Leg measurements of one avatar in world meters, taken in its standing rest
 * pose. Seated poses are fitted per seat from these, so a chibi with short legs
 * dangles its feet from a stool instead of pushing them through the floor, and
 * one with long legs raises its knees on a low beanbag instead of sinking into it.
 */
export interface LegMetrics {
  /** Hips bone height above the soles. */
  hipsHeight: number;
  /** How far the thigh joints sit below the hips bone. */
  thighJointDrop: number;
  /** Hip joint to knee. */
  thigh: number;
  /** Knee to sole, with the foot flat. */
  shin: number;
  /** Pose offsets live in the model's own units; this converts world meters to them. */
  poseUnitsPerMeter: number;
}

export interface SeatFit {
  /** How far to lower the hips, in pose units. Negative raises them, for seats above the chibi's hips. */
  hipsDrop: number;
  /** Extra thigh pitch above horizontal, in radians, raising the knees on low seats. */
  thighLift: number;
}

/** Half the thickness of a chibi thigh: the thigh joint rests this far above the cushion. */
export const thighRadius = 0.035;
/** Knees higher than this look like folding in half; feet can lift a little off the floor instead. */
const maxThighLift = 0.7;

export function fitSeat(legs: LegMetrics, seatHeight: number): SeatFit {
  const thighJointY = seatHeight + thighRadius;
  // With the shin vertical, the sole sits at thighJointY + thigh * sin(lift) - shin. Solve for sole = 0.
  const sine = (legs.shin - thighJointY) / legs.thigh;
  const thighLift = Math.min(maxThighLift, Math.asin(Math.min(1, Math.max(0, sine))));
  const seatedHipsY = thighJointY + legs.thighJointDrop;
  return {
    hipsDrop: (legs.hipsHeight - seatedHipsY) * legs.poseUnitsPerMeter,
    thighLift,
  };
}
