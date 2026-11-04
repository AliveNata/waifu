import { Box3, type Mesh, type MeshStandardMaterial, Texture, Vector3 } from "three";
import { beforeAll, describe, expect, it } from "vitest";
import { furniture, room } from "../src/renderer/office/office-plan.js";
import { buildEnclosure, wallArts } from "../src/renderer/office/scene/enclosure.js";
import { entryDoorHeight } from "../src/renderer/office/scene/furniture.js";
import { setSceneQuality } from "../src/renderer/office/scene/palette.js";
import type { WallArt } from "../src/renderer/office/scene/textures.js";

// High quality paints surface textures on a DOM canvas, which Node has none of; geometry is the same.
beforeAll(() => setSceneQuality("low"));

function solidParts(): Box3[] {
  const { root } = buildEnclosure(() => new Texture());
  root.updateMatrixWorld(true);
  const boxes: Box3[] = [];
  root.traverse((node) => {
    const part = node as Mesh;
    if (part.isMesh === true && (part as { isInstancedMesh?: boolean }).isInstancedMesh !== true) {
      boxes.push(new Box3().setFromObject(part));
    }
  });
  return boxes;
}

describe("the room seen from inside", () => {
  it("leaves the glass door's opening clear in the right wall", () => {
    // Arrange
    const door = furniture.find((piece) => piece.id === "entry-door");
    const boxes = solidParts();

    // Act: points through the doorway at knee, waist and head height of someone walking out.
    const blocked = [0.3, 0.8, entryDoorHeight - 0.05]
      .flatMap((y) => [-0.6, 0, 0.6].map((offset) => new Vector3(room.maxX + 0.06, y, (door?.z ?? 0) + offset)))
      .filter((point) => boxes.some((box) => box.containsPoint(point)));

    // Assert
    expect(door).toBeDefined();
    expect(blocked).toEqual([]);
  });

  it("closes the right wall beside the door, the front wall and the ceiling", () => {
    // Arrange
    const boxes = solidParts();
    const solid = (point: Vector3): boolean => boxes.some((box) => box.containsPoint(point));

    // Act
    const rightWall = solid(new Vector3(room.maxX + 0.06, 1, room.minZ + 1));
    const frontWall = solid(new Vector3(0, 1, room.maxZ + 0.06));
    const ceiling = solid(new Vector3(0, room.wallHeight + 0.06, 0));
    const overDoor = solid(new Vector3(room.maxX + 0.06, room.wallHeight - 0.1, -0.45));

    // Assert
    expect({ rightWall, frontWall, ceiling, overDoor }).toEqual({
      rightWall: true,
      frontWall: true,
      ceiling: true,
      overDoor: true,
    });
  });

  it("dims the ceiling lights with the room and never below off", () => {
    // Arrange
    const enclosure = buildEnclosure(() => new Texture());
    const glows = (): number[] => {
      const levels: number[] = [];
      enclosure.root.traverse((node) => {
        const material = (node as Mesh).material as MeshStandardMaterial | undefined;
        // Only the parts that glow: plain walls carry the default intensity with a black emissive.
        if (material?.emissive !== undefined && material.emissive.getHex() !== 0 && material.emissiveIntensity > 0) {
          levels.push(material.emissiveIntensity);
        }
      });
      return levels;
    };
    const day = glows();

    // Act
    enclosure.setLight(0.4);
    const evening = glows();
    enclosure.setLight(-1);
    const off = glows();

    // Assert
    expect(day.length).toBeGreaterThan(0);
    expect(evening.every((level, index) => level < (day[index] ?? 0))).toBe(true);
    expect(off).toEqual([]);
  });

  it("paints each piece of lettering once: the sentence chain, the script line and the manifesto", () => {
    // Arrange
    const painted: WallArt[] = [];

    // Act
    buildEnclosure((art) => {
      painted.push(art);
      return new Texture();
    });

    // Assert
    expect(painted).toEqual([...wallArts]);
    expect(new Set(painted)).toEqual(new Set(["block", "script", "manifesto"]));
  });
});
