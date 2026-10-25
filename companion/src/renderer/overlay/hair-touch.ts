import {
  type VRM,
  VRMSpringBoneCollider,
  VRMSpringBoneColliderShapeSphere,
  type VRMSpringBoneJoint,
} from "@pixiv/three-vrm";
import { type Object3D, Vector3 } from "three";

/** Where the stroking palm is, in world space, or null when the hand is not stroking her hair. */
export interface HairContact {
  point: Vector3;
  /** About the palm's size, in meters. */
  radius: number;
}

/** How hard the hair is swept along per meter per second the hand moves. */
const sweepPerSpeed = 0.5;
/** The most the sweep can add to a strand's own pull, so a fast stroke does not fling the hair. */
const maxSweep = 0.3;
/** How quickly the sweep follows the hand, per second; it also settles back this fast. */
const sweepRate = 10;

function isUnder(node: Object3D, ancestor: Object3D): boolean {
  for (let parent = node.parent; parent !== null; parent = parent.parent) {
    if (parent === ancestor) {
      return true;
    }
  }
  return false;
}

/**
 * The hair answers a stroke. The palm is a collider that pushes the strands it meets, and the
 * whole head of hair is swept a little along the way the hand moves. Only springs hanging from
 * the head take part, so nothing else on her moves.
 */
export class HairTouch {
  private readonly collider = new VRMSpringBoneCollider(new VRMSpringBoneColliderShapeSphere({ radius: 0.05 }));
  private readonly hair: { joint: VRMSpringBoneJoint; dir: Vector3; power: number }[] = [];
  private readonly sweep = new Vector3();
  private last: Vector3 | null = null;

  constructor(
    vrm: VRM,
    private readonly world: Object3D,
  ) {
    const head = vrm.humanoid.getRawBoneNode("head");
    const group = { name: "pointer-hand", colliders: [this.collider] };
    for (const joint of vrm.springBoneManager?.joints ?? []) {
      if (head !== null && isUnder(joint.bone, head)) {
        joint.colliderGroups = [...joint.colliderGroups, group];
        this.hair.push({ joint, dir: joint.settings.gravityDir.clone(), power: joint.settings.gravityPower });
      }
    }
    this.collider.visible = false;
    this.park();
    world.add(this.collider);
  }

  /** Call every frame before the model updates. */
  update(contact: HairContact | null, deltaSeconds: number): void {
    let wanted = new Vector3();
    if (contact === null) {
      this.park();
      this.last = null;
    } else {
      this.collider.position.copy(contact.point);
      (this.collider.shape as VRMSpringBoneColliderShapeSphere).radius = contact.radius;
      if (this.last !== null && deltaSeconds > 0) {
        wanted = contact.point.clone().sub(this.last).divideScalar(deltaSeconds).multiplyScalar(sweepPerSpeed);
        // Only along her head, not into it or away from it.
        wanted.y = 0;
        wanted.clampLength(0, maxSweep);
      }
      this.last = contact.point.clone();
    }
    this.collider.updateMatrixWorld(true);
    this.sweep.lerp(wanted, Math.min(1, sweepRate * deltaSeconds));
    for (const strand of this.hair) {
      // The strand's own pull plus the sweep, as one direction and strength.
      const pull = strand.dir.clone().multiplyScalar(strand.power).add(this.sweep);
      strand.joint.settings.gravityPower = pull.length();
      if (pull.lengthSq() > 1e-8) {
        strand.joint.settings.gravityDir.copy(pull.normalize());
      }
    }
  }

  dispose(): void {
    for (const strand of this.hair) {
      strand.joint.settings.gravityDir.copy(strand.dir);
      strand.joint.settings.gravityPower = strand.power;
      strand.joint.colliderGroups = strand.joint.colliderGroups.filter((group) => group.name !== "pointer-hand");
    }
    this.world.remove(this.collider);
  }

  /** Out of reach of every strand while the hand is not stroking. */
  private park(): void {
    this.collider.position.set(0, -100, 0);
  }
}
