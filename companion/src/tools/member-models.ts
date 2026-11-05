import { existsSync } from "node:fs";
import { join } from "node:path";
import type { LocalProp } from "../shared/protocol.js";
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

/**
 * The delivery courier's model, dropped into models/ as courier.vrm. Optional: without it the
 * order just appears on the mat inside the door.
 */
export function findCourierModel(repoRoot: string, exists: (path: string) => boolean = existsSync): string | null {
  const path = join(repoRoot, "models", "courier.vrm");
  return exists(path) ? path : null;
}

/** A local-only prop dropped into models/ as <name>.glb. Optional, like the courier. */
export function findLocalProp(
  repoRoot: string,
  name: LocalProp,
  exists: (path: string) => boolean = existsSync,
): string | null {
  const path = join(repoRoot, "models", `${name}.glb`);
  return exists(path) ? path : null;
}
