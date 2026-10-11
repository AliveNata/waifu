/**
 * Downloads the anime base model used for team members without their own .vrm:
 *   npm run fetch-base-model
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { baseModel, defaultBaseModelPath, repoRootFrom, sha256Hex } from "./base-model.js";

const target = defaultBaseModelPath(repoRootFrom(import.meta.dirname));

async function existingHash(): Promise<string | null> {
  try {
    return sha256Hex(await readFile(target));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

if ((await existingHash()) === baseModel.sha256) {
  console.log(`Base model sudah ada: ${target}`);
  process.exit(0);
}

console.log(`Download ${baseModel.url}`);
const response = await fetch(baseModel.url);
if (!response.ok) {
  console.error(`Download gagal: HTTP ${response.status}`);
  process.exit(1);
}
const bytes = new Uint8Array(await response.arrayBuffer());
const hash = sha256Hex(bytes);
if (hash !== baseModel.sha256) {
  console.error(`Hash tidak cocok, file tidak disimpan.\n  diharapkan: ${baseModel.sha256}\n  didapat:    ${hash}`);
  process.exit(1);
}

await mkdir(dirname(target), { recursive: true });
await writeFile(`${target}.tmp`, bytes);
await rename(`${target}.tmp`, target);
console.log(`Tersimpan: ${target} (${(bytes.length / 1024 / 1024).toFixed(1)} MB)`);
