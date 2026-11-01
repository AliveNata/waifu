import { type Bone, Group, Matrix4, type Mesh, type Object3D, Quaternion, Vector3 } from "three";

/**
 * Rigging for the "Free Pack - VR Hands (Rigged)" model: one skinned mesh holding a left and a
 * right hand, with bones named like "J_Right_HandIndex1_029". The companion's pointer uses the
 * right hand; Alyx's first-person view uses both, from two copies of the model.
 */
export type VrHandSide = "Right" | "Left";
export type Finger = "thumb" | "index" | "middle" | "ring" | "pinky";

/** Bone name parts in the model. */
const fingerNames: Record<Finger, string> = {
  thumb: "Thumb",
  index: "Index",
  middle: "Middle",
  ring: "Ring",
  pinky: "Pinky",
};

export const fingers: readonly Finger[] = ["thumb", "index", "middle", "ring", "pinky"];

/** How far each joint folds at a full curl, base to tip, in radians. */
export const jointCurl: Record<Finger, readonly [number, number, number]> = {
  thumb: [0.5, 0.6, 0.7],
  index: [1.3, 1.5, 1.0],
  middle: [1.3, 1.5, 1.0],
  ring: [1.3, 1.5, 1.0],
  pinky: [1.3, 1.5, 1.0],
};

interface FingerChain {
  joints: Bone[];
  rest: Quaternion[];
  /** Local axis each joint folds around toward the palm. */
  axis: Vector3;
}

export type HandAnchor = "index-tip" | "middle-tip" | "palm" | "wrist";

export interface VrHandRig {
  root: Group;
  chains: Record<Finger, FingerChain>;
  anchors: Record<HandAnchor, Object3D>;
  /** In the root's frame at rest: the fingers' direction and the palm's facing. */
  fingers: Vector3;
  palm: Vector3;
}

function worldPosition(object: Object3D): Vector3 {
  return object.getWorldPosition(new Vector3());
}

/** Rotates `joint` about `axis` (local) by `angle` on top of its rest pose. */
function fold(joint: Bone, rest: Quaternion, axis: Vector3, angle: number): void {
  joint.quaternion.copy(rest).multiply(new Quaternion().setFromAxisAngle(axis, angle));
}

/** Of the candidate axes, the one that folds the chain's tip closest to `toward`. */
function curlAxis(joints: Bone[], rest: Quaternion[], tip: Object3D, toward: Vector3, root: Object3D): Vector3 {
  const candidates = [new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)];
  let best = candidates[0] as Vector3;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const axis of candidates) {
    for (const [index, joint] of joints.entries()) {
      fold(joint, rest[index] as Quaternion, axis, 0.6);
    }
    root.updateMatrixWorld(true);
    const distance = worldPosition(tip).distanceTo(toward);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = axis;
    }
  }
  for (const [index, joint] of joints.entries()) {
    joint.quaternion.copy(rest[index] as Quaternion);
  }
  root.updateMatrixWorld(true);
  return best;
}

/**
 * Reads one hand out of the model: its finger bones, which way each folds, and the points that
 * touch. The other hand is shrunk away. Which way a finger folds is measured here rather than
 * written down, so a hand exported with other bone axes still curls the right way.
 */
export function rigVrHand(model: Object3D, side: VrHandSide): VrHandRig {
  const root = new Group();
  root.add(model);
  root.updateMatrixWorld(true);
  const bones = new Map<string, Bone>();
  model.traverse((node) => {
    if ((node as Bone).isBone === true) {
      bones.set(node.name.replace(/_\d+$/, ""), node as Bone);
    }
    if ((node as Mesh).isMesh === true) {
      // The skinned hand moves far from where its bounding sphere was measured.
      node.frustumCulled = false;
    }
  });
  const bone = (name: string): Bone => {
    const found = bones.get(name);
    if (found === undefined) {
      throw new Error(`hand model has no bone ${name}`);
    }
    return found;
  };
  // One mesh holds both hands; this copy shows only one of them.
  bone(side === "Right" ? "J_Left" : "J_Right").scale.setScalar(0.0001);

  const hand = `J_${side}_Hand`;
  const wrist = worldPosition(bone(hand));
  const middleBase = worldPosition(bone(`${hand}Middle1`));
  const across = worldPosition(bone(`${hand}Index1`)).sub(worldPosition(bone(`${hand}Pinky1`)));
  const fingerDirection = middleBase.clone().sub(wrist).normalize();
  // The palm is the side the fingertips hang toward at rest.
  const middleTip = worldPosition(bone(`${hand}Middle4`));
  const droop = middleTip.clone().sub(middleBase);
  droop.addScaledVector(fingerDirection, -droop.dot(fingerDirection));
  let palm = new Vector3().crossVectors(fingerDirection, across).normalize();
  if (palm.dot(droop) < 0) {
    palm = palm.negate();
  }
  const palmCenter = wrist.clone().lerp(middleBase, 0.55).addScaledVector(palm, 0.02);

  const chains = {} as Record<Finger, FingerChain>;
  for (const finger of fingers) {
    const name = `${hand}${fingerNames[finger]}`;
    const joints = [1, 2, 3].map((index) => bone(`${name}${index}`));
    const rest = joints.map((joint) => joint.quaternion.clone());
    // Fingers fold toward the palm; the thumb folds across it, toward the base of the little finger.
    const toward =
      finger === "thumb" ? worldPosition(bone(`${hand}Pinky1`)) : palmCenter.clone().addScaledVector(palm, 0.04);
    chains[finger] = { joints, rest, axis: curlAxis(joints, rest, bone(`${name}4`), toward, root) };
  }

  const palmAnchor = new Group();
  palmAnchor.position.copy(bone(hand).worldToLocal(palmCenter.clone()));
  bone(hand).add(palmAnchor);
  return {
    root,
    chains,
    anchors: {
      "index-tip": bone(`${hand}Index4`),
      "middle-tip": bone(`${hand}Middle4`),
      palm: palmAnchor,
      wrist: bone(hand),
    },
    fingers: fingerDirection,
    palm,
  };
}

/** Curls each finger, 0 open to 1 a full fist, spread over its joints. */
export function curlVrHand(rig: VrHandRig, curl: Record<Finger, number>): void {
  for (const finger of fingers) {
    const chain = rig.chains[finger];
    chain.joints.forEach((joint, index) => {
      fold(joint, chain.rest[index] as Quaternion, chain.axis, curl[finger] * (jointCurl[finger][index] ?? 0));
    });
  }
}

/** A turn that takes the rest hand's fingers and palm onto the wanted ones. */
export function aimVrHand(rig: VrHandRig, fingerDirection: Vector3, palm: Vector3): Quaternion {
  const frame = (forward: Vector3, up: Vector3): Matrix4 => {
    const f = forward.clone().normalize();
    const p = up.clone().addScaledVector(f, -up.dot(f)).normalize();
    return new Matrix4().makeBasis(f, p, new Vector3().crossVectors(f, p));
  };
  const from = frame(rig.fingers, rig.palm);
  const to = frame(fingerDirection, palm);
  return new Quaternion().setFromRotationMatrix(to.multiply(from.transpose()));
}
