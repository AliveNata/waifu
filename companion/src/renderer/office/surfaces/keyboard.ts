import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial } from "three";

const rows = ["1234567890", "qwertyuiop", "asdfghjkl;", "zxcvbnm,./"];
const keySize = 0.032;
const keyGap = 0.006;
const pressDepth = 0.006;
const pressSeconds = 0.12;

interface Key {
  mesh: Mesh;
  material: MeshStandardMaterial;
  restY: number;
  pressedFor: number;
}

/** A small keyboard whose keys dip and light up as characters are typed on the matching screen. */
export class Keyboard {
  readonly root = new Group();
  private readonly keys = new Map<string, Key>();
  private readonly allKeys: Key[] = [];
  private readonly space: Key;
  private readonly enter: Key;
  private readonly glow: Color;
  private readonly keyColor: Color;

  constructor(accent: string, base = "#1d2540", keyColor = "#3a4466") {
    this.glow = new Color(accent);
    this.keyColor = new Color(keyColor);
    const pitch = keySize + keyGap;
    const widthKeys = rows[0]?.length ?? 10;
    const totalWidth = widthKeys * pitch + 0.03;
    const totalDepth = (rows.length + 1) * pitch + 0.02;

    const plate = new Mesh(
      new BoxGeometry(totalWidth, 0.015, totalDepth),
      new MeshStandardMaterial({ color: base, roughness: 0.7 }),
    );
    plate.position.y = 0.0075;
    plate.receiveShadow = true;
    this.root.add(plate);

    const geometry = new BoxGeometry(keySize, 0.01, keySize);
    const addKey = (x: number, z: number, scaleX = 1): Key => {
      const material = new MeshStandardMaterial({ color: this.keyColor.clone(), roughness: 0.6 });
      const mesh = new Mesh(geometry, material);
      mesh.scale.x = scaleX;
      mesh.position.set(x, 0.02, z);
      this.root.add(mesh);
      const key: Key = { mesh, material, restY: 0.02, pressedFor: 0 };
      this.allKeys.push(key);
      return key;
    };

    rows.forEach((row, rowIndex) => {
      const z = -totalDepth / 2 + 0.01 + pitch / 2 + rowIndex * pitch;
      const offset = rowIndex * 0.008;
      [...row].forEach((character, column) => {
        const x = -totalWidth / 2 + 0.015 + pitch / 2 + column * pitch + offset;
        this.keys.set(character, addKey(x, z));
      });
    });
    const bottomZ = -totalDepth / 2 + 0.01 + pitch / 2 + rows.length * pitch;
    this.space = addKey(0, bottomZ, 5.5);
    this.enter = addKey(totalWidth / 2 - 0.04, -totalDepth / 2 + 0.01 + pitch * 2.5, 1.6);
  }

  press(character: string): void {
    const lower = character.toLowerCase();
    let key: Key | undefined;
    if (character === " ") {
      key = this.space;
    } else if (character === "\n") {
      key = this.enter;
    } else {
      // Symbols without their own key land on a stable pseudo-random key so the motion still reads.
      key = this.keys.get(lower) ?? this.allKeys[lower.charCodeAt(0) % this.allKeys.length];
    }
    if (key !== undefined) {
      key.pressedFor = pressSeconds;
    }
  }

  update(deltaSeconds: number): void {
    for (const key of this.allKeys) {
      if (key.pressedFor <= 0) {
        continue;
      }
      key.pressedFor = Math.max(0, key.pressedFor - deltaSeconds);
      const amount = key.pressedFor / pressSeconds;
      key.mesh.position.y = key.restY - pressDepth * amount;
      key.material.color.copy(this.keyColor).lerp(this.glow, amount);
    }
  }
}
