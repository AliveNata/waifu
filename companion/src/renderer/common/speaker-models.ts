import type { VRM } from "@pixiv/three-vrm";
import type { MemberId } from "../../shared/team.js";
import type { MemberModelLoader } from "./member-model.js";
import { disposeVrm } from "./vrm-loader.js";

/** Models are 10 MB each; keep only the few most recent speakers in memory. */
const maxCachedModels = 3;

/**
 * Full-size speaker models for a dialog, loaded on first use and dropped least
 * recently used first. A model still on stage is never disposed under it.
 */
export class SpeakerModels {
  private readonly cache = new Map<MemberId, Promise<VRM | null>>();

  constructor(
    private readonly loader: MemberModelLoader,
    private readonly onStage: () => MemberId | null,
  ) {}

  modelFor(memberId: MemberId): Promise<VRM | null> {
    const cached = this.cache.get(memberId);
    if (cached !== undefined) {
      // Re-insert to mark as most recently used.
      this.cache.delete(memberId);
      this.cache.set(memberId, cached);
      return cached;
    }
    const loading = this.loader
      .load(memberId)
      .then((loaded) => loaded?.vrm ?? null)
      .catch((error: unknown) => {
        console.error(`[speaker] model for ${memberId} failed to load`, error);
        return null;
      });
    this.cache.set(memberId, loading);
    while (this.cache.size > maxCachedModels) {
      const oldest = this.cache.keys().next().value as MemberId;
      this.forget(oldest);
    }
    return loading;
  }

  /** Drops a member's model, e.g. after the user picks a new one, so the next line loads it fresh. */
  forget(memberId: MemberId): void {
    const cached = this.cache.get(memberId);
    this.cache.delete(memberId);
    cached
      ?.then((vrm) => {
        if (vrm !== null && this.onStage() !== memberId) {
          disposeVrm(vrm);
        }
      })
      .catch((error: unknown) => console.error(`[speaker] failed to release model for ${memberId}`, error));
  }
}
