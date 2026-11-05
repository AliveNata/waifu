import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findCourierModel, findLocalProp, findMemberModel, memberModelFileNames } from "../src/tools/member-models.js";

const repoRoot = join("repo");

describe("memberModelFileNames", () => {
  it("prefers the display name and falls back to the id", () => {
    expect(memberModelFileNames("twob")).toEqual(["2b.vrm", "twob.vrm"]);
  });

  it("lists one name when display name and id match", () => {
    expect(memberModelFileNames("ruby")).toEqual(["ruby.vrm"]);
  });
});

describe("findMemberModel", () => {
  it("finds a model saved under the display name", () => {
    // Arrange
    const existing = new Set([join(repoRoot, "models", "2b.vrm")]);

    // Act
    const path = findMemberModel(repoRoot, "twob", (candidate) => existing.has(candidate));

    // Assert
    expect(path).toBe(join(repoRoot, "models", "2b.vrm"));
  });

  it("returns null when the member has no file", () => {
    // Act
    const path = findMemberModel(repoRoot, "erza", () => false);

    // Assert
    expect(path).toBeNull();
  });
});

describe("findCourierModel", () => {
  it("finds courier.vrm in models/", () => {
    // Arrange
    const existing = new Set([join(repoRoot, "models", "courier.vrm")]);

    // Act
    const path = findCourierModel(repoRoot, (candidate) => existing.has(candidate));

    // Assert
    expect(path).toBe(join(repoRoot, "models", "courier.vrm"));
  });

  it("returns null without a courier model", () => {
    // Act
    const path = findCourierModel(repoRoot, () => false);

    // Assert
    expect(path).toBeNull();
  });
});

describe("findLocalProp", () => {
  it("finds a local-only prop in models/ by its name", () => {
    // Arrange
    const existing = new Set([join(repoRoot, "models", "punching-bag.glb")]);

    // Act
    const bag = findLocalProp(repoRoot, "punching-bag", (candidate) => existing.has(candidate));
    const arcade = findLocalProp(repoRoot, "arcade-elben", (candidate) => existing.has(candidate));

    // Assert
    expect(bag).toBe(join(repoRoot, "models", "punching-bag.glb"));
    expect(arcade).toBeNull();
  });
});
