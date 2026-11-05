import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { kitPiece } from "../scene/kit.js";

/** A real mouse at the room's 0.73 scale: about 0.05 by 0.08 m. */
const bodyHeight = 0.022;
/** Where the index fingertip rests, from the mouse's center: on the button, toward the screen. */
const grip = new Vector3(0, bodyHeight + 0.004, -0.02);
const clickDip = 0.004;
const clickSeconds = 0.12;

/**
 * A mouse beside the keyboard. While a hand is on it, it drifts in small strokes the way a cursor
 * hunts for something on screen, with a click now and then.
 */
export class DeskMouse {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly buttonMaterial: MeshStandardMaterial;
  private readonly glow: Color;
  private readonly idle: Color;
  private held = 0;
  private sinceClick = clickSeconds;
  private nextClickIn = 0.8;
  /** How strongly a click lights up: the box stand-in lights only its button, the model all over. */
  private readonly glowStrength: number;

  constructor(accent: string, base: string) {
    this.glow = new Color(accent);
    this.idle = new Color(base);
    this.buttonMaterial = new MeshStandardMaterial({ color: base, emissive: accent, emissiveIntensity: 0 });
    // The Logitech M310 model ("Logitech M310 Mouse" by Nick Scott, CC-BY-4.0) in the desk's own
    // color, its buttons toward the screen (-z). The whole shell takes the click's glow.
    const model = kitPiece("mouseM310", { width: 0.048, height: bodyHeight + 0.004, depth: 0.078 });
    if (model !== null) {
      model.rotation.y = Math.PI;
      model.traverse((part) => {
        if (part instanceof Mesh) {
          part.material = this.buttonMaterial;
        }
      });
      this.glowStrength = 0.35;
      this.body.add(model);
      this.root.add(this.body);
      return;
    }
    this.glowStrength = 1;
    const shell = new Mesh(new BoxGeometry(0.048, bodyHeight, 0.078), new MeshStandardMaterial({ color: base }));
    shell.position.y = bodyHeight / 2;
    shell.castShadow = true;
    const button = new Mesh(new BoxGeometry(0.04, 0.003, 0.026), this.buttonMaterial);
    button.position.set(0, bodyHeight + 0.0015, -0.022);
    this.body.add(shell, button);
    this.root.add(this.body);
  }

  /** `random` picks the time to the next click, so tests can pin it. */
  update(deltaSeconds: number, inHand: boolean, random: () => number = Math.random): void {
    if (inHand) {
      this.held += deltaSeconds;
      this.nextClickIn -= deltaSeconds;
      if (this.nextClickIn <= 0) {
        this.sinceClick = 0;
        this.nextClickIn = 0.5 + random() * 1.4;
      }
    }
    this.sinceClick += deltaSeconds;
    const t = this.held;
    // Two slow sines out of step: the path never quite repeats, like hunting for a button.
    this.body.position.set(0.022 * Math.sin(t * 1.3), 0, 0.016 * Math.sin(t * 0.9 + 1));
    const clicking = Math.max(0, 1 - this.sinceClick / clickSeconds);
    this.buttonMaterial.emissiveIntensity = clicking * 1.6 * this.glowStrength;
    this.buttonMaterial.color.copy(this.idle).lerp(this.glow, clicking * 0.5 * this.glowStrength);
  }

  /** World point for the index fingertip on the button, pressed down a little mid-click. */
  gripPoint(out = new Vector3()): Vector3 {
    const clicking = Math.max(0, 1 - this.sinceClick / clickSeconds);
    out.copy(grip).add(this.body.position);
    out.y -= clickDip * Math.sin(clicking * Math.PI);
    return this.root.localToWorld(out);
  }
}
