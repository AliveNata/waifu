import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultSettings, loadSettings, normalizeSettings, saveSettings } from "../src/main/settings-store.js";

describe("settings store", () => {
  it("returns defaults when the file does not exist", async () => {
    // Arrange
    const dir = await mkdtemp(join(tmpdir(), "companion-"));

    // Act
    const settings = await loadSettings(join(dir, "missing.json"));

    // Assert
    expect(settings).toEqual(defaultSettings);
  });

  it("round-trips saved settings", async () => {
    // Arrange
    const file = join(await mkdtemp(join(tmpdir(), "companion-")), "nested", "settings.json");
    const settings = { modelPath: "C:/models/xenovia.vrm", alwaysOnTop: false, officeOpen: true };

    // Act
    await saveSettings(file, settings);

    // Assert
    expect(await loadSettings(file)).toEqual(settings);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual(settings);
  });

  it("falls back to defaults for corrupt JSON", async () => {
    // Arrange
    const file = join(await mkdtemp(join(tmpdir(), "companion-")), "settings.json");
    await writeFile(file, "{oops", "utf8");

    // Act
    const settings = await loadSettings(file);

    // Assert
    expect(settings).toEqual(defaultSettings);
  });

  it("ignores wrongly typed fields", () => {
    expect(normalizeSettings({ modelPath: 3, alwaysOnTop: "yes", officeOpen: true })).toEqual({
      ...defaultSettings,
      officeOpen: true,
    });
  });
});
