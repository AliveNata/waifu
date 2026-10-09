import { type VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export async function loadVrm(bytes: ArrayBuffer): Promise<VRM> {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.parseAsync(bytes, "");

  const vrm = gltf.userData.vrm as VRM | undefined;
  if (vrm === undefined) {
    throw new Error("File ini glTF biasa, bukan VRM. Export ulang dari VRoid Studio sebagai .vrm.");
  }

  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  // VRM 0.x models face -Z. Rotating them makes both versions face the camera at +Z.
  VRMUtils.rotateVRM0(vrm);

  vrm.scene.traverse((object) => {
    // Bounding volumes of skinned meshes ignore bone motion, so culling hides
    // body parts mid-animation.
    object.frustumCulled = false;
  });
  return vrm;
}

export function disposeVrm(vrm: VRM): void {
  vrm.scene.removeFromParent();
  VRMUtils.deepDispose(vrm.scene);
}
