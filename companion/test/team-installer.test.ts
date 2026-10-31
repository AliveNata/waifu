import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { applyInstall, blockEnd, blockStart, planInstall, upsertMarkedBlock } from "../src/team/team-installer.js";

const teamDir = resolve(import.meta.dirname, "../../team");

describe("upsertMarkedBlock", () => {
  it("appends to existing content without touching it", () => {
    // Act
    const result = upsertMarkedBlock("# My rules\n\nBe brief.\n", "2B");

    // Assert
    expect(result).toBe(`# My rules\n\nBe brief.\n\n${blockStart}\n2B\n${blockEnd}\n`);
  });

  it("replaces only the marked block on reinstall", () => {
    // Arrange
    const first = upsertMarkedBlock("before\n", "old");
    const edited = `${first}after\n`;

    // Act
    const result = upsertMarkedBlock(edited, "new");

    // Assert
    expect(result).toBe(`before\n\n${blockStart}\nnew\n${blockEnd}\nafter\n`);
  });
});

describe("team install", () => {
  it("creates every agent and the 2B block on a clean config", async () => {
    // Arrange
    const configDir = await mkdtemp(join(tmpdir(), "claude-config-"));

    // Act
    const changes = await planInstall(teamDir, configDir);
    await applyInstall(changes, "t1");

    // Assert
    expect(changes.every((change) => change.action === "create")).toBe(true);
    expect((await readdir(join(configDir, "agents"))).sort()).toEqual([
      "arisu.md",
      "asuna.md",
      "chizuru.md",
      "erza.md",
      "huagua.md",
      "kobayashi.md",
      "komachi.md",
      "miruku.md",
      "rias.md",
      "ruby.md",
      "yor.md",
    ]);
    expect(await readFile(join(configDir, "CLAUDE.md"), "utf8")).toContain("2B: personal assistant");
  });

  it("is a no-op the second time", async () => {
    // Arrange
    const configDir = await mkdtemp(join(tmpdir(), "claude-config-"));
    await applyInstall(await planInstall(teamDir, configDir), "t1");

    // Act
    const changes = await planInstall(teamDir, configDir);

    // Assert
    expect(changes.every((change) => change.action === "unchanged")).toBe(true);
  });

  it("backs up a hand-edited agent before overwriting it", async () => {
    // Arrange
    const configDir = await mkdtemp(join(tmpdir(), "claude-config-"));
    await mkdir(join(configDir, "agents"), { recursive: true });
    await writeFile(join(configDir, "agents", "erza.md"), "my own erza", "utf8");

    // Act
    const backups = await applyInstall(await planInstall(teamDir, configDir), "t2");

    // Assert
    expect(backups).toEqual([join(configDir, "agents", "erza.md.bak-t2")]);
    expect(await readFile(backups[0] as string, "utf8")).toBe("my own erza");
  });

  it("retires the agents it installed under their old role names, keeping a backup", async () => {
    // Arrange: an install from before the rename, plus someone's own agent that shares an old name.
    const configDir = await mkdtemp(join(tmpdir(), "claude-config-"));
    await mkdir(join(configDir, "agents"), { recursive: true });
    const oldReviewer = "---\nname: reviewer\n---\nYou are Erza, the reviewer in 2B's team.";
    await writeFile(join(configDir, "agents", "reviewer.md"), oldReviewer, "utf8");
    await writeFile(join(configDir, "agents", "architect.md"), "my own architect", "utf8");

    // Act
    const changes = await planInstall(teamDir, configDir);
    const backups = await applyInstall(changes, "t3");

    // Assert
    const agents = (await readdir(join(configDir, "agents"))).sort();
    expect(agents).not.toContain("reviewer.md");
    expect(agents).toContain("architect.md");
    expect(backups).toEqual([join(configDir, "agents", "reviewer.md.bak-t3")]);
    expect(await readFile(backups[0] as string, "utf8")).toBe(oldReviewer);
  });

  it("ships valid frontmatter with a name matching the file", async () => {
    // Arrange
    const files = (await readdir(join(teamDir, "agents"))).filter((name) => name.endsWith(".md"));

    for (const file of files) {
      // Act
      const text = await readFile(join(teamDir, "agents", file), "utf8");
      const frontmatter = /^---\n([\s\S]+?)\n---\n/.exec(text)?.[1] ?? "";

      // Assert
      expect(frontmatter).toMatch(new RegExp(`^name: ${file.replace(".md", "")}$`, "m"));
      expect(frontmatter).toMatch(/^description: .{40,}$/m);
      expect(frontmatter).toMatch(/^tools: /m);
    }
  });
});
