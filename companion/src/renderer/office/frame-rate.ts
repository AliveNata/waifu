/**
 * Frames per second and the average time per frame, over the last half second. Averaging keeps
 * the numbers readable; a single slow frame still shows as a dip in the next reading.
 */
export class FrameRate {
  private readonly stamps: number[] = [];

  constructor(private readonly windowMs = 500) {}

  /** Call once per rendered frame with a monotonic time in milliseconds. */
  tick(nowMs: number): void {
    this.stamps.push(nowMs);
    while (this.stamps.length > 2 && nowMs - (this.stamps[0] ?? nowMs) > this.windowMs) {
      this.stamps.shift();
    }
  }

  /** Frames per second over the window, or 0 before there are two frames to compare. */
  fps(): number {
    const span = this.span();
    return span <= 0 ? 0 : ((this.stamps.length - 1) * 1000) / span;
  }

  /** Average milliseconds between frames over the window, or 0 before there are two frames. */
  frameMs(): number {
    const span = this.span();
    return span <= 0 ? 0 : span / (this.stamps.length - 1);
  }

  private span(): number {
    const first = this.stamps[0];
    const last = this.stamps[this.stamps.length - 1];
    return first === undefined || last === undefined ? 0 : last - first;
  }
}

/**
 * "24 fps · 41 ms · cpu 12 ms · 1480 draw", short enough for a corner chip, with the graphics
 * chip on a second line when known. Frame time far above the CPU's share means the GPU is what
 * holds the frame back; close to it, the scripts (animation, hair physics) are.
 */
export function frameLabel(fps: number, frameMs: number, drawCalls: number, cpuMs: number, gpu: string | null): string {
  const numbers = `${Math.round(fps)} fps · ${Math.round(frameMs)} ms · cpu ${Math.round(cpuMs)} ms · ${drawCalls} draw`;
  return gpu === null ? numbers : `${numbers}\n${gpu}`;
}

/**
 * The graphics chip's name without the browser's wrapping: "ANGLE (Intel, Intel(R) UHD Graphics
 * 620 Direct3D11 vs_5_0 ps_5_0, D3D11)" reads as "Intel(R) UHD Graphics 620".
 */
export function gpuLabel(renderer: string): string {
  const angle = /^ANGLE \((.*)\)$/.exec(renderer.trim());
  const inner = angle?.[1] ?? renderer.trim();
  const parts = inner.split(", ");
  const model = (angle !== null && parts.length >= 2 ? parts[1] : inner) ?? inner;
  return model.replace(/\s+(Direct3D|vs_|ps_|OpenGL|\(0x).*$/, "").trim();
}

/**
 * Frame pacing for a cap: whether to draw at `now` (ms) and when the next frame is due. Due times
 * step by the interval so a 144 Hz screen still averages the cap; after a slow frame they restart
 * from `now` instead of trying to catch up in a burst. A cap of 0 draws every frame.
 */
export function paceFrame(now: number, dueAt: number, cap: number): { draw: boolean; dueAt: number } {
  if (cap <= 0) {
    return { draw: true, dueAt: now };
  }
  // A couple of milliseconds early still counts: display ticks jitter around the interval.
  if (now < dueAt - 2) {
    return { draw: false, dueAt };
  }
  const interval = 1000 / cap;
  // Measured from this frame too, less a little for display jitter, so a late frame is not followed at once by another.
  return { draw: true, dueAt: Math.max(dueAt + interval, now + interval - 4) };
}
