import { BoxGeometry, Color, InstancedMesh, MeshBasicMaterial, Object3D } from "three";

/** The logo's purple running into periwinkle: the two ends of the neon gradient. */
const neonPurple = new Color("#b45cff");
const neonPeriwinkle = new Color("#6f7fdc");
const segmentLength = 0.22;
/** Meters per second the light pulse travels along a strip. */
const pulseSpeed = 0.9;
/** Distance between two pulses on one strip. */
const pulseSpacing = 3.2;

export interface NeonRun {
  /** Start and end of the strip on the floor plan, at height `y`. */
  from: { x: number; z: number };
  to: { x: number; z: number };
  y: number;
  /** -1 runs the pulse from `to` back to `from`. */
  direction?: 1 | -1;
}

/**
 * LED strips made of short segments, lit as one instanced mesh. A bright pulse runs along each
 * strip over a purple to periwinkle gradient; at night the whole strip brightens, so the neon
 * carries the room once the daylight is gone.
 */
export class NeonStrips {
  readonly mesh: InstancedMesh;
  /** Distance along its strip for every segment, and which way its pulse runs. */
  private readonly along: Float32Array;
  private readonly directions: Int8Array;
  private readonly color = new Color();

  constructor(runs: readonly NeonRun[]) {
    const placements: { x: number; y: number; z: number; yaw: number; along: number; direction: number }[] = [];
    for (const run of runs) {
      const dx = run.to.x - run.from.x;
      const dz = run.to.z - run.from.z;
      const length = Math.hypot(dx, dz);
      const count = Math.max(1, Math.round(length / segmentLength));
      const yaw = Math.atan2(dx, dz);
      for (let index = 0; index < count; index++) {
        const t = (index + 0.5) / count;
        placements.push({
          x: run.from.x + dx * t,
          y: run.y,
          z: run.from.z + dz * t,
          yaw,
          along: t * length,
          direction: run.direction ?? 1,
        });
      }
    }
    // A small gap between segments makes the strip read as individual LEDs chasing each other.
    const geometry = new BoxGeometry(0.03, 0.025, segmentLength * 0.86);
    const material = new MeshBasicMaterial({ toneMapped: false });
    this.mesh = new InstancedMesh(geometry, material, placements.length);
    this.along = new Float32Array(placements.length);
    this.directions = new Int8Array(placements.length);
    const dummy = new Object3D();
    placements.forEach((placement, index) => {
      dummy.position.set(placement.x, placement.y, placement.z);
      dummy.rotation.set(0, placement.yaw, 0);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(index, dummy.matrix);
      this.along[index] = placement.along;
      this.directions[index] = placement.direction;
      this.mesh.setColorAt(index, neonPurple);
    });
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
  }

  update(time: number, night: number): void {
    const base = 0.45 + 0.35 * night;
    for (let index = 0; index < this.along.length; index++) {
      const along = this.along[index] as number;
      const travelled = (along - (this.directions[index] as number) * time * pulseSpeed) / pulseSpacing;
      const phase = travelled - Math.floor(travelled);
      // Sharp head with a short fading tail behind it.
      const pulse = phase < 0.18 ? (1 - phase / 0.18) ** 2 : 0;
      const hue = 0.5 + 0.5 * Math.sin(along * 0.35 + time * 0.25);
      this.color
        .copy(neonPurple)
        .lerp(neonPeriwinkle, hue)
        .multiplyScalar(base + 1.1 * pulse);
      this.mesh.setColorAt(index, this.color);
    }
    if (this.mesh.instanceColor !== null) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }
}
