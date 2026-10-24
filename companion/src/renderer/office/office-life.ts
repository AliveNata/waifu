import type { MemberId } from "../../shared/team.js";
import type { OfficeAction } from "./office-director.js";
import { homeStations } from "./office-layout.js";
import { meetingStationIds, type StationId } from "./office-plan.js";

/**
 * What the team does between tasks. Each member picks weighted activities with
 * personal preferences, never the same one twice in a row, and with a cooldown,
 * so the office does not loop through the same few motions. Shared spots are
 * reserved, so two people never sit in one seat or share the arcade.
 */
export type ActivityId =
  | "desk"
  | "coffee"
  | "snack"
  | "tv"
  | "console"
  | "arcade"
  | "plants"
  | "beanbag"
  | "chat"
  | "read"
  | "selfie"
  | "rack"
  | "meeting"
  | "pingpong"
  | "wash"
  | "heat";

interface Activity {
  /** Null means the member's own idle spot. */
  stations: readonly StationId[] | null;
  action: OfficeAction;
  durationSeconds: readonly [number, number];
  weight: number;
  cooldownSeconds: number;
  /** Restricts an activity to members whose job or habits it belongs to. */
  only?: readonly MemberId[];
  /** Done together: much more likely when someone is already at one of its stations. */
  social?: boolean;
}

const sofaSeats: readonly StationId[] = ["sofa-1", "sofa-2", "sofa-3"];

/**
 * Desk time weighs about as much as every break together (weight times duration),
 * which is the "balanced" mix: roughly half the idle time at the desk.
 */
const activities: Record<ActivityId, Activity> = {
  desk: { stations: null, action: "desk-idle", durationSeconds: [25, 50], weight: 3, cooldownSeconds: 0 },
  coffee: { stations: ["coffee"], action: "brew", durationSeconds: [8, 14], weight: 1, cooldownSeconds: 90 },
  snack: { stations: ["fridge"], action: "snack", durationSeconds: [5, 9], weight: 0.6, cooldownSeconds: 120 },
  tv: { stations: sofaSeats, action: "watch", durationSeconds: [20, 40], weight: 0.9, cooldownSeconds: 60 },
  console: { stations: sofaSeats, action: "game", durationSeconds: [20, 35], weight: 0.6, cooldownSeconds: 90 },
  arcade: { stations: ["arcade"], action: "arcade", durationSeconds: [15, 30], weight: 0.7, cooldownSeconds: 90 },
  plants: {
    stations: ["plant-lounge", "plant-corner", "plant-desks", "plant-center"],
    action: "water",
    durationSeconds: [6, 10],
    weight: 0.6,
    cooldownSeconds: 120,
  },
  beanbag: {
    stations: ["beanbag-lounge"],
    action: "lounge",
    durationSeconds: [20, 40],
    weight: 0.6,
    cooldownSeconds: 90,
  },
  chat: {
    stations: ["bar-left", "bar-right"],
    action: "chat",
    durationSeconds: [15, 30],
    weight: 0.8,
    cooldownSeconds: 60,
    social: true,
  },
  meeting: {
    stations: meetingStationIds,
    action: "meeting",
    durationSeconds: [20, 40],
    weight: 0.7,
    cooldownSeconds: 90,
    social: true,
  },
  pingpong: {
    stations: ["pingpong-west", "pingpong-east"],
    action: "pingpong",
    durationSeconds: [15, 30],
    // Only offered when someone on a break can be invited to the other end of the table.
    weight: 0.5,
    cooldownSeconds: 120,
  },
  wash: { stations: ["sink"], action: "wash", durationSeconds: [6, 10], weight: 0.4, cooldownSeconds: 120 },
  // Long enough for the whole oven job: in, cook, out, and a moment with the plate.
  heat: { stations: ["oven"], action: "oven", durationSeconds: [10, 14], weight: 0.5, cooldownSeconds: 150 },
  read: {
    stations: [...sofaSeats, "beanbag-lounge"],
    action: "read",
    durationSeconds: [20, 40],
    weight: 0.5,
    cooldownSeconds: 90,
  },
  selfie: {
    stations: ["selfie"],
    action: "selfie",
    durationSeconds: [10, 16],
    weight: 1.5,
    cooldownSeconds: 60,
    only: ["ruby"],
  },
  rack: {
    stations: ["rack"],
    action: "rack",
    durationSeconds: [10, 16],
    weight: 1,
    cooldownSeconds: 90,
    only: ["yor", "kobayashi"],
  },
};

export const activityIds = Object.keys(activities) as ActivityId[];

/** Character habits as weight multipliers. Missing entries count as 1. */
const preferences: Record<MemberId, Partial<Record<ActivityId, number>>> = {
  twob: { plants: 1.5, coffee: 1.2, meeting: 1.6, arcade: 0.6, console: 0.7 },
  chizuru: { beanbag: 2, chat: 1.6, tv: 1.2, pingpong: 1.4, arcade: 0.7 },
  rias: { read: 2, coffee: 1.4, chat: 1.2, meeting: 1.5, arcade: 0.5 },
  asuna: { coffee: 1.6, console: 1.3, pingpong: 1.5, plants: 0.8 },
  kobayashi: { arcade: 1.8, console: 1.5, rack: 0.6 },
  yor: { rack: 2, plants: 1.3, snack: 1.2, pingpong: 1.3, arcade: 0.6 },
  erza: { snack: 1.8, read: 1.2, meeting: 1.3, console: 0.7 },
  ruby: { chat: 1.5, tv: 1.2, read: 0.6 },
};

/** Where a member idles when the "desk" activity comes up, and what they do there. */
const idleHome: Record<MemberId, { station: StationId; action: OfficeAction }> = {
  twob: { station: "desk-twob", action: "desk-idle" },
  chizuru: { station: "desk-chizuru", action: "desk-idle" },
  rias: { station: "desk-rias", action: "desk-idle" },
  asuna: { station: homeStations.asuna, action: "desk-idle" },
  kobayashi: { station: homeStations.kobayashi, action: "desk-idle" },
  yor: { station: homeStations.yor, action: "desk-idle" },
  erza: { station: homeStations.erza, action: "desk-idle" },
  ruby: { station: homeStations.ruby, action: "desk-idle" },
};

export interface LifeChoice {
  activity: ActivityId;
  station: StationId;
  action: OfficeAction;
  durationMs: number;
  /** Set once the member reaches the station; the duration counts from here, not from leaving. */
  arrivedAt: number | null;
  chosenAt: number;
}

/** A walk that never arrives (blocked or interrupted) is given up after this long. */
const arrivalTimeoutMs = 60_000;
/** Social activities are much more likely when someone is already there to join. */
const companyBoost = 4;

export class OfficeLife {
  private readonly choices = new Map<MemberId, LifeChoice>();
  private readonly lastDone = new Map<MemberId, Map<ActivityId, number>>();
  private readonly reserved = new Map<StationId, MemberId>();
  private readonly cameFromWork = new Set<MemberId>();
  /** Ping-pong opponents, both ways. A game always has two players or none. */
  private readonly partners = new Map<MemberId, MemberId>();

  /**
   * `crowded` says whether someone is still at or next to a station, for example the previous
   * sitter still getting up. Such a spot is not offered yet, so nobody walks into a seat that is
   * being vacated.
   */
  constructor(
    private readonly random: () => number = Math.random,
    private readonly crowded: (station: StationId) => boolean = () => false,
  ) {}

  /** The member's current idle activity, picking a new one when the last has run its course. */
  planFor(memberId: MemberId, now: number): LifeChoice {
    const current = this.choices.get(memberId);
    if (current !== undefined && !this.isOver(memberId, current, now)) {
      return current;
    }
    if (current !== undefined) {
      this.finish(memberId, current, now);
    }
    const next = this.choose(memberId, now, current?.activity ?? null);
    this.choices.set(memberId, next);
    if (next.activity !== "desk") {
      this.reserved.set(next.station, memberId);
    }
    if (next.activity === "pingpong") {
      this.invitePartner(memberId, next, now);
    }
    return next;
  }

  /** The member's opponent while a ping-pong game is on, or null. */
  partnerOf(memberId: MemberId): MemberId | null {
    return this.partners.get(memberId) ?? null;
  }

  /** The stage reports arrival so the activity runs its full length once the member is actually there. */
  arrived(memberId: MemberId, now: number): void {
    const current = this.choices.get(memberId);
    if (current !== undefined && current.arrivedAt === null) {
      current.arrivedAt = now;
    }
  }

  /** Real work takes over: free the spot and make the next idle choice a break, not more desk. */
  interrupt(memberId: MemberId, now: number): void {
    const current = this.choices.get(memberId);
    if (current !== undefined) {
      this.finish(memberId, current, now);
      this.choices.delete(memberId);
    }
    this.cameFromWork.add(memberId);
  }

  occupant(station: StationId): MemberId | null {
    return this.reserved.get(station) ?? null;
  }

  private isOver(memberId: MemberId, choice: LifeChoice, now: number): boolean {
    if (choice.activity === "pingpong") {
      // When one player leaves (time is up, or Claude Code calls them to work) the game is over.
      const partner = this.partners.get(memberId);
      if (partner === undefined || this.choices.get(partner)?.activity !== "pingpong") {
        return true;
      }
    }
    if (choice.arrivedAt === null) {
      return now - choice.chosenAt >= arrivalTimeoutMs;
    }
    return now - choice.arrivedAt >= choice.durationMs;
  }

  private finish(memberId: MemberId, choice: LifeChoice, now: number): void {
    if (this.reserved.get(choice.station) === memberId) {
      this.reserved.delete(choice.station);
    }
    if (choice.activity === "pingpong") {
      this.partners.delete(memberId);
    }
    let history = this.lastDone.get(memberId);
    if (history === undefined) {
      history = new Map();
      this.lastDone.set(memberId, history);
    }
    history.set(choice.activity, now);
  }

  private freeStations(activity: Activity, memberId: MemberId): StationId[] {
    if (activity.stations === null) {
      return [idleHome[memberId].station];
    }
    return activity.stations.filter((station) => !this.reserved.has(station) && !this.crowded(station));
  }

  private weightOf(memberId: MemberId, id: ActivityId, previous: ActivityId | null, now: number): number {
    const activity = activities[id];
    if (activity.only !== undefined && !activity.only.includes(memberId)) {
      return 0;
    }
    if (id === previous) {
      return 0;
    }
    if (id === "desk" && this.cameFromWork.has(memberId)) {
      return 0;
    }
    const doneAt = this.lastDone.get(memberId)?.get(id);
    if (doneAt !== undefined && now - doneAt < activity.cooldownSeconds * 1000) {
      return 0;
    }
    if (this.freeStations(activity, memberId).length === 0) {
      return 0;
    }
    if (
      id === "pingpong" &&
      (this.freeStations(activity, memberId).length < 2 || this.idlePartner(memberId) === null)
    ) {
      return 0;
    }
    let weight = activity.weight * (preferences[memberId][id] ?? 1);
    if (activity.social === true && activity.stations?.some((station) => this.reserved.has(station))) {
      weight *= companyBoost;
    }
    return weight;
  }

  /**
   * Someone to play against: a teammate on a break (has an idle choice, so not working) who is
   * not already playing and can still play. The one idle the longest goes, so it is fair and
   * does not spend a random draw.
   */
  private idlePartner(memberId: MemberId): MemberId | null {
    let best: { id: MemberId; since: number } | null = null;
    for (const [id, choice] of this.choices) {
      if (id === memberId || choice.activity === "pingpong") {
        continue;
      }
      const doneAt = this.lastDone.get(id)?.get("pingpong");
      if (doneAt !== undefined && choice.chosenAt - doneAt < activities.pingpong.cooldownSeconds * 1000) {
        continue;
      }
      if (best === null || choice.chosenAt < best.since) {
        best = { id, since: choice.chosenAt };
      }
    }
    return best?.id ?? null;
  }

  /** Pulls the chosen partner off their break to the other end of the table. */
  private invitePartner(memberId: MemberId, game: LifeChoice, now: number): void {
    const partner = this.idlePartner(memberId);
    const otherSide = activities.pingpong.stations?.find((station) => station !== game.station);
    if (partner === null || otherSide === undefined) {
      return;
    }
    const previous = this.choices.get(partner);
    if (previous !== undefined) {
      this.finish(partner, previous, now);
    }
    this.choices.set(partner, { ...game, station: otherSide, arrivedAt: null, chosenAt: now });
    this.reserved.set(otherSide, partner);
    this.partners.set(memberId, partner);
    this.partners.set(partner, memberId);
  }

  private choose(memberId: MemberId, now: number, previous: ActivityId | null): LifeChoice {
    const weights = activityIds.map((id) => [id, this.weightOf(memberId, id, previous, now)] as const);
    const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
    let picked: ActivityId = "desk";
    // A fresh coffee goes back to the desk it was made for, so the mug ends up next to the keyboard.
    const carriesCoffeeHome = previous === "coffee" && idleHome[memberId].action === "desk-idle";
    // Roll even when the coffee decides, so one forced choice does not shift every later draw.
    let roll = this.random() * total;
    if (total > 0 && !carriesCoffeeHome) {
      for (const [id, weight] of weights) {
        roll -= weight;
        if (weight > 0 && roll < 0) {
          picked = id;
          break;
        }
      }
    }
    this.cameFromWork.delete(memberId);

    const activity = activities[picked];
    const candidates = this.freeStations(activity, memberId);
    const station = candidates[Math.floor(this.random() * candidates.length) % candidates.length] as StationId;
    const [shortest, longest] = activity.durationSeconds;
    const action = picked === "desk" ? idleHome[memberId].action : activity.action;
    return {
      activity: picked,
      station,
      action,
      durationMs: (shortest + this.random() * (longest - shortest)) * 1000,
      arrivedAt: null,
      chosenAt: now,
    };
  }
}
