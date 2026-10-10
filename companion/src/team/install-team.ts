/**
 * Installs the agent team into the user's Claude Code config:
 *   npm run team:install -- --dry-run   (show what would change)
 *   npm run team:install                (apply)
 */
import { resolve } from "node:path";
import { applyInstall, claudeConfigDir, planInstall } from "./team-installer.js";

const dryRun = process.argv.includes("--dry-run");
const teamDir = resolve(import.meta.dirname, "../../../../team");
const configDir = claudeConfigDir(process.env);

const changes = await planInstall(teamDir, configDir);
console.log(`${dryRun ? "[dry-run] " : ""}Claude config: ${configDir}`);
for (const change of changes) {
  console.log(`  ${change.action.padEnd(9)} ${change.target}`);
}

if (dryRun) {
  console.log("Nothing written. Run without --dry-run to apply.");
} else {
  const timestamp = new Date().toISOString().replaceAll(":", "-").replace(/\..+$/, "");
  const backups = await applyInstall(changes, timestamp);
  for (const backup of backups) {
    console.log(`  backup    ${backup}`);
  }
  console.log("Done. Restart Claude Code so it picks up the agents and the 2B block.");
}
