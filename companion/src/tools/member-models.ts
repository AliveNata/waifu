import { existsSync } from "node:fs";
import { join } from "node:path";
import { type MemberId, roster } from "../shared/team.js";

/**
 * File names checked in models/ for a member: the display name the docs tell
 * users to save under (2b.vrm, ruby.vrm), then the internal id (twob.vrm).
 * Windows paths are case-insensitive, so 2B.vrm matches too.
 */
export function memberModelFileNames(memberId: MemberId): string[] {
  const names = new Set([roster[memberId].displayName.toLowerCase(), memberId]);
  return [...names].map((name) => `${name}.vrm`);
}

/** A model dropped into models/ under the member's name, so it loads without picking it in the menu. */
export function findMemberModel(
  repoRoot: string,
  memberId: MemberId,
  exists: (path: string) => boolean = existsSync,
): string | null {
  for (const fileName of memberModelFileNames(memberId)) {
    const path = join(repoRoot, "models", fileName);
    if (exists(path)) {
      return path;
    }
  }
  return null;
}
