import type { MemberId } from "../../shared/team.js";

/** Multipliers on the shared walk cycle, so each member is recognizable by how they move. */
export interface WalkStyle {
  stride: number;
  armSwing: number;
  bounce: number;
  /** Side to side sway of the hips. */
  sway: number;
  /** Forward lean of the spine, in radians. */
  lean: number;
}

export const walkStyles: Record<MemberId, WalkStyle> = {
  // Composed and even.
  twob: { stride: 1, armSwing: 0.7, bounce: 0.7, sway: 0.8, lean: 0.03 },
  // Skippy, arms all over the place.
  chizuru: { stride: 1, armSwing: 1.4, bounce: 1.7, sway: 1.2, lean: 0.02 },
  // Unhurried, a model's sway, arms close.
  rias: { stride: 0.95, armSwing: 0.6, bounce: 0.6, sway: 1.6, lean: -0.02 },
  // Brisk and purposeful.
  asuna: { stride: 1.1, armSwing: 1.1, bounce: 1, sway: 0.9, lean: 0.05 },
  // Tired programmer slouch.
  kobayashi: { stride: 0.9, armSwing: 0.5, bounce: 0.6, sway: 0.7, lean: 0.12 },
  // Light, quiet steps.
  yor: { stride: 0.95, armSwing: 0.6, bounce: 0.5, sway: 0.8, lean: 0.03 },
  // Marching.
  erza: { stride: 1.2, armSwing: 1.3, bounce: 0.8, sway: 0.5, lean: 0 },
  // Bouncy, always on camera.
  ruby: { stride: 1.05, armSwing: 1.2, bounce: 1.5, sway: 1.4, lean: 0 },
  // Quick and organized, always on her way to the next thing.
  arisu: { stride: 1.1, armSwing: 1, bounce: 0.9, sway: 0.9, lean: 0.04 },
  // Steady and upright.
  komachi: { stride: 1, armSwing: 0.8, bounce: 0.7, sway: 0.8, lean: 0.02 },
  // Light on her feet and watchful.
  miruku: { stride: 0.95, armSwing: 0.7, bounce: 0.9, sway: 1, lean: 0.03 },
  // Relaxed and a little dreamy.
  huagua: { stride: 0.9, armSwing: 0.9, bounce: 1.1, sway: 1.2, lean: 0 },
};

/** Something done on the way, on top of the walk. */
export type WalkGimmick = "look-around" | "phone" | "stretch" | "wave";

export interface ActiveGimmick {
  kind: WalkGimmick;
  /** Seconds since it started. */
  elapsed: number;
  duration: number;
}

const waveSeconds = 1.8;

/**
 * Picks the little things a member does while walking: looking around, checking the phone, a
 * quick stretch. A wave at a passing teammate interrupts any of them. `random` is injectable so
 * tests can pin the choices.
 */
export class WalkHabits {
  private current: { kind: WalkGimmick; startedAt: number; duration: number } | null = null;
  private nextAt: number;

  constructor(
    now: number,
    private readonly random: () => number = Math.random,
  ) {
    this.nextAt = now + this.gap();
  }

  /** `carrying`: a mug in the right hand rules out the phone and the stretch. */
  update(now: number, walking: boolean, carrying: boolean): ActiveGimmick | null {
    if (!walking) {
      this.current = null;
      return null;
    }
    if (this.current !== null && now >= this.current.startedAt + this.current.duration) {
      this.current = null;
      this.nextAt = now + this.gap();
    }
    if (this.current === null && now >= this.nextAt) {
      const kinds: WalkGimmick[] = carrying ? ["look-around"] : ["look-around", "look-around", "phone", "stretch"];
      const kind = kinds[Math.floor(this.random() * kinds.length) % kinds.length] ?? "look-around";
      const duration = kind === "stretch" ? 1.6 : 2 + this.random() * 2;
      this.current = { kind, startedAt: now, duration };
    }
    if (this.current === null) {
      return null;
    }
    return { kind: this.current.kind, elapsed: now - this.current.startedAt, duration: this.current.duration };
  }

  wave(now: number): void {
    this.current = { kind: "wave", startedAt: now, duration: waveSeconds };
  }

  private gap(): number {
    return 5 + this.random() * 9;
  }
}
