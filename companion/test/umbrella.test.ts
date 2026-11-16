import { Box3 } from "three";
import { beforeAll, describe, expect, it } from "vitest";
import { furniture, room } from "../src/renderer/office/office-plan.js";
import { handPropModel } from "../src/renderer/office/scene/hand-props.js";
import { setSceneQuality } from "../src/renderer/office/scene/palette.js";
import { UmbrellaStand, umbrellaModel } from "../src/renderer/office/scene/umbrella.js";
import { memberIds } from "../src/shared/team.js";

beforeAll(() => setSceneQuality("low"));

function standPiece() {
  const piece = furniture.find((candidate) => candidate.id === "umbrella-stand");
  if (piece === undefined) {
    throw new Error("no umbrella stand on the floor plan");
  }
  return piece;
}

describe("umbrellas", () => {
  it("hangs a closed umbrella from the hand, about knee to hand long for the team", () => {
    // Act
    const bounds = new Box3().setFromObject(umbrellaModel("#e35d5d"));

    // Assert: the crook just above the grip, the tip a bit over half a meter below it.
    expect(bounds.max.y).toBeGreaterThan(0.03);
    expect(bounds.max.y).toBeLessThan(0.08);
    expect(bounds.min.y).toBeLessThan(-0.5);
    expect(bounds.min.y).toBeGreaterThan(-0.65);
    expect(bounds.max.x - bounds.min.x).toBeLessThan(0.1);
  });

  it("is a hand prop like any other", () => {
    // Act
    const prop = handPropModel("umbrella", { mug: "#8a5fd0", shell: "#2c2a33" });

    // Assert
    expect(prop.children.length).toBeGreaterThan(0);
  });

  it("stands by the door, inside the room, with everyone's umbrella in it only while they are in", () => {
    // Arrange
    const piece = standPiece();
    const stand = new UmbrellaStand(
      piece,
      Object.fromEntries(memberIds.map((memberId) => [memberId, "#888888"])) as Record<
        (typeof memberIds)[number],
        string
      >,
    );
    const shown = () => stand.root.children.filter((child) => child.visible).length;
    const fixed = shown();

    // Act
    stand.show(new Set(["asuna", "yor"]));
    const two = shown() - fixed;
    stand.show(new Set());
    const none = shown() - fixed;

    // Assert
    expect(piece.x + piece.width / 2).toBeLessThan(room.maxX);
    expect(two).toBe(2);
    expect(none).toBe(0);
    stand.root.updateMatrixWorld(true);
    // Every umbrella stays within a hand's width of the stand, leaning out of the bin but not over.
    const bounds = new Box3().setFromObject(stand.root);
    expect(bounds.max.x - bounds.min.x).toBeLessThan(0.45);
  });
});
