import type { VRM } from "@pixiv/three-vrm";

/** Spring bones overshoot and fling hair outward with large time steps, which happen whenever the frame rate drops. */
const maxSpringStepSeconds = 1 / 40;
/**
 * At most this many spring steps per frame. Splitting a slow frame into more steps makes it
 * slower still, and the next frame slower again; past this the hair simply moves a little slower
 * than real time for that frame, which nobody sees at a low frame rate.
 */
const maxSpringSteps = 2;

/** Substeps for a frame of `deltaSeconds`: how many, and how long each. */
export function springSteps(deltaSeconds: number): { count: number; seconds: number } {
  const count = Math.max(1, Math.min(maxSpringSteps, Math.ceil(deltaSeconds / maxSpringStepSeconds - 1e-9)));
  return { count, seconds: Math.min(maxSpringStepSeconds, deltaSeconds / count) };
}

/** vrm.update() split into small steps so hair and skirts stay stable on slow machines. */
export function updateVrmStable(vrm: VRM, deltaSeconds: number): void {
  const { count, seconds } = springSteps(deltaSeconds);
  for (let step = 0; step < count; step++) {
    vrm.update(seconds);
  }
}
