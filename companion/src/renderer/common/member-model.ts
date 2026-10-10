import type { MToonMaterial, VRM } from "@pixiv/three-vrm";
import {
  BoxGeometry,
  CanvasTexture,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  type Texture,
  TorusGeometry,
  Vector3,
} from "three";
import type { MemberId } from "../../shared/team.js";
import type { RendererBridge } from "./bridge.js";
import { type MemberLook, memberLooks } from "./looks.js";
import { hexToRgb, remapToColor, type ShadeRange } from "./recolor.js";
import { loadVrm } from "./vrm-loader.js";

/** VRoid names its materials by part, e.g. Hair_00_HAIR or Tops_01_CLOTH. */
const partColors: readonly { pattern: RegExp; pick: (look: MemberLook) => string | null; range: ShadeRange }[] = [
  { pattern: /_HAIR/i, pick: (look) => look.hair, range: { low: 0.7, high: 1.2 } },
  // Wide range so the pupil stays dark and the lower iris glows, like anime eyes.
  { pattern: /EyeIris/i, pick: (look) => look.eyes, range: { low: 0.25, high: 1.3 } },
  { pattern: /Tops/i, pick: (look) => look.top, range: { low: 0.75, high: 1.15 } },
  { pattern: /Bottoms/i, pick: (look) => look.skirt ?? look.legs, range: { low: 0.7, high: 1.15 } },
  { pattern: /Shoes/i, pick: (look) => look.shoes, range: { low: 0.6, high: 1.2 } },
];

function isMToon(material: Material): material is MToonMaterial {
  return "isMToonMaterial" in material;
}

function recoloredTexture(source: Texture, color: string, range: ShadeRange): Texture | null {
  const image = source.image as CanvasImageSource & { width: number; height: number };
  if (image === undefined || image === null || image.width === 0) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) {
    return null;
  }
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  remapToColor(pixels.data, hexToRgb(color), range);
  context.putImageData(pixels, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.flipY = source.flipY;
  texture.colorSpace = source.colorSpace;
  texture.wrapS = source.wrapS;
  texture.wrapT = source.wrapT;
  texture.channel = source.channel;
  return texture;
}

function recolorMaterial(material: MToonMaterial, color: string, range: ShadeRange): void {
  const original = material.map;
  if (original === null) {
    material.color.set(color);
    return;
  }
  const texture = recoloredTexture(original, color, range);
  if (texture === null) {
    return;
  }
  // VRoid often reuses the base texture as the shade texture; keep them in sync.
  if (material.shadeMultiplyTexture === original) {
    material.shadeMultiplyTexture = texture;
  }
  material.map = texture;
  // The shade tint was tuned for the old hue. Keep its brightness, drop its color.
  const shade = material.shadeColorFactor;
  const gray = 0.2126 * shade.r + 0.7152 * shade.g + 0.0722 * shade.b;
  material.shadeColorFactor = shade.setRGB(gray, gray, gray);
  material.needsUpdate = true;
}

function addGlasses(vrm: VRM): void {
  const head = vrm.humanoid.getRawBoneNode("head");
  const lookAt = vrm.lookAt;
  if (head === null || lookAt == null) {
    return;
  }
  const frame = new MeshStandardMaterial({ color: "#2a2a2a", roughness: 0.4 });
  const glasses = new Group();
  for (const side of [-1, 1] as const) {
    const lens = new Mesh(new TorusGeometry(0.022, 0.0025, 6, 20), frame);
    lens.position.x = side * 0.032;
    glasses.add(lens);
  }
  glasses.add(new Mesh(new BoxGeometry(0.02, 0.003, 0.003), frame));

  // Raw head bones can have arbitrary local axes, so place the glasses in model
  // space (facing the model's front) and convert into the head's frame. As a
  // child of the head they still follow it and scale with the chibi head.
  vrm.scene.updateMatrixWorld(true);
  const modelRotation = vrm.scene.getWorldQuaternion(new Quaternion());
  const eyeWorld = lookAt
    .getLookAtWorldPosition(new Vector3())
    .add(new Vector3(0, 0, 0.075).applyQuaternion(modelRotation));
  glasses.position.copy(head.worldToLocal(eyeWorld));
  glasses.quaternion.copy(head.getWorldQuaternion(new Quaternion()).invert().multiply(modelRotation));
  head.add(glasses);
}

/** Tints a VRoid-style model with a member's colors so the base model reads as that character. */
export function styleAsMember(vrm: VRM, look: MemberLook): void {
  const done = new Set<Material>();
  vrm.scene.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    const materials: Material[] = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (done.has(material) || !isMToon(material)) {
        continue;
      }
      done.add(material);
      const part = partColors.find(({ pattern }) => pattern.test(material.name));
      const color = part?.pick(look) ?? null;
      if (part !== undefined && color !== null) {
        recolorMaterial(material, color, part.range);
      }
    }
  });
  if (look.glasses === true) {
    addGlasses(vrm);
  }
}

export type MemberModelSource = "own" | "base";

export interface LoadedMemberModel {
  vrm: VRM;
  source: MemberModelSource;
}

/**
 * The member's own .vrm if one is set, otherwise the shared anime base model
 * tinted in their colors. Null when neither exists, so callers fall back to
 * the low-poly placeholder.
 */
export class MemberModelLoader {
  private baseBytes: Promise<ArrayBuffer | null> | null = null;

  constructor(private readonly bridge: RendererBridge) {}

  async load(memberId: MemberId): Promise<LoadedMemberModel | null> {
    const own = await this.bridge.loadSavedModel(memberId);
    if (own !== null) {
      return { vrm: await loadVrm(own.bytes), source: "own" };
    }
    return this.loadBase(memberId);
  }

  async loadBase(memberId: MemberId): Promise<LoadedMemberModel | null> {
    this.baseBytes ??= this.bridge.loadBaseModel().then((file) => file?.bytes ?? null);
    const bytes = await this.baseBytes;
    if (bytes === null) {
      return null;
    }
    const vrm = await loadVrm(bytes);
    styleAsMember(vrm, memberLooks[memberId]);
    return { vrm, source: "base" };
  }
}
