import type { VRMHumanBoneName } from "@pixiv/three-vrm";
import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  SphereGeometry,
  TorusGeometry,
} from "three";
import type { ExpressionWeights } from "../common/expressions.js";
import type { MemberLook } from "../common/looks.js";
import type { PoseTarget } from "../common/pose.js";
import type { ArmSide, ArmTip, OfficeAvatar } from "./avatar.js";
import type { IkChain } from "./ik.js";
import type { LegMetrics } from "./seating.js";

/** Joint layout in meters, T-pose, facing +Z: the same conventions as normalized VRM bones. */
const dims = {
  hipsY: 0.4,
  upperLeg: 0.2,
  lowerLeg: 0.18,
  spine: 0.1,
  chest: 0.12,
  neck: 0.09,
  headRadius: 0.17,
  shoulderX: 0.1,
  upperArm: 0.14,
  lowerArm: 0.13,
} as const;

function material(color: string): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: new Color(color), roughness: 0.8, flatShading: true });
}

function mesh(geometry: BufferGeometry, color: string, x = 0, y = 0, z = 0): Mesh {
  const part = new Mesh(geometry, material(color));
  part.position.set(x, y, z);
  part.castShadow = true;
  return part;
}

function joint(name: VRMHumanBoneName, parent: Object3D, x: number, y: number, z = 0): Group {
  const node = new Group();
  node.name = name;
  node.position.set(x, y, z);
  parent.add(node);
  return node;
}

/** Cylinder lying along the X axis, starting at the joint and pointing toward `direction`. */
function limbX(length: number, radius: number, color: string, direction: 1 | -1): Mesh {
  const geometry = new CylinderGeometry(radius, radius * 0.9, length, 6);
  geometry.rotateZ(Math.PI / 2);
  return mesh(geometry, color, (direction * length) / 2, 0, 0);
}

/** Cylinder hanging down along -Y from the joint. */
function limbDown(length: number, radius: number, color: string): Mesh {
  return mesh(new CylinderGeometry(radius, radius * 0.85, length, 6), color, 0, -length / 2, 0);
}

function buildHair(head: Group, look: MemberLook): void {
  const r = dims.headRadius;
  const cap = new SphereGeometry(r * 1.08, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
  head.add(mesh(cap, look.hair, 0, r * 0.95, -0.01));
  head.add(mesh(new BoxGeometry(r * 1.55, 0.07, 0.05), look.hair, 0, r * 1.45, r * 0.85));

  switch (look.hairStyle) {
    case "short":
      head.add(mesh(new BoxGeometry(0.05, r * 1.0, r * 1.3), look.hair, -r * 0.98, r * 0.85, -0.02));
      head.add(mesh(new BoxGeometry(0.05, r * 1.0, r * 1.3), look.hair, r * 0.98, r * 0.85, -0.02));
      head.add(mesh(new BoxGeometry(r * 1.8, r * 1.1, 0.06), look.hair, 0, r * 0.85, -r * 0.92));
      break;
    case "bob":
      head.add(mesh(new BoxGeometry(0.07, r * 1.3, r * 1.5), look.hair, -r * 1.0, r * 0.65, -0.02));
      head.add(mesh(new BoxGeometry(0.07, r * 1.3, r * 1.5), look.hair, r * 1.0, r * 0.65, -0.02));
      head.add(mesh(new BoxGeometry(r * 2.0, r * 1.3, 0.08), look.hair, 0, r * 0.65, -r * 0.92));
      break;
    case "long":
      head.add(mesh(new BoxGeometry(0.06, r * 2.2, r * 1.2), look.hair, -r * 1.0, r * 0.2, -0.03));
      head.add(mesh(new BoxGeometry(0.06, r * 2.2, r * 1.2), look.hair, r * 1.0, r * 0.2, -0.03));
      head.add(mesh(new BoxGeometry(r * 2.0, r * 3.2, 0.08), look.hair, 0, -r * 0.2, -r * 0.92));
      break;
    case "ponytail": {
      head.add(mesh(new BoxGeometry(r * 1.8, r * 0.9, 0.06), look.hair, 0, r * 1.0, -r * 0.92));
      head.add(mesh(new SphereGeometry(0.05, 6, 4), look.hair, 0, r * 1.2, -r * 1.1));
      const tail = mesh(new CylinderGeometry(0.045, 0.02, 0.32, 6), look.hair, 0, r * 0.75, -r * 1.25);
      tail.rotation.x = 0.35;
      head.add(tail);
      break;
    }
  }
}

export class PlaceholderAvatar implements OfficeAvatar {
  readonly kind = "placeholder";
  readonly root = new Group();
  readonly legs: LegMetrics = {
    hipsHeight: dims.hipsY,
    thighJointDrop: 0.03,
    thigh: dims.upperLeg,
    shin: dims.hipsY - 0.03 - dims.upperLeg,
    poseUnitsPerMeter: 1,
  };
  readonly poseTarget: PoseTarget;

  private readonly joints = new Map<VRMHumanBoneName, Group>();
  private readonly eyes: Mesh[] = [];
  private readonly mouth: Mesh;
  private readonly rightHand: Group;
  private readonly leftHand: Group;
  /** Empty nodes at the far end of each mitten, the IK tip for typing. */
  private readonly fingertips: Record<ArmSide, Group>;

  constructor(look: MemberLook) {
    const hips = this.add(joint("hips", this.root, 0, dims.hipsY));
    const spine = this.add(joint("spine", hips, 0, 0.02));
    const chest = this.add(joint("chest", spine, 0, dims.spine));
    const neck = this.add(joint("neck", chest, 0, dims.chest));
    const head = this.add(joint("head", neck, 0, dims.neck - 0.03));

    // Torso, skirt or trousers.
    spine.add(mesh(new BoxGeometry(0.16, dims.spine + 0.02, 0.11), look.top, 0, dims.spine / 2, 0));
    chest.add(mesh(new BoxGeometry(0.2, dims.chest, 0.12), look.top, 0, dims.chest / 2, 0));
    if (look.armor !== undefined) {
      chest.add(mesh(new BoxGeometry(0.21, dims.chest * 0.8, 0.13), look.armor, 0, dims.chest * 0.45, 0.005));
    }
    if (look.cape !== undefined) {
      chest.add(mesh(new CylinderGeometry(0.1, 0.17, 0.1, 8), look.cape, 0, dims.chest - 0.03, 0));
    }
    if (look.skirt !== null) {
      hips.add(mesh(new CylinderGeometry(0.1, 0.17, 0.17, 8), look.skirt, 0, -0.06, 0));
    } else {
      hips.add(mesh(new BoxGeometry(0.17, 0.08, 0.11), look.legs, 0, -0.02, 0));
    }
    neck.add(mesh(new CylinderGeometry(0.03, 0.035, dims.neck, 6), look.skin, 0, dims.neck / 2 - 0.02, 0));

    // Head and face.
    const r = dims.headRadius;
    head.add(mesh(new IcosahedronGeometry(r, 1), look.skin, 0, r * 0.85, 0));
    for (const side of [-1, 1] as const) {
      const eye = mesh(new SphereGeometry(0.032, 8, 6), look.eyes, side * 0.06, r * 0.72, r * 0.9);
      eye.scale.set(1, 1.35, 0.45);
      head.add(eye);
      this.eyes.push(eye);
    }
    this.mouth = mesh(new BoxGeometry(0.035, 0.008, 0.01), "#8a3f3f", 0, r * 0.45, r * 0.97);
    head.add(this.mouth);
    if (look.glasses === true) {
      for (const side of [-1, 1] as const) {
        head.add(mesh(new TorusGeometry(0.042, 0.006, 4, 12), "#2a2a2a", side * 0.06, r * 0.72, r * 1.0));
      }
      head.add(mesh(new BoxGeometry(0.04, 0.008, 0.008), "#2a2a2a", 0, r * 0.74, r * 1.0));
    }
    buildHair(head, look);

    // Arms in T-pose: left along +X, right along -X.
    for (const side of [1, -1] as const) {
      const prefix = side === 1 ? "left" : "right";
      const upper = this.add(joint(`${prefix}UpperArm`, chest, side * dims.shoulderX, dims.chest - 0.02));
      upper.add(limbX(dims.upperArm, 0.03, look.sleeves, side));
      const lower = this.add(joint(`${prefix}LowerArm`, upper, side * dims.upperArm, 0));
      lower.add(limbX(dims.lowerArm, 0.026, look.sleeves, side));
      const hand = this.add(joint(`${prefix}Hand`, lower, side * dims.lowerArm, 0));
      hand.add(mesh(new SphereGeometry(0.03, 6, 4), look.skin, side * 0.02, 0, 0));
    }
    const rightHand = this.joints.get("rightHand");
    const leftHand = this.joints.get("leftHand");
    if (rightHand === undefined || leftHand === undefined) {
      throw new Error("placeholder is missing a hand joint");
    }
    this.rightHand = rightHand;
    this.leftHand = leftHand;
    const fingertip = (hand: Group, side: 1 | -1): Group => {
      const tip = new Group();
      tip.position.x = side * 0.05;
      hand.add(tip);
      return tip;
    };
    this.fingertips = { left: fingertip(leftHand, 1), right: fingertip(rightHand, -1) };

    // Legs hang straight down.
    for (const side of [1, -1] as const) {
      const prefix = side === 1 ? "left" : "right";
      const upper = this.add(joint(`${prefix}UpperLeg`, hips, side * 0.05, -0.03));
      upper.add(limbDown(dims.upperLeg, 0.045, look.legs));
      const lower = this.add(joint(`${prefix}LowerLeg`, upper, 0, -dims.upperLeg));
      lower.add(limbDown(dims.lowerLeg, 0.038, look.socks));
      lower.add(mesh(new BoxGeometry(0.07, 0.05, 0.12), look.shoes, 0, -dims.lowerLeg - 0.005, 0.02));
    }

    this.poseTarget = { node: (bone) => this.joints.get(bone) ?? null };
  }

  private add(node: Group): Group {
    this.joints.set(node.name as VRMHumanBoneName, node);
    return node;
  }

  syncPose(): void {
    this.root.updateMatrixWorld(true);
  }

  /** Placeholder hands are mittens, so the fingertip is the end of the hand block. */
  arm(side: ArmSide, tip: ArmTip): IkChain | null {
    const upper = this.joints.get(`${side}UpperArm`);
    const lower = this.joints.get(`${side}LowerArm`);
    if (upper === undefined || lower === undefined) {
      return null;
    }
    const hand = side === "right" ? this.rightHand : this.leftHand;
    return {
      joints: [
        { rotate: upper, measure: upper },
        { rotate: lower, measure: lower },
      ],
      effector: tip === "fingertip" ? this.fingertips[side] : hand,
      sync: () => this.syncPose(),
    };
  }

  addHairColliders(): void {
    // Placeholder hair is rigid geometry, nothing to collide.
  }

  setExpressions(weights: ExpressionWeights, blink: number): void {
    const happy = weights.happy ?? 0;
    const surprised = weights.surprised ?? 0;
    // Happy squints into arcs, blinking closes, surprise widens the eyes.
    const openness = Math.max(0.12, (1 - blink) * (1 - happy * 0.7) * (1 + surprised * 0.3));
    for (const eye of this.eyes) {
      eye.scale.y = 1.35 * openness;
    }
    this.mouth.scale.set(1 + happy * 0.8, 1 + surprised * 2.5, 1);
  }

  update(): void {
    // Placeholders have no springs or expressions to advance.
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        (object.material as MeshStandardMaterial).dispose();
      }
    });
  }
}
