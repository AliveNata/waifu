import { Box3, Group } from "three";
import { describe, expect, it } from "vitest";
import { furniture, room, stations } from "../src/renderer/office/office-plan.js";
import { portraitSize, teamDialogDock } from "../src/renderer/office/office-stage.js";
import { buildFridge, FridgeDoor } from "../src/renderer/office/scene/furniture.js";

describe("FridgeDoor", () => {
  it("swings outward while someone is at the fridge and closes after", () => {
    // Arrange
    const hinge = new Group();
    const door = new FridgeDoor(hinge);

    // Act
    for (let frame = 0; frame < 60; frame++) {
      door.update(true, 1 / 30);
    }
    const openYaw = hinge.rotation.y;
    for (let frame = 0; frame < 60; frame++) {
      door.update(false, 1 / 30);
    }

    // Assert: negative yaw swings a left-hinged door toward the person, short of hitting the wall.
    expect(openYaw).toBeLessThan(-1.3);
    expect(openYaw).toBeGreaterThan(-Math.PI / 2);
    expect(hinge.rotation.y).toBeCloseTo(0, 2);
  });

  it("moves part of the way in one frame instead of snapping", () => {
    // Arrange
    const hinge = new Group();
    const door = new FridgeDoor(hinge);

    // Act
    door.update(true, 1 / 60);

    // Assert
    expect(hinge.rotation.y).toBeLessThan(0);
    expect(hinge.rotation.y).toBeGreaterThan(-0.5);
  });
});

describe("buildFridge", () => {
  it("opens the door inside the room and clear of the person grabbing a snack", () => {
    // Arrange
    const piece = furniture.find((candidate) => candidate.kind === "fridge");
    if (piece === undefined) {
      throw new Error("floor plan has no fridge");
    }
    const { root, door } = buildFridge(piece);

    // Act
    for (let frame = 0; frame < 120; frame++) {
      door.update(true, 1 / 30);
    }
    root.updateMatrixWorld(true);
    const hinge = root.children.at(-1);
    if (hinge === undefined) {
      throw new Error("fridge has no door");
    }
    const swept = new Box3().setFromObject(hinge);

    // Assert: inside the left wall, and the snacker (about 0.2 wide) stands beside the door, not in it.
    const snacker = stations.fridge.spot;
    expect(swept.min.x).toBeGreaterThan(room.minX);
    expect(swept.max.x).toBeLessThan(snacker.x - 0.2);
    expect(swept.max.z).toBeGreaterThan(piece.z + piece.depth / 2);
  });
});

describe("teamDialogDock", () => {
  it("puts the portrait in the top right with the dialog just under it, overlapping its bottom", () => {
    // Act
    const dock = teamDialogDock(1280);

    // Assert
    expect(dock.dialog.x + dock.dialog.width).toBe(1280 - 16);
    expect(dock.portrait.y).toBe(16);
    expect(dock.dialog.y).toBeLessThan(dock.portrait.y + portraitSize.height);
    expect(dock.dialog.y).toBeGreaterThan(dock.portrait.y + portraitSize.height - 30);
    expect(dock.portrait.x + portraitSize.width).toBeLessThanOrEqual(dock.dialog.x + dock.dialog.width);
  });
});
