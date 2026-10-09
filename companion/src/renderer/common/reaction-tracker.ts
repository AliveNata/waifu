import { idleReaction, isTransientExpired, type Reaction } from "../../shared/reaction.js";

/** Holds the latest reaction and decays transient moods (greeting, done) back to idle. */
export class ReactionTracker {
  private reaction: Reaction;

  constructor(now: number) {
    this.reaction = idleReaction(now);
  }

  apply(reaction: Reaction): void {
    this.reaction = reaction;
  }

  current(now: number): Reaction {
    if (isTransientExpired(this.reaction, now)) {
      this.reaction = idleReaction(now);
    }
    return this.reaction;
  }
}
