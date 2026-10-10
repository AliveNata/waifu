import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findMemberModel, memberModelFileNames } from "../src/tools/member-models.js";

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
