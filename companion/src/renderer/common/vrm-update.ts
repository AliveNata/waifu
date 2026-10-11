import type { VRM } from "@pixiv/three-vrm";

/** Spring bones overshoot and fling hair outward with large time steps, which happen whenever the frame rate drops. */
const maxSpringStepSeconds = 1 / 40;

/** vrm.update() split into small steps so hair and skirts stay stable on slow machines. */
export function updateVrmStable(vrm: VRM, deltaSeconds: number): void {
  let remaining = deltaSeconds;
  do {
    const step = Math.min(maxSpringStepSeconds, remaining);
    vrm.update(step);
    remaining -= step;
  } while (remaining > 1e-6);
}
