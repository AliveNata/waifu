import type { PerspectiveCamera } from "three";
import type { Point } from "./office-plan.js";

/**
 * Walking the office as Alyx, the CEO: eyes a head above the team, WASD to walk, Shift to
 * hurry, the mouse (locked to the page) to look around, E to interact. Bumps into furniture,
 * walls and people instead of passing through them, sliding along whatever is in the way.
 */
export interface WalkerView {
  x: number;
  z: number;
  /** 0 looks along -z, the way the camera looks by default. */
  yaw: number;
  pitch: number;
}

export interface WalkInput {
  forward: number;
  right: number;
  fast: boolean;
}

/** A head above the team, so he looks down at them a little: he is the tall one. */
export const eyeHeight = 1.28;
/** Meters per second. */
export const strollSpeed = 1.5;
export const hurryMultiplier = 1.8;
/** Short of straight up or down. */
export const maxLookPitch = 1.3;
/** Radians per pixel of mouse travel while the pointer is locked. */
export const lockedLookSensitivity = 0.0022;
/** A natural first-person field of view; the room view's narrow lens would feel like binoculars. */
export const firstPersonFov = 70;
/**
 * Mouse travel bigger than this in one event is dropped: right after the pointer locks, Chrome can
 * report one huge jump that would spin the view to the ceiling.
 */
export const maxLookJump = 250;
/** And for a moment after locking, nothing turns the view at all. */
const settleAfterLockMs = 150;

/**
 * Held in one place: sitting down, or standing at his end of the ping-pong table. He can still
 * look around; a walking key gets him up and back to `standAt`.
 */
export interface Anchor {
  spot: Point;
  eye: number;
  standAt: Point;
  onLeave: () => void;
}

/** Where he walks in: just inside the entry door, facing into the room. */
export const startView: WalkerView = { x: 9.35, z: -0.45, yaw: Math.PI / 2, pitch: -0.12 };

/**
 * One step of walking. The step is tried whole, then along each axis alone, so walking into a
 * desk at an angle slides along it instead of stopping dead.
 */
export function stepWalker(
  view: WalkerView,
  input: WalkInput,
  delta: number,
  free: (point: Point) => boolean,
): WalkerView {
  const length = Math.hypot(input.forward, input.right);
  if (length === 0) {
    return view;
  }
  // Diagonals are no faster than straight ahead.
  const forward = input.forward / length;
  const right = input.right / length;
  const distance = strollSpeed * (input.fast ? hurryMultiplier : 1) * delta;
  const dx = (-Math.sin(view.yaw) * forward + Math.cos(view.yaw) * right) * distance;
  const dz = (-Math.cos(view.yaw) * forward - Math.sin(view.yaw) * right) * distance;
  for (const [x, z] of [
    [view.x + dx, view.z + dz],
    [view.x + dx, view.z],
    [view.x, view.z + dz],
  ] as const) {
    if (free({ x, z })) {
      return { ...view, x, z };
    }
  }
  return view;
}

/** Turns the view by mouse travel of (dx, dy) pixels: right turns right, up looks up. */
export function lookWalker(view: WalkerView, dx: number, dy: number): WalkerView {
  return {
    ...view,
    yaw: view.yaw - dx * lockedLookSensitivity,
    pitch: Math.min(maxLookPitch, Math.max(-maxLookPitch, view.pitch - dy * lockedLookSensitivity)),
  };
}

const keyAxes: Record<string, Partial<WalkInput>> = {
  KeyW: { forward: 1 },
  ArrowUp: { forward: 1 },
  KeyS: { forward: -1 },
  ArrowDown: { forward: -1 },
  KeyD: { right: 1 },
  ArrowRight: { right: 1 },
  KeyA: { right: -1 },
  ArrowLeft: { right: -1 },
};

/** Typing in a field must never move him. */
function typingIn(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/**
 * The first-person controls. The mouse is locked to the page while walking; losing the lock
 * (Esc, switching windows) pauses until the page is clicked again, and the page decides whether
 * a second Esc leaves.
 */
export class FirstPerson {
  private view: WalkerView = { ...startView };
  private readonly held = new Set<string>();
  private fast = false;
  private on = false;
  /** Meters walked, for the bob of the hands. */
  private walked = 0;
  private speed = 0;
  private lockedAt = 0;
  private anchor: Anchor | null = null;

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly canvas: HTMLCanvasElement,
    private readonly free: (point: Point) => boolean,
    private readonly interact: () => void,
  ) {
    window.addEventListener("keydown", (event) => {
      if (!this.on || typingIn(event.target) || document.querySelector("dialog[open]") !== null) {
        return;
      }
      this.fast = event.shiftKey;
      if (event.code in keyAxes) {
        this.held.add(event.code);
        event.preventDefault();
      } else if (event.code === "KeyE" && !event.repeat && this.locked) {
        event.preventDefault();
        this.interact();
      }
    });
    window.addEventListener("keyup", (event) => {
      this.fast = event.shiftKey;
      this.held.delete(event.code);
    });
    // Keys let go of while the window is in the background must not leave him walking.
    window.addEventListener("blur", () => this.held.clear());
    canvas.addEventListener("click", () => {
      if (this.on && !this.locked) {
        this.lock();
      }
    });
    document.addEventListener("pointerlockchange", () => {
      if (this.locked) {
        this.lockedAt = performance.now();
      } else {
        this.held.clear();
      }
      canvas.dataset.firstPerson = this.on ? (this.locked ? "walking" : "paused") : "";
    });
    document.addEventListener("mousemove", (event) => {
      const jump = Math.max(Math.abs(event.movementX), Math.abs(event.movementY));
      if (this.on && this.locked && jump <= maxLookJump && performance.now() - this.lockedAt > settleAfterLockMs) {
        this.view = lookWalker(this.view, event.movementX, event.movementY);
      }
    });
  }

  get active(): boolean {
    return this.on;
  }

  /** True while the mouse is locked to the office: walking, not paused. */
  get locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  /** Where he stands, on the floor. */
  get position(): Point {
    return { x: this.view.x, z: this.view.z };
  }

  /** Meters walked so far and how fast right now, for the hands. */
  get stride(): { walked: number; speed: number } {
    return { walked: this.walked, speed: this.speed };
  }

  /** Sits him down (or holds him at a spot), turned to `yaw`. */
  anchorAt(anchor: Anchor, yaw: number): void {
    this.anchor = anchor;
    this.view = { ...this.view, x: anchor.spot.x, z: anchor.spot.z, yaw, pitch: -0.15 };
  }

  /** Gets him up and back on his feet beside wherever he was. */
  release(): void {
    const anchor = this.anchor;
    if (anchor === null) {
      return;
    }
    this.anchor = null;
    this.view = { ...this.view, x: anchor.standAt.x, z: anchor.standAt.z };
    anchor.onLeave();
  }

  get anchored(): boolean {
    return this.anchor !== null;
  }

  /** Steps in where he last stood, or at the door the first time; has to come from a click. */
  enable(): void {
    this.on = true;
    this.held.clear();
    // Back where he stood, but looking level again.
    this.view = this.free(this.position) ? { ...this.view, pitch: startView.pitch } : { ...startView };
    this.lock();
    this.canvas.dataset.camera = "first-person";
  }

  disable(): void {
    this.release();
    this.on = false;
    this.held.clear();
    if (this.locked) {
      document.exitPointerLock();
    }
    delete this.canvas.dataset.camera;
    this.canvas.dataset.firstPerson = "";
  }

  private lock(): void {
    // Pointer lock can be refused (no user gesture, or the page lost focus); the page stays
    // paused and the next click asks again.
    const request = this.canvas.requestPointerLock() as Promise<void> | undefined;
    request?.catch((error: unknown) => {
      console.warn("[office] pointer lock was refused; click the office to try again", error);
    });
  }

  update(delta: number): void {
    if (!this.on) {
      return;
    }
    const input: WalkInput = { forward: 0, right: 0, fast: this.fast };
    if (this.locked) {
      for (const code of this.held) {
        const axis = keyAxes[code];
        input.forward += axis?.forward ?? 0;
        input.right += axis?.right ?? 0;
      }
    }
    if (this.anchor !== null && (input.forward !== 0 || input.right !== 0)) {
      this.release();
    }
    const anchor = this.anchor;
    if (anchor !== null) {
      this.speed = 0;
      this.camera.position.set(anchor.spot.x, anchor.eye, anchor.spot.z);
      this.camera.rotation.set(this.view.pitch, this.view.yaw, 0, "YXZ");
      return;
    }
    const before = this.position;
    this.view = stepWalker(this.view, input, delta, this.free);
    const moved = Math.hypot(this.view.x - before.x, this.view.z - before.z);
    this.walked += moved;
    this.speed = delta > 0 ? moved / delta : 0;
    this.camera.position.set(this.view.x, eyeHeight, this.view.z);
    this.camera.rotation.set(this.view.pitch, this.view.yaw, 0, "YXZ");
  }
}
