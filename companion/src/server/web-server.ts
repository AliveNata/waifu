/**
 * Browser fallback: serves the overlay and office pages plus the hook endpoint
 * without Electron. Useful for development and for machines where a
 * transparent always-on-top window is not wanted.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { resolveHookPort } from "../shared/protocol.js";
import { HookServer } from "./hook-server.js";

const staticDir = resolve(import.meta.dirname, "../../renderer");
const modelPath = process.env.WAIFU_MODEL_PATH ?? null;

if (modelPath !== null && !existsSync(modelPath)) {
  console.error(`[web] WAIFU_MODEL_PATH does not exist: ${modelPath}`);
  process.exit(1);
}

const server = new HookServer({
  host: "127.0.0.1",
  port: resolveHookPort(process.env),
  web: { staticDir, modelPath },
});

const port = await server.listen();
console.log(`[web] overlay: http://127.0.0.1:${port}/overlay/`);
console.log(`[web] office:  http://127.0.0.1:${port}/office/`);

const shutdown = (): void => {
  server
    .close()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("[web] failed to close server", error);
      process.exit(1);
    });
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
