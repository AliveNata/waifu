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

/** "24 fps · 41 ms · 1480 draw", short enough for a corner chip. */
export function frameLabel(fps: number, frameMs: number, drawCalls: number): string {
  return `${Math.round(fps)} fps · ${Math.round(frameMs)} ms · ${drawCalls} draw`;
}
