import { type BufferGeometry, CylinderGeometry, DoubleSide, Group, LatheGeometry, TorusGeometry, Vector2 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { MemberId } from "../../../shared/team.js";
import type { Furniture } from "../office-plan.js";
import { mesh, palette, standard } from "./palette.js";

/** From the hand to the tip, at the room's scale: a 0.85 m umbrella for a team about 1.2 m tall. */
const shaftLength = 0.55;

/**
 * A closed umbrella, built around its grip (the origin) with the tip hanging straight down: a crook
 * handle above the hand, the shaft, and the canopy furled tight around it and strapped.
 */
export function umbrellaModel(color: string): Group {
  const group = new Group();
  // Parts of one material are one mesh: a full stand is a dozen umbrellas, and each draw call counts.
  const crook = new TorusGeometry(0.02, 0.006, 6, 12, Math.PI);
  // The half ring stands in the x-y plane, its ends on the grip's top and 4 cm across.
  crook.translate(-0.02, 0.03, 0);
  const handle = mesh(joined([new CylinderGeometry(0.008, 0.008, 0.06, 8), crook]), standard(palette.oak, 0.55), false);
  const tipGeometry = new CylinderGeometry(0.003, 0.004, 0.03, 6);
  tipGeometry.translate(0, -shaftLength - 0.01, 0);
  const metal = mesh(
    joined([new CylinderGeometry(0.004, 0.004, shaftLength, 6).translate(0, -shaftLength / 2, 0), tipGeometry]),
    standard(palette.steel, 0.4, 0.6),
    false,
  );
  // Furled: the ribs come together at the top notch, the folds bulge just below, and the cloth
  // wraps tighter and tighter down to the tip.
  const profile = [
    [0.0045, -0.07],
    [0.016, -0.1],
    [0.023, -0.14],
    [0.02, -0.24],
    [0.012, -0.38],
    [0.006, -0.47],
    [0.0045, -0.49],
  ]
    // Bottom to top, so the lathe's faces point outward.
    .reverse()
    .map(([radius, y]) => new Vector2(radius, y));
  const canopy = mesh(new LatheGeometry(profile, 12), standard(color, 0.7), false);
  const strap = mesh(new CylinderGeometry(0.0215, 0.0215, 0.016, 12), standard(palette.inkDeep, 0.6), false);
  strap.position.y = -0.22;
  group.add(handle, metal, canopy, strap);
  return group;
}

function joined(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts);
  if (merged === null) {
    throw new Error("umbrella parts could not be merged");
  }
  return merged;
}

/** How far each umbrella leans out from the middle of the stand, so the canopies do not overlap. */
const lean = 0.16;
const binRadius = 0.1;
const binHeight = 0.36;

/**
 * The umbrella stand by the door. On a wet day each member drops their umbrella in on the way in
 * and takes it back out on the way home, so it holds one for everyone who is in.
 */
export class UmbrellaStand {
  readonly root: Group;
  private readonly umbrellas: Map<MemberId, Group>;

  constructor(piece: Furniture, colors: Record<MemberId, string>) {
    this.root = new Group();
    this.root.position.set(piece.x, 0, piece.z);
    this.root.rotation.y = piece.yaw;
    const metal = standard(palette.ink, 0.45, 0.3);
    metal.side = DoubleSide;
    const bin = mesh(new CylinderGeometry(binRadius, binRadius * 0.88, binHeight, 18, 1, true), metal);
    bin.position.y = binHeight / 2;
    const bottom = mesh(new CylinderGeometry(binRadius * 0.88, binRadius * 0.88, 0.01, 18), metal, false);
    bottom.position.y = 0.005;
    const rim = mesh(new TorusGeometry(binRadius, 0.007, 6, 24), standard(palette.steel, 0.35, 0.6), false);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = binHeight;
    this.root.add(bin, bottom, rim);
    const members = Object.keys(colors) as MemberId[];
    this.umbrellas = new Map(
      members.map((memberId, index) => {
        const around = (index / members.length) * Math.PI * 2;
        // The tip rests on the bottom near the middle; the umbrella leans out toward the rim,
        // each one on its own side, turned so the crooks point every which way.
        const pivot = new Group();
        pivot.position.set(Math.sin(around) * 0.03, 0.03, Math.cos(around) * 0.03);
        pivot.rotation.set(lean, around, 0, "YXZ");
        const umbrella = umbrellaModel(colors[memberId]);
        umbrella.position.y = shaftLength;
        umbrella.rotation.y = index * 2.4;
        pivot.add(umbrella);
        pivot.visible = false;
        this.root.add(pivot);
        return [memberId, pivot];
      }),
    );
  }

  /** Shows the umbrellas of the members whose umbrella is in the stand right now. */
  show(inStand: ReadonlySet<MemberId>): void {
    for (const [memberId, umbrella] of this.umbrellas) {
      umbrella.visible = inStand.has(memberId);
    }
  }
}
