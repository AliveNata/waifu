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
    const settings = {
      modelPaths: { twob: "C:/models/twob.vrm" },
      alwaysOnTop: false,
      officeOpen: true,
      conversationMode: "real" as const,
      closeupEnabled: false,
      chatEnabled: false,
      chatProjectDir: "C:/work/waifu",
      chatSessionId: "session-1",
    };

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

  it("ignores wrongly typed fields and unknown members", () => {
    expect(
      normalizeSettings({ modelPaths: { asuna: 3, nobody: "x.vrm" }, alwaysOnTop: "yes", officeOpen: true }),
    ).toEqual({ ...defaultSettings, officeOpen: true });
  });

  it("migrates the single modelPath from before the team existed", () => {
    expect(normalizeSettings({ modelPath: "C:/old.vrm" }).modelPaths).toEqual({ twob: "C:/old.vrm" });
  });
});
