import { Box3 } from "three";
import { beforeAll, describe, expect, it } from "vitest";
import { bentoOf } from "../src/renderer/office/scene/bento-models.js";
import { LunchBox, lunchOffset } from "../src/renderer/office/scene/lunch-box.js";
import { setSceneQuality } from "../src/renderer/office/scene/palette.js";
import { memberIds } from "../src/shared/team.js";

// Plain materials: the detail maps need a canvas, which tests do not have.
beforeAll(() => setSceneQuality("low"));

describe("lunch boxes", () => {
  it("gives every member a lunch of their own", () => {
    // Act
    const menus = memberIds.map((memberId) => bentoOf[memberId]);

    // Assert
    expect(new Set(menus).size).toBe(memberIds.length);
  });

  it("keeps a lunch on the table, its near edge short of the table's edge", () => {
    // Arrange: a side seat's spot is 0.23 from the edge; a tray up to 0.2 deep.
    const reach = 0.23;

    for (const depth of [0.08, 0.14, 0.2]) {
      // Act
      const middle = lunchOffset(reach, depth);

      // Assert
      expect(middle + depth / 2).toBeLessThan(reach);
      expect(middle).toBeGreaterThanOrEqual(0);
    }
  });

  it("never sets a lunch behind the laptop spot, even where the table is shallow", () => {
    // Act
    const middle = lunchOffset(0.05, 0.2);

    // Assert
    expect(middle).toBe(0);
  });

  it("shows the plain bento for whoever sits down when their model is not loaded, and clears it after", () => {
    // Arrange: no models load under test.
    const tableTop = 0.73;
    const lunch = new LunchBox(tableTop, 0.23);

    // Act
    lunch.serve("asuna");
    lunch.root.updateMatrixWorld(true);
    const top = lunch.top();
    const shown = lunch.root.children.filter((child) => child.visible);
    const bounds = new Box3();
    for (const part of shown) {
      bounds.expandByObject(part);
    }
    lunch.serve(null);

    // Assert
    expect(shown).toHaveLength(1);
    expect(top.y).toBeGreaterThan(tableTop);
    expect(bounds.max.z).toBeLessThan(0.23);
    expect(lunch.root.visible).toBe(false);
  });
});
