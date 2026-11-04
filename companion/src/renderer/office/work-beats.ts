/**
 * Small things people do at their desk in the middle of a stretch of work: a moment with a hand
 * on the chin, leaning in to read something, a glance at the side screen, a stretch, and a little
 * fist pump when the work is done. Typing stops while a beat needs the hands.
 */

export type WorkBeat = "think" | "lean" | "glance" | "stretch" | "fist";

export const workBeatSeconds: Record<WorkBeat, number> = {
  think: 3.2,
  lean: 2.6,
  glance: 2.2,
  stretch: 2.8,
  fist: 1.8,
};

export interface ActiveWorkBeat {
  kind: WorkBeat;
  /** Seconds into the beat. */
  elapsed: number;
  /** Which way a glance goes: 1 to the member's left, -1 to the right. */
  side: 1 | -1;
}

/** The beats that come up on their own; the fist pump only follows finished work. */
const everyday: readonly WorkBeat[] = ["think", "lean", "glance", "stretch"];

/** Seconds of plain typing between two beats. */
const gap: readonly [number, number] = [9, 16];
/** Seconds to ease into a beat and back out of it. */
const easeSeconds = 0.35;

/** Which hands a beat takes off the keyboard. */
export function beatHands(kind: WorkBeat): { left: boolean; right: boolean } {
  switch (kind) {
    case "think":
    case "fist":
      return { left: false, right: true };
    case "stretch":
      return { left: true, right: true };
    case "lean":
    case "glance":
      return { left: false, right: false };
  }
}

/** 0..1: eased in at the start of a beat, held, eased out at its end. */
export function beatEnvelope(beat: ActiveWorkBeat): number {
  const length = workBeatSeconds[beat.kind];
  if (beat.elapsed <= 0 || beat.elapsed >= length) {
    return 0;
  }
  const k = Math.min(1, beat.elapsed / easeSeconds, (length - beat.elapsed) / easeSeconds);
  return k * k * (3 - 2 * k);
}

export class WorkBeats {
  private current: ActiveWorkBeat | null = null;
  private last: WorkBeat | null = null;
  private wait: number;
  private cheer = false;

  constructor(private readonly random: () => number) {
    this.wait = this.gapLength();
  }

  /** Work just finished at the desk: a fist pump comes next, whatever else was due. */
  celebrate(): void {
    this.cheer = true;
  }

  /**
   * Advances by `delta` seconds. `atDesk` while the member is at their own desk; away from it
   * nothing runs and nothing waits, so a beat never fires the moment they sit back down.
   * `quiet` while they do something else there (stretching after the work, say): the fist pump
   * still comes, but no everyday beat starts over the top of it.
   */
  update(delta: number, atDesk: boolean, quiet = false): ActiveWorkBeat | null {
    if (!atDesk) {
      this.current = null;
      this.cheer = false;
      return null;
    }
    if (this.current !== null) {
      this.current.elapsed += delta;
      if (this.current.elapsed < workBeatSeconds[this.current.kind]) {
        return this.current;
      }
      this.current = null;
      this.wait = this.gapLength();
    }
    if (this.cheer) {
      this.cheer = false;
      return this.start("fist");
    }
    if (quiet) {
      return null;
    }
    this.wait -= delta;
    if (this.wait > 0) {
      return null;
    }
    const choices = everyday.filter((kind) => kind !== this.last);
    const kind = choices[Math.min(choices.length - 1, Math.floor(this.random() * choices.length))] ?? "think";
    return this.start(kind);
  }

  private start(kind: WorkBeat): ActiveWorkBeat {
    this.last = kind;
    this.current = { kind, elapsed: 0, side: this.random() < 0.5 ? 1 : -1 };
    return this.current;
  }

  private gapLength(): number {
    return gap[0] + this.random() * (gap[1] - gap[0]);
  }
}
