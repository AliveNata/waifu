/**
 * Adds the companion hooks to the user's Claude Code settings.json:
 *   npm run hooks:install -- --dry-run     (show what would change)
 *   npm run hooks:install                  (apply, with a backup)
 *   npm run hooks:install -- --uninstall   (remove only the companion hooks)
 */
import { resolve } from "node:path";
import { applyInstall, claudeConfigDir } from "../team/team-installer.js";
import { buildHooksConfig } from "./hooks-config.js";
import { planHooksInstall } from "./hooks-installer.js";

const dryRun = process.argv.includes("--dry-run");
const uninstall = process.argv.includes("--uninstall");
const bridgeScript = resolve(import.meta.dirname, "send-hook-event.js");
const configDir = claudeConfigDir(process.env);

try {
  const change = await planHooksInstall(configDir, uninstall ? null : buildHooksConfig(bridgeScript));
  console.log(`${dryRun ? "[dry-run] " : ""}${uninstall ? "Hapus" : "Pasang"} hooks companion`);
  console.log(`  ${change.action.padEnd(9)} ${change.target}`);
  if (!uninstall) {
    console.log(`  bridge    ${bridgeScript}`);
  }
  if (dryRun) {
    if (change.action !== "unchanged") {
      console.log("\nIsi settings.json setelah diubah:\n");
      console.log(change.content);
    }
    console.log("Belum ada yang ditulis. Jalanin tanpa --dry-run buat nerapin.");
  } else if (change.action === "unchanged") {
    console.log("Udah sesuai, nggak ada yang ditulis.");
  } else {
    const timestamp = new Date().toISOString().replaceAll(":", "-").replace(/\..+$/, "");
    for (const backup of await applyInstall([change], timestamp)) {
      console.log(`  backup    ${backup}`);
    }
    console.log("Selesai. Restart Claude Code, lalu cek pakai /hooks.");
  }
} catch (error) {
  console.error(`[hooks:install] ${(error as Error).message}`);
  process.exitCode = 1;
}
