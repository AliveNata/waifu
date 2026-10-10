import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildHooksConfig } from "../src/bridge/hooks-config.js";
import { mergeHooks, planHooksInstall } from "../src/bridge/hooks-installer.js";
import { applyInstall } from "../src/team/team-installer.js";

const bridge = "C:\\Users\\me\\waifu\\companion\\dist\\node\\bridge\\send-hook-event.js";
const config = buildHooksConfig(bridge);
const ourCommand = 'node "C:/Users/me/waifu/companion/dist/node/bridge/send-hook-event.js"';

async function configDirWith(settings: string | null): Promise<string> {
  const configDir = await mkdtemp(join(tmpdir(), "claude-hooks-"));
  if (settings !== null) {
    await writeFile(join(configDir, "settings.json"), settings, "utf8");
  }
  return configDir;
}

describe("mergeHooks", () => {
  it("keeps other hooks and replaces a stale companion path", () => {
    // Arrange
    const settings = {
      theme: "dark",
      hooks: {
        PreToolUse: [
          { matcher: "Bash", hooks: [{ type: "command", command: "my-guard.sh" }] },
          { matcher: "*", hooks: [{ type: "command", command: 'node "D:/old/bridge/send-hook-event.js"' }] },
        ],
      },
    };

    // Act
    const merged = mergeHooks(settings, config) as { theme: string; hooks: Record<string, unknown[]> };

    // Assert
    expect(merged.theme).toBe("dark");
    expect(merged.hooks.PreToolUse).toEqual([
      { matcher: "Bash", hooks: [{ type: "command", command: "my-guard.sh" }] },
      { matcher: "*", hooks: [{ type: "command", command: ourCommand, async: true }] },
    ]);
  });

  it("removes only the companion hooks on uninstall", () => {
    // Arrange
    const installed = mergeHooks({ theme: "dark" }, config);

    // Act
    const removed = mergeHooks(installed, null);

    // Assert
    expect(removed).toEqual({ theme: "dark" });
  });

  it("refuses a hooks value that is not an object", () => {
    expect(() => mergeHooks({ hooks: [] }, config)).toThrow(/bukan object/);
  });
});

describe("planHooksInstall", () => {
  it("creates settings.json when it does not exist", async () => {
    // Arrange
    const configDir = await configDirWith(null);

    // Act
    const change = await planHooksInstall(configDir, config);

    // Assert
    expect(change.action).toBe("create");
    expect(JSON.parse(change.content).hooks.SubagentStart).toHaveLength(1);
  });

  it("reports unchanged for an installed config even with a different key order", async () => {
    // Arrange: hand-merged by the user, with "matcher" before "hooks" in the tool events.
    const handMerged = {
      theme: "dark",
      hooks: Object.fromEntries(
        Object.entries(config.hooks).map(([eventName, groups]) => [
          eventName,
          (groups ?? []).map((group) => (group.matcher === undefined ? group : { matcher: group.matcher, ...group })),
        ]),
      ),
    };
    const configDir = await configDirWith(JSON.stringify(handMerged, null, 2));

    // Act
    const change = await planHooksInstall(configDir, config);

    // Assert
    expect(change.action).toBe("unchanged");
  });

  it("backs up and updates, and a second run changes nothing", async () => {
    // Arrange
    const configDir = await configDirWith('{\n  "theme": "dark"\n}\n');

    // Act
    const first = await planHooksInstall(configDir, config);
    const backups = await applyInstall([first], "t1");
    const second = await planHooksInstall(configDir, config);

    // Assert
    expect(first.action).toBe("update");
    expect(backups).toEqual([join(configDir, "settings.json.bak-t1")]);
    expect(await readFile(backups[0] as string, "utf8")).toBe('{\n  "theme": "dark"\n}\n');
    expect(second.action).toBe("unchanged");
  });

  it("refuses invalid JSON without touching the file", async () => {
    // Arrange
    const configDir = await configDirWith('{ "theme": "dark", }');

    // Act
    const attempt = planHooksInstall(configDir, config);

    // Assert
    await expect(attempt).rejects.toThrow(/bukan JSON valid/);
    expect(await readFile(join(configDir, "settings.json"), "utf8")).toBe('{ "theme": "dark", }');
  });
});

describe("backups", () => {
  it("never overwrites an earlier backup from the same second", async () => {
    // Arrange
    const configDir = await configDirWith('{\n  "theme": "dark"\n}\n');

    // Act
    const installBackups = await applyInstall([await planHooksInstall(configDir, config)], "t1");
    const uninstallBackups = await applyInstall([await planHooksInstall(configDir, null)], "t1");

    // Assert
    expect(installBackups).toEqual([join(configDir, "settings.json.bak-t1")]);
    expect(uninstallBackups).toEqual([join(configDir, "settings.json.bak-t1-2")]);
    expect(await readFile(join(configDir, "settings.json.bak-t1"), "utf8")).toBe('{\n  "theme": "dark"\n}\n');
  });
});
