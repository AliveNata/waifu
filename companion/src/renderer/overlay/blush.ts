import type { VRM } from "@pixiv/three-vrm";
import {
  CanvasTexture,
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from "three";

/** Red cheeks, faded in and out. VRM presets have no blush, so this draws one on any model. */
export interface Blush {
  /** Call every frame with how flushed she should be (0 to 1). */
  update(target: number, deltaSeconds: number): void;
  dispose(): void;
}

/** Flushes fast, fades slowly: the red lingers a moment after she calms down. */
const riseRate = 4;
const fallRate = 0.6;

/** Eases `current` toward `target`, faster up than down. */
export function stepBlush(current: number, target: number, deltaSeconds: number): number {
  const rate = target > current ? riseRate : fallRate;
  const step = rate * deltaSeconds;
  return Math.abs(target - current) <= step ? target : current + Math.sign(target - current) * step;
}

function blushTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    throw new Error("2D canvas is not available");
  }
  // Soft at the edge so it reads as color in the skin, not a sticker.
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255, 92, 120, 0.85)");
  gradient.addColorStop(0.55, "rgba(255, 110, 135, 0.45)");
  gradient.addColorStop(1, "rgba(255, 120, 140, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * Two soft pink patches on the cheeks, placed from the eyes: a little outside and below each
 * one, and in front of them, facing the model's front. They ride on the head bone, so they
 * follow every nod and turn.
 */
export function createBlush(vrm: VRM): Blush | null {
  const head = vrm.humanoid.getRawBoneNode("head");
  const leftEye = vrm.humanoid.getRawBoneNode("leftEye");
  const rightEye = vrm.humanoid.getRawBoneNode("rightEye");
  if (head === null || leftEye === null || rightEye === null) {
    return null;
  }
  vrm.scene.updateMatrixWorld(true);
  const left = leftEye.getWorldPosition(new Vector3());
  const right = rightEye.getWorldPosition(new Vector3());
  const spacing = left.distanceTo(right);
  const texture = blushTexture();
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: 0,
    toneMapped: false,
  });
  const geometry = new CircleGeometry(spacing * 0.42, 24);
  // +z of the pivot is the model's front whatever the head bone's own axes are.
  const pivot = new Group();
  pivot.quaternion.copy(head.getWorldQuaternion(new Quaternion()).invert());
  head.add(pivot);
  for (const eye of [left, right]) {
    const outward = Math.sign(eye.x - (left.x + right.x) / 2);
    const cheek = new Vector3(eye.x + outward * spacing * 0.3, eye.y - spacing * 0.38, eye.z + spacing * 0.45);
    const patch = new Mesh(geometry, material);
    // Wider than tall, like a flush across the cheekbone.
    patch.scale.set(1.25, 0.7, 1);
    patch.position.copy(head.worldToLocal(cheek)).applyQuaternion(head.getWorldQuaternion(new Quaternion()));
    patch.renderOrder = 2;
    pivot.add(patch);
  }
  pivot.visible = false;
  let level = 0;
  return {
    update: (target, deltaSeconds) => {
      level = stepBlush(level, target, deltaSeconds);
      material.opacity = level;
      pivot.visible = level > 0.01;
    },
    dispose: () => {
      head.remove(pivot);
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
