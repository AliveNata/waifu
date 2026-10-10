/**
 * Browser fallback: serves the overlay and office pages plus the hook endpoint
 * without Electron. Useful for development and for machines where a
 * transparent always-on-top window is not wanted.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { resolveHookPort } from "../shared/protocol.js";
import { type MemberId, memberIds } from "../shared/team.js";
import { findBaseModel, repoRootFrom } from "../tools/base-model.js";
import { HookServer } from "./hook-server.js";

const staticDir = resolve(import.meta.dirname, "../../renderer");
/** WAIFU_MODEL_PATH is Konan's model, WAIFU_MODEL_PATH_<MEMBER> (e.g. WAIFU_MODEL_PATH_ASUNA) the others. */
function modelEnvVar(memberId: MemberId): string {
  return memberId === "konan" ? "WAIFU_MODEL_PATH" : `WAIFU_MODEL_PATH_${memberId.toUpperCase()}`;
}

const modelPaths: Partial<Record<MemberId, string>> = {};
for (const memberId of memberIds) {
  const envVar = modelEnvVar(memberId);
  const path = process.env[envVar];
  if (path === undefined || path === "") {
    continue;
  }
  if (!existsSync(path)) {
    console.error(`[web] ${envVar} does not exist: ${path}`);
    process.exit(1);
  }
  modelPaths[memberId] = path;
}

const server = new HookServer({
  host: "127.0.0.1",
  port: resolveHookPort(process.env),
  web: { staticDir, modelPaths, baseModelPath: findBaseModel(repoRootFrom(import.meta.dirname), process.env) },
});

const port = await server.listen();
console.log(`[web] overlay: http://127.0.0.1:${port}/overlay/`);
console.log(`[web] office:  http://127.0.0.1:${port}/office/`);
console.log(`[web] team:    http://127.0.0.1:${port}/team-overlay/`);

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
