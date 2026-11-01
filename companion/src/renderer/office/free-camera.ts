import { Euler, type PerspectiveCamera } from "three";

/** Where the free camera is and where it looks: yaw turns about the vertical, pitch tilts up and down. */
export interface FreeView {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

/** Keys held this frame: -1, 0 or 1 along each axis, and whether to go faster. */
export interface FreeInput {
  forward: number;
  right: number;
  up: number;
  fast: boolean;
}

export interface FreeBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

/** Meters per second: an unhurried walk across a room about 17 m long. */
export const freeSpeed = 2.2;
export const fastMultiplier = 2.5;
/** Short of straight up or down, where the view would flip over. */
export const maxPitch = 1.45;
/** Radians per pixel of mouse drag. */
export const lookSensitivity = 0.0035;

/**
 * One step of free flight. Forward and sideways stay level, like walking with the head turned,
 * so looking down at the floor does not drive the camera into it; Q and E go straight up and down.
 */
export function stepFreeView(view: FreeView, input: FreeInput, delta: number, bounds: FreeBounds): FreeView {
  const speed = freeSpeed * (input.fast ? fastMultiplier : 1) * delta;
  // The camera looks along -z when yaw is 0.
  const forwardX = -Math.sin(view.yaw);
  const forwardZ = -Math.cos(view.yaw);
  const rightX = Math.cos(view.yaw);
  const rightZ = -Math.sin(view.yaw);
  const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
  return {
    x: clamp(view.x + (forwardX * input.forward + rightX * input.right) * speed, bounds.minX, bounds.maxX),
    y: clamp(view.y + input.up * speed, bounds.minY, bounds.maxY),
    z: clamp(view.z + (forwardZ * input.forward + rightZ * input.right) * speed, bounds.minZ, bounds.maxZ),
    yaw: view.yaw,
    pitch: view.pitch,
  };
}

/** Turns the view by a mouse drag of (dx, dy) pixels: right turns right, up looks up. */
export function lookFreeView(view: FreeView, dx: number, dy: number): FreeView {
  return {
    ...view,
    yaw: view.yaw - dx * lookSensitivity,
    pitch: Math.min(maxPitch, Math.max(-maxPitch, view.pitch - dy * lookSensitivity)),
  };
}

const keyAxes: Record<string, Partial<FreeInput>> = {
  KeyW: { forward: 1 },
  ArrowUp: { forward: 1 },
  KeyS: { forward: -1 },
  ArrowDown: { forward: -1 },
  KeyD: { right: 1 },
  ArrowRight: { right: 1 },
  KeyA: { right: -1 },
  ArrowLeft: { right: -1 },
  KeyE: { up: 1 },
  KeyQ: { up: -1 },
};

/** Typing in a field must never move the camera. */
function typingIn(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/**
 * Walk-and-look camera for the office: WASD or the arrows to move, Q and E to go down and up,
 * Shift to hurry, and a mouse drag to look around. It only listens while switched on.
 */
export class FreeCamera {
  private view: FreeView = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  private readonly held = new Set<string>();
  private fast = false;
  private drag: { x: number; y: number } | null = null;
  private on = false;

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly canvas: HTMLCanvasElement,
    private readonly bounds: FreeBounds,
  ) {
    window.addEventListener("keydown", (event) => {
      if (!this.on || typingIn(event.target) || document.querySelector("dialog[open]") !== null) {
        return;
      }
      this.fast = event.shiftKey;
      if (event.code in keyAxes) {
        this.held.add(event.code);
        event.preventDefault();
      }
    });
    window.addEventListener("keyup", (event) => {
      this.fast = event.shiftKey;
      this.held.delete(event.code);
    });
    // Letting go of keys while the window is in the background must not leave the camera drifting.
    window.addEventListener("blur", () => this.held.clear());
    canvas.addEventListener("pointerdown", (event) => {
      if (this.on && event.button === 0) {
        this.drag = { x: event.clientX, y: event.clientY };
      }
    });
    window.addEventListener("pointermove", (event) => {
      if (!this.on || this.drag === null) {
        return;
      }
      this.view = lookFreeView(this.view, event.clientX - this.drag.x, event.clientY - this.drag.y);
      this.drag = { x: event.clientX, y: event.clientY };
    });
    window.addEventListener("pointerup", () => {
      this.drag = null;
    });
  }

  get active(): boolean {
    return this.on;
  }

  /** Takes over from where the camera is now, looking the same way. */
  enable(): void {
    const euler = new Euler().setFromQuaternion(this.camera.quaternion, "YXZ");
    this.view = {
      x: this.camera.position.x,
      y: this.camera.position.y,
      z: this.camera.position.z,
      yaw: euler.y,
      pitch: Math.min(maxPitch, Math.max(-maxPitch, euler.x)),
    };
    this.held.clear();
    this.on = true;
    this.canvas.dataset.camera = "free";
  }

  disable(): void {
    this.on = false;
    this.held.clear();
    this.drag = null;
    delete this.canvas.dataset.camera;
  }

  update(delta: number): void {
    if (!this.on) {
      return;
    }
    const input: FreeInput = { forward: 0, right: 0, up: 0, fast: this.fast };
    for (const code of this.held) {
      const axis = keyAxes[code];
      input.forward += axis?.forward ?? 0;
      input.right += axis?.right ?? 0;
      input.up += axis?.up ?? 0;
    }
    this.view = stepFreeView(this.view, input, delta, this.bounds);
    this.camera.position.set(this.view.x, this.view.y, this.view.z);
    this.camera.rotation.set(this.view.pitch, this.view.yaw, 0, "YXZ");
  }
}
