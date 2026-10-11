import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Anime-style stand-in for team members without their own .vrm: the official
 * VRM 1.0 sample from the three-vrm repository. Its embedded license allows use
 * by anyone, modification and redistribution (checked with inspect-vrm). The
 * URL is pinned to a release tag and the hash guards against a changed file.
 */
export const baseModel = {
  url: "https://raw.githubusercontent.com/pixiv/three-vrm/v3.5.5/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm",
  sha256: "12c2b97e95e700783a6a550dc0eee2d7880aeedccef9ae67bc4c5a2f0f2631a2",
  fileName: "VRM1_Constraint_Twist_Sample.vrm",
} as const;

export const baseModelEnvVar = "WAIFU_BASE_MODEL_PATH";

/** Compiled files live in companion/dist/node/<dir>/, four levels below the repository root. */
export function repoRootFrom(compiledDir: string): string {
  return resolve(compiledDir, "../../../..");
}

export function defaultBaseModelPath(repoRoot: string): string {
  return join(repoRoot, "models", "base", baseModel.fileName);
}

/** The base model path if the file exists, honoring the env override. */
export function findBaseModel(repoRoot: string, env: Record<string, string | undefined>): string | null {
  const override = env[baseModelEnvVar];
  const path = override !== undefined && override !== "" ? override : defaultBaseModelPath(repoRoot);
  return existsSync(path) ? path : null;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
