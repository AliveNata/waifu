import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";
import { collectLiveParts, mergeStaticMeshes } from "../src/renderer/office/scene/merge-static.js";

function box(color: string, x: number): Mesh {
  const mesh = new Mesh(new BoxGeometry(0.1, 0.1, 0.1), new MeshStandardMaterial({ color, roughness: 0.5 }));
  mesh.position.x = x;
  return mesh;
}

function meshCount(root: Group): number {
  let count = 0;
  root.traverse((node) => {
    if ((node as Mesh).isMesh === true) {
      count += 1;
    }
  });
  return count;
}

describe("mergeStaticMeshes", () => {
  it("bakes boxes that look the same into one mesh, keeping where they were", () => {
    // Arrange: two separate but identical materials, one box nested and moved.
    const root = new Group();
    const inner = new Group();
    inner.position.set(0, 1, 0);
    inner.add(box("#ff0000", 2));
    root.add(box("#ff0000", 0), inner);

    // Act
    const result = mergeStaticMeshes(root, { objects: new Set(), materials: new Set() });

    // Assert
    expect(result).toEqual({ merged: 2, into: 1 });
    expect(meshCount(root)).toBe(1);
    const merged = root.children.find((child) => child.name === "merged-static") as Mesh;
    merged.geometry.computeBoundingBox();
    expect(merged.geometry.boundingBox?.max.x).toBeCloseTo(2.05);
    expect(merged.geometry.boundingBox?.max.y).toBeCloseTo(1.05);
  });

  it("keeps different looks apart", () => {
    // Arrange
    const root = new Group();
    root.add(box("#ff0000", 0), box("#00ff00", 1));

    // Act
    const result = mergeStaticMeshes(root, { objects: new Set(), materials: new Set() });

    // Assert
    expect(result.into).toBe(0);
    expect(meshCount(root)).toBe(2);
  });

  it("leaves alone anything the office still moves or recolors, and screens", () => {
    // Arrange
    const root = new Group();
    const door = new Group();
    door.add(box("#ff0000", 0), box("#ff0000", 1));
    const lamp = box("#ff0000", 2);
    const screen = new Mesh(new BoxGeometry(0.1, 0.1, 0.1), new MeshBasicMaterial());
    root.add(door, lamp, screen, box("#ff0000", 3));
    const live = collectLiveParts({ entryDoor: { panels: [door] }, lamp: { bulb: lamp.material } }, [root]);

    // Act
    const result = mergeStaticMeshes(root, live);

    // Assert: only one static red box is left over, so there is nothing to merge it with.
    expect(result.into).toBe(0);
    expect(meshCount(root)).toBe(5);
  });
});
