/**
 * Prints the license a .vrm declares, with a verdict for the companion and VRChat:
 *   npm run inspect-vrm -- path/to/model.vrm
 */
import { readFile } from "node:fs/promises";
import { formatLicenseReport, readGlbJson, readVrmLicense } from "./vrm-license.js";

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error("Pakai: npm run inspect-vrm -- path/ke/model.vrm");
  process.exit(2);
}

let failed = false;
for (const path of paths) {
  console.log(`== ${path}`);
  try {
    const license = readVrmLicense(readGlbJson(await readFile(path)));
    console.log(formatLicenseReport(license));
  } catch (error) {
    failed = true;
    console.error(`Gagal: ${(error as Error).message}`);
  }
  console.log("");
}
process.exit(failed ? 1 : 0);
