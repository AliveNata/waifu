import { BoxGeometry, Color, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, Vector3 } from "three";

const rows = ["1234567890", "qwertyuiop", "asdfghjkl;", "zxcvbnm,./"];
/**
 * Keys are wider than deep so ten columns make a keyboard about 0.32 by 0.12 m, a real one at the
 * room's 0.73 scale, without dropping keys the typing reads from.
 */
const keyWidth = 0.024;
const keyDepth = 0.016;
const pitchX = 0.029;
const pitchZ = 0.02;
const pressDepth = 0.005;
const pressSeconds = 0.12;
/** Key caps sit at y 0.02 and are 0.01 tall. */
const restY = 0.02;
const keyTopY = 0.025;

interface Key {
  /** Slot in the instanced key mesh. */
  index: number;
  x: number;
  z: number;
  scaleX: number;
  pressedFor: number;
}

/**
 * A small keyboard whose keys dip and light up as characters are typed on the matching screen.
 * The keys are one instanced mesh, so a keyboard costs two draw calls instead of one per key.
 */
export class Keyboard {
  readonly root = new Group();
  private readonly keys = new Map<string, Key>();
  private readonly allKeys: Key[] = [];
  private readonly space: Key;
  private readonly enter: Key;
  private readonly glow: Color;
  private readonly keyColor: Color;
  private readonly caps: InstancedMesh;
  private readonly tint = new Color();
  private readonly placement = new Object3D();

  constructor(accent: string, base = "#1d2540", keyColor = "#3a4466") {
    this.glow = new Color(accent);
    this.keyColor = new Color(keyColor);
    const widthKeys = rows[0]?.length ?? 10;
    const totalWidth = widthKeys * pitchX + 0.03;
    const totalDepth = (rows.length + 1) * pitchZ + 0.02;

    const plate = new Mesh(
      new BoxGeometry(totalWidth, 0.015, totalDepth),
      new MeshStandardMaterial({ color: base, roughness: 0.7 }),
    );
    plate.position.y = 0.0075;
    plate.receiveShadow = true;
    this.root.add(plate);

    const layout: { character: string | null; x: number; z: number; scaleX: number }[] = [];
    rows.forEach((row, rowIndex) => {
      const z = -totalDepth / 2 + 0.01 + pitchZ / 2 + rowIndex * pitchZ;
      const offset = rowIndex * 0.006;
      [...row].forEach((character, column) => {
        layout.push({ character, x: -totalWidth / 2 + 0.012 + pitchX / 2 + column * pitchX + offset, z, scaleX: 1 });
      });
    });
    const bottomZ = -totalDepth / 2 + 0.01 + pitchZ / 2 + rows.length * pitchZ;
    layout.push({ character: " ", x: 0, z: bottomZ, scaleX: 5.5 });
    layout.push({ character: "\n", x: totalWidth / 2 - 0.022, z: -totalDepth / 2 + 0.01 + pitchZ * 2.5, scaleX: 1.2 });

    this.caps = new InstancedMesh(
      new BoxGeometry(keyWidth, 0.01, keyDepth),
      new MeshStandardMaterial({ color: "#ffffff", roughness: 0.6 }),
      layout.length,
    );
    layout.forEach((slot, index) => {
      const key: Key = { index, x: slot.x, z: slot.z, scaleX: slot.scaleX, pressedFor: 0 };
      this.allKeys.push(key);
      if (slot.character !== null && slot.character !== " " && slot.character !== "\n") {
        this.keys.set(slot.character, key);
      }
      this.place(key, 0);
    });
    this.space = this.allKeys[layout.length - 2] as Key;
    this.enter = this.allKeys[layout.length - 1] as Key;
    this.root.add(this.caps);
  }

  press(character: string): void {
    this.keyFor(character).pressedFor = pressSeconds;
  }

  /** Top center of the key a character is typed on, in this keyboard's local space. */
  keyTop(character: string, out = new Vector3()): Vector3 {
    const key = this.keyFor(character);
    return out.set(key.x, keyTopY, key.z);
  }

  private keyFor(character: string): Key {
    if (character === " ") {
      return this.space;
    }
    if (character === "\n") {
      return this.enter;
    }
    const lower = character.toLowerCase();
    // Symbols without their own key land on a stable pseudo-random key so the motion still reads.
    return this.keys.get(lower) ?? this.allKeys[lower.charCodeAt(0) % this.allKeys.length] ?? this.space;
  }

  /** Sets one key's height and color, `amount` 0 at rest and 1 fully pressed and lit. */
  private place(key: Key, amount: number): void {
    this.placement.position.set(key.x, restY - pressDepth * amount, key.z);
    this.placement.scale.set(key.scaleX, 1, 1);
    this.placement.updateMatrix();
    this.caps.setMatrixAt(key.index, this.placement.matrix);
    this.caps.setColorAt(key.index, this.tint.copy(this.keyColor).lerp(this.glow, amount));
  }

  update(deltaSeconds: number): void {
    let changed = false;
    for (const key of this.allKeys) {
      if (key.pressedFor <= 0) {
        continue;
      }
      key.pressedFor = Math.max(0, key.pressedFor - deltaSeconds);
      this.place(key, key.pressedFor / pressSeconds);
      changed = true;
    }
    if (changed) {
      this.caps.instanceMatrix.needsUpdate = true;
      if (this.caps.instanceColor !== null) {
        this.caps.instanceColor.needsUpdate = true;
      }
    }
  }
}
