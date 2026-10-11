import type { TouchKind } from "./touch-reactions.js";
import type { TouchZone } from "./touch-zones.js";

export interface GestureTarget {
  zoneAt(clientX: number, clientY: number): TouchZone | null;
  touch(clientX: number, clientY: number, kind: TouchKind): void;
  beginDrag(): void;
  /** Screen offset since the press, for moving the window. */
  drag(dx: number, dy: number): void;
}

/** Movement under this many pixels still counts as a click: hands shake. */
const clickSlop = 6;
/** A press held this long without moving is a hold. */
const holdMs = 600;
/** Petting fires a reaction every this many pixels of stroking. */
const strokeStep = 140;

/**
 * Turns presses on 2B into touches or window drags. A quick click touches her; holding still
 * holds; dragging across her head or hair pets her; dragging anywhere else moves the window.
 */
export class PointerGestures {
  private press: {
    id: number;
    clientX: number;
    clientY: number;
    screenX: number;
    screenY: number;
    zone: TouchZone | null;
    moved: boolean;
    held: boolean;
    dragging: boolean;
    stroked: number;
    lastX: number;
    lastY: number;
  } | null = null;
  private holdTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly root: HTMLElement,
    private readonly target: GestureTarget,
  ) {}

  start(): void {
    this.root.addEventListener("pointerdown", (event) => this.down(event));
    this.root.addEventListener("pointermove", (event) => this.move(event));
    this.root.addEventListener("pointerup", (event) => this.up(event));
    this.root.addEventListener("pointercancel", () => this.cancel());
  }

  private down(event: PointerEvent): void {
    // Buttons and panels keep their own clicks.
    if (event.button !== 0 || (event.target as Element).closest("button, a, input, .panel") !== null) {
      return;
    }
    this.root.setPointerCapture(event.pointerId);
    this.press = {
      id: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      screenX: event.screenX,
      screenY: event.screenY,
      zone: this.target.zoneAt(event.clientX, event.clientY),
      moved: false,
      held: false,
      dragging: false,
      stroked: 0,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    clearTimeout(this.holdTimer);
    this.holdTimer = setTimeout(() => {
      const press = this.press;
      if (press !== null && !press.moved && press.zone !== null) {
        press.held = true;
        this.target.touch(press.clientX, press.clientY, "hold");
      }
    }, holdMs);
  }

  private move(event: PointerEvent): void {
    const press = this.press;
    if (press === null || event.pointerId !== press.id) {
      return;
    }
    if (!press.moved && Math.hypot(event.clientX - press.clientX, event.clientY - press.clientY) > clickSlop) {
      press.moved = true;
      clearTimeout(this.holdTimer);
    }
    if (!press.moved) {
      return;
    }
    if (press.zone === "head" || press.zone === "hair") {
      press.stroked += Math.hypot(event.clientX - press.lastX, event.clientY - press.lastY);
      press.lastX = event.clientX;
      press.lastY = event.clientY;
      if (press.stroked >= strokeStep) {
        press.stroked = 0;
        this.target.touch(event.clientX, event.clientY, "stroke");
      }
      return;
    }
    if (!press.dragging) {
      press.dragging = true;
      this.target.beginDrag();
    }
    this.target.drag(event.screenX - press.screenX, event.screenY - press.screenY);
  }

  private up(event: PointerEvent): void {
    const press = this.press;
    if (press === null || event.pointerId !== press.id) {
      return;
    }
    clearTimeout(this.holdTimer);
    if (!press.moved && !press.held && press.zone !== null) {
      this.target.touch(press.clientX, press.clientY, "tap");
    }
    this.press = null;
  }

  private cancel(): void {
    clearTimeout(this.holdTimer);
    this.press = null;
  }
}
