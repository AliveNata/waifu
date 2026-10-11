import type { VRM } from "@pixiv/three-vrm";
import { Group, Mesh, MeshStandardMaterial, Quaternion, type SkinnedMesh, SphereGeometry, Vector3 } from "three";

/**
 * Sticking her tongue out. Most VRoid models have no tongue, so this uses, in order: a tongue
 * expression the model defines, a tongue morph on its face, or a small tongue mesh placed at the
 * mouth found from the model's own "A" mouth shape.
 */
export interface Tongue {
  /** 0 is in, 1 is fully out. Call every frame while the pose runs. */
  set(amount: number): void;
  dispose(): void;
}

const tongueName = /tongue|bero|舌|べろ/i;

function expressionTongue(vrm: VRM): Tongue | null {
  const manager = vrm.expressionManager;
  const name = manager?.expressions.map((expression) => expression.expressionName).find((n) => tongueName.test(n));
  if (manager == null || name === undefined) {
    return null;
  }
  return { set: (amount) => manager.setValue(name, amount), dispose: () => undefined };
}

function morphTongue(vrm: VRM): Tongue | null {
  const slots: { mesh: Mesh; index: number }[] = [];
  vrm.scene.traverse((object) => {
    const mesh = object as Mesh;
    for (const [name, index] of Object.entries(mesh.morphTargetDictionary ?? {})) {
      if (tongueName.test(name)) {
        slots.push({ mesh, index });
      }
    }
  });
  if (slots.length === 0) {
    return null;
  }
  return {
    set: (amount) => {
      for (const { mesh, index } of slots) {
        if (mesh.morphTargetInfluences !== undefined) {
          mesh.morphTargetInfluences[index] = amount;
        }
      }
    },
    dispose: () => undefined,
  };
}

interface MouthEstimate {
  center: Vector3;
  width: number;
  lowerLipY: number;
  frontZ: number;
}

/** The mouth from the vertices VRoid's "A" shape moves the most. World space, with the model at rest. */
function mouthFromMorph(vrm: VRM): MouthEstimate | null {
  let face: SkinnedMesh | null = null;
  let morphIndex = -1;
  vrm.scene.traverse((object) => {
    const mesh = object as SkinnedMesh;
    if (face !== null || mesh.morphTargetDictionary === undefined) {
      return;
    }
    const entry = Object.entries(mesh.morphTargetDictionary).find(([name]) => name.endsWith("Fcl_MTH_A"));
    if (entry !== undefined) {
      face = mesh;
      morphIndex = entry[1];
    }
  });
  const mesh = face as SkinnedMesh | null;
  const deltas = mesh?.geometry.morphAttributes.position?.[morphIndex];
  if (mesh === null || deltas === undefined) {
    return null;
  }
  let largest = 0;
  for (let i = 0; i < deltas.count; i++) {
    largest = Math.max(largest, Math.hypot(deltas.getX(i), deltas.getY(i), deltas.getZ(i)));
  }
  if (largest === 0) {
    return null;
  }
  const points: Vector3[] = [];
  const vertex = new Vector3();
  for (let i = 0; i < deltas.count; i++) {
    if (Math.hypot(deltas.getX(i), deltas.getY(i), deltas.getZ(i)) > largest * 0.5) {
      mesh.getVertexPosition(i, vertex);
      points.push(mesh.localToWorld(vertex.clone()));
    }
  }
  if (points.length === 0) {
    return null;
  }
  const center = points.reduce((sum, point) => sum.add(point), new Vector3()).divideScalar(points.length);
  const xs = points.map((point) => point.x);
  return {
    center,
    width: Math.max(...xs) - Math.min(...xs),
    lowerLipY: Math.min(...points.map((point) => point.y)),
    frontZ: Math.max(...points.map((point) => point.z)),
  };
}

/** Without a mouth shape: below the eyes by about one eye spacing, a little in front of them. */
function mouthFromEyes(vrm: VRM): MouthEstimate | null {
  const left = vrm.humanoid.getRawBoneNode("leftEye");
  const right = vrm.humanoid.getRawBoneNode("rightEye");
  if (left === null || right === null) {
    return null;
  }
  const a = left.getWorldPosition(new Vector3());
  const b = right.getWorldPosition(new Vector3());
  const spacing = a.distanceTo(b);
  const center = a
    .add(b)
    .multiplyScalar(0.5)
    .add(new Vector3(0, -spacing, spacing * 0.35));
  return { center, width: spacing * 0.7, lowerLipY: center.y - spacing * 0.08, frontZ: center.z };
}

function meshTongue(vrm: VRM): Tongue | null {
  const head = vrm.humanoid.getRawBoneNode("head");
  vrm.scene.updateMatrixWorld(true);
  const mouth = mouthFromMorph(vrm) ?? mouthFromEyes(vrm);
  if (head === null || mouth === null) {
    return null;
  }
  const width = Math.max(0.012, mouth.width * 0.48);
  const length = width * 1.5;
  const geometry = new SphereGeometry(0.5, 20, 12);
  // Light and a little self-lit, so it matches the toon-shaded face instead of reading as a hole.
  const material = new MeshStandardMaterial({ color: "#f2909a", emissive: "#6a2a31", roughness: 0.5 });
  const tip = new Mesh(geometry, material);
  tip.scale.set(width, width * 0.28, length);
  // A pivot at the lower lip, turned so its +z is the model's forward whatever the head bone's
  // own axes are (VRM 0.x models are rotated half a turn on load). The tongue slides out along
  // it and tips slightly down.
  const pivot = new Group();
  const tilt = new Group();
  const lip = new Vector3(mouth.center.x, mouth.lowerLipY + width * 0.12, mouth.frontZ - length * 0.2);
  pivot.position.copy(head.worldToLocal(lip));
  pivot.quaternion.copy(head.getWorldQuaternion(new Quaternion()).invert());
  tilt.add(tip);
  pivot.add(tilt);
  pivot.visible = false;
  head.add(pivot);
  return {
    set: (amount) => {
      pivot.visible = amount > 0.02;
      tip.position.set(0, -width * 0.1, length * (amount * 0.6 - 0.25));
      tilt.rotation.x = 0.6 * amount;
    },
    dispose: () => {
      head.remove(pivot);
      geometry.dispose();
      material.dispose();
    },
  };
}

export function createTongue(vrm: VRM): Tongue | null {
  return expressionTongue(vrm) ?? morphTongue(vrm) ?? meshTongue(vrm);
}
