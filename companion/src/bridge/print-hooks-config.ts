/**
 * Prints the "hooks" block for ~/.claude/settings.json with the absolute path
 * of this checkout filled in, so nobody has to hand-escape Windows paths.
 */
import { resolve } from "node:path";
import { buildHooksConfig } from "./hooks-config.js";

const bridgeScript = resolve(import.meta.dirname, "send-hook-event.js");
console.log(JSON.stringify(buildHooksConfig(bridgeScript), null, 2));
