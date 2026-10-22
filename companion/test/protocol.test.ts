import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultHookPort, ipcChannels, isOfficeQuality, resolveHookPort } from "../src/shared/protocol.js";

describe("resolveHookPort", () => {
  it("defaults when the env var is missing", () => {
    expect(resolveHookPort({})).toBe(defaultHookPort);
  });

  it("reads a valid port", () => {
    expect(resolveHookPort({ WAIFU_COMPANION_PORT: "50000" })).toBe(50000);
  });

  it.each(["abc", "0", "70000", "1.5"])("rejects %s", (value) => {
    expect(() => resolveHookPort({ WAIFU_COMPANION_PORT: value })).toThrow(/WAIFU_COMPANION_PORT/);
  });
});

describe("preload channel names", () => {
  it("match the shared protocol, since the sandboxed preload cannot import them", () => {
    // Arrange
    const preloadSource = readFileSync(resolve(import.meta.dirname, "../src/main/preload.cts"), "utf8");

    // Act
    const missing = Object.values(ipcChannels).filter((channel) => !preloadSource.includes(`"${channel}"`));

    // Assert
    expect(missing).toEqual([]);
  });
});

describe("isOfficeQuality", () => {
  it.each(["high", "low"])("accepts %s", (value) => {
    expect(isOfficeQuality(value)).toBe(true);
  });

  it.each(["medium", "", null, 1])("rejects %s", (value) => {
    expect(isOfficeQuality(value)).toBe(false);
  });
});
