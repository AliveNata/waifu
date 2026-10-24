import type { TouchKind } from "./touch-reactions.js";
import type { TouchZone } from "./touch-zones.js";

/** What the pointer hand does: rest open over her, or one of the touches when clicked. */
export type HandGesture = "open" | "pat" | "flick" | "poke" | "high-five";

/** The touch that fits each part of her: a pat on the head, a flick on the face, a poke elsewhere. */
export function gestureForZone(zone: TouchZone): Exclude<HandGesture, "open"> {
  switch (zone) {
    case "head":
    case "hair":
      return "pat";
    case "forehead":
    case "nose":
    case "cheek":
      return "flick";
    case "hand":
      return "high-five";
    case "shoulder":
    case "body":
      return "poke";
  }
}

type Finger = "thumb" | "index" | "middle" | "ring" | "little";

/** One finger: how far it reaches (0 curled into the palm, 1 straight) and its tilt in degrees. */
interface FingerPose {
  reach: number;
  tilt: number;
}

/** A hand drawing: the fingers, and the point of it that sits on the pointer's tip. */
export interface HandPose {
  fingers: Record<Finger, FingerPose>;
  /** In the 64 by 64 drawing: the fingertip that touches, or the palm for a pat. */
  hotspot: readonly [number, number];
}

const spread = (reach: number, tilt: number): FingerPose => ({ reach, tilt });

/**
 * Hand drawings, a right hand seen from the palm side with the fingers up. Frames that play in
 * a row (curl then flick) are separate poses, swapped by the animation.
 */
export const handPoses: Record<HandGesture | "flick-ready", HandPose> = {
  open: {
    // All five fingers spread wide.
    fingers: {
      thumb: spread(1, -62),
      index: spread(1, -17),
      middle: spread(1, -4),
      ring: spread(1, 9),
      little: spread(1, 22),
    },
    hotspot: [32, 38],
  },
  pat: {
    // Fingers together and the hand tipped over, ready to stroke.
    fingers: {
      thumb: spread(0.8, -30),
      index: spread(1, -3),
      middle: spread(1, 0),
      ring: spread(1, 3),
      little: spread(0.9, 6),
    },
    hotspot: [32, 38],
  },
  "flick-ready": {
    // The middle finger held curled, the thumb across it holding it back.
    fingers: {
      thumb: spread(0.75, 28),
      index: spread(0.75, -8),
      middle: spread(0.1, 0),
      ring: spread(0.75, 6),
      little: spread(0.65, 12),
    },
    hotspot: [30, 26],
  },
  flick: {
    fingers: {
      thumb: spread(0.7, -40),
      index: spread(0.75, -8),
      middle: spread(1, 4),
      ring: spread(0.75, 6),
      little: spread(0.65, 12),
    },
    hotspot: [30, 12],
  },
  poke: {
    // Index out, the rest curled in.
    fingers: {
      thumb: spread(0.5, -20),
      index: spread(1, -4),
      middle: spread(0.12, 0),
      ring: spread(0.12, 4),
      little: spread(0.12, 8),
    },
    hotspot: [22, 12],
  },
  "high-five": {
    fingers: {
      thumb: spread(1, -48),
      index: spread(1, -6),
      middle: spread(1, -1),
      ring: spread(1, 4),
      little: spread(1, 9),
    },
    hotspot: [32, 36],
  },
};

/** Where each finger leaves the palm, its width, and its length when straight. */
const fingerShape: Record<Finger, { x: number; y: number; width: number; length: number }> = {
  thumb: { x: 20, y: 46, width: 9, length: 16 },
  index: { x: 22, y: 33, width: 8, length: 20 },
  middle: { x: 29.5, y: 32, width: 8, length: 22 },
  ring: { x: 37, y: 33, width: 8, length: 20 },
  little: { x: 43.5, y: 35, width: 7, length: 15 },
};

/** The hand as SVG markup: skin with a dark outline that reads on any background. */
export function handSvg(pose: HandPose): string {
  const draw = (finger: Finger): string => {
    const shape = fingerShape[finger];
    const { reach, tilt } = pose.fingers[finger];
    // A curled finger still shows its knuckle above the palm.
    const length = 5 + (shape.length - 5) * reach;
    return `<rect x="${shape.x - shape.width / 2}" y="${shape.y - length}" width="${shape.width}" height="${length + 4}" rx="${shape.width / 2}" transform="rotate(${tilt} ${shape.x} ${shape.y})"/>`;
  };
  // A thumb turned in across the palm is in front of it; turned out, it is behind.
  const thumbInFront = pose.fingers.thumb.tilt > 0;
  const behind = (["index", "middle", "ring", "little"] as const).map(draw);
  return [
    `<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">`,
    `<g fill="#ffe1cc" stroke="#3a2c3f" stroke-width="2" stroke-linejoin="round">`,
    ...(thumbInFront ? [] : [draw("thumb")]),
    ...behind,
    `<rect x="16" y="29" width="31" height="27" rx="11"/>`,
    ...(thumbInFront ? [draw("thumb")] : []),
    `</g>`,
    `</svg>`,
  ].join("");
}

/** How long a touch's animation plays before the hand goes back to resting open. */
export const gestureSeconds: Record<Exclude<HandGesture, "open">, number> = {
  pat: 1.2,
  flick: 0.6,
  poke: 0.55,
  "high-five": 0.6,
};

/** Drawn hand size on screen, in CSS pixels. */
const handPixels = 52;

/**
 * The pointer over 2B: an open hand while hovering her, which turns into the touch that fits
 * where she is clicked and plays it, then opens again. Off her, the normal pointer comes back.
 */
export class CursorHand {
  private readonly element: HTMLDivElement;
  private gesture: HandGesture = "open";
  private frame: HandGesture | "flick-ready" = "open";
  private timers: number[] = [];
  private x = 0;
  private y = 0;

  constructor(private readonly root: HTMLElement) {
    this.element = document.createElement("div");
    this.element.className = "cursor-hand";
    this.element.hidden = true;
    root.append(this.element);
    this.draw("open");
  }

  /** Over her (`zone` set) the hand shows at the pointer; elsewhere the system pointer is back. */
  hover(clientX: number, clientY: number, zone: TouchZone | null): void {
    this.x = clientX;
    this.y = clientY;
    const over = zone !== null || this.gesture !== "open";
    this.element.hidden = !over;
    this.root.classList.toggle("hand-pointer", over);
    this.place();
  }

  hide(): void {
    this.element.hidden = true;
    this.root.classList.remove("hand-pointer");
  }

  /** Plays the touch for `zone`. Stroking the head keeps the pat going for as long as it lasts. */
  act(zone: TouchZone, kind: TouchKind): void {
    const gesture = gestureForZone(zone);
    for (const timer of this.timers) {
      window.clearTimeout(timer);
    }
    this.timers = [];
    this.gesture = gesture;
    this.element.dataset.gesture = gesture;
    // Restart the CSS animation even when the same touch repeats.
    this.element.classList.remove("acting");
    void this.element.offsetWidth;
    this.element.classList.add("acting");
    if (gesture === "flick") {
      // Curl first, then let the finger go.
      this.draw("flick-ready");
      this.later(gestureSeconds.flick * 0.45, () => this.draw("flick"));
    } else {
      this.draw(gesture);
    }
    const seconds = kind === "hold" ? gestureSeconds[gesture] * 2 : gestureSeconds[gesture];
    this.later(seconds, () => {
      this.gesture = "open";
      delete this.element.dataset.gesture;
      this.element.classList.remove("acting");
      this.draw("open");
    });
  }

  private later(seconds: number, run: () => void): void {
    this.timers.push(window.setTimeout(run, seconds * 1000));
  }

  private draw(frame: HandGesture | "flick-ready"): void {
    this.frame = frame;
    this.element.innerHTML = handSvg(handPoses[frame]);
    this.place();
  }

  private place(): void {
    const [hotX, hotY] = handPoses[this.frame].hotspot;
    const scale = handPixels / 64;
    this.element.style.transform = `translate(${this.x - hotX * scale}px, ${this.y - hotY * scale}px)`;
    this.element.style.setProperty("--hot-x", `${hotX * scale}px`);
    this.element.style.setProperty("--hot-y", `${hotY * scale}px`);
  }
}
