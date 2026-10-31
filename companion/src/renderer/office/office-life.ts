import type { MemberId } from "../../shared/team.js";
import type { OfficeAction } from "./office-director.js";
import { homeStations } from "./office-layout.js";
import { meetingStationIds, type StationId } from "./office-plan.js";
import type { DayPart } from "./office-time.js";

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
  | "heat"
  | "wash-mug"
  | "grab-food"
  | "buy-food"
  | "treadmill"
  | "boxing"
  | "aquarium";

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
  arcade: {
    stations: ["arcade", "arcade-2"],
    action: "arcade",
    durationSeconds: [15, 30],
    weight: 0.7,
    cooldownSeconds: 90,
    social: true,
  },
  treadmill: {
    stations: ["treadmill-1", "treadmill-2"],
    action: "run",
    durationSeconds: [20, 40],
    weight: 0.5,
    cooldownSeconds: 180,
  },
  boxing: { stations: ["punching-bag"], action: "box", durationSeconds: [10, 18], weight: 0.4, cooldownSeconds: 180 },
  aquarium: { stations: ["aquarium"], action: "gaze", durationSeconds: [10, 20], weight: 0.6, cooldownSeconds: 120 },
  plants: {
    stations: ["plant-lounge", "plant-corner", "plant-desks"],
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
    stations: ["bar-left", "bar-right", "bar-west-left", "bar-west-right"],
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
  // An empty mug washed up and left on the drying rack. Only offered while the mug is empty.
  "wash-mug": { stations: ["sink"], action: "wash", durationSeconds: [6, 8], weight: 0.8, cooldownSeconds: 0 },
  // A piece of whatever is on the bar. Only offered while there is some left.
  "grab-food": { stations: ["bar-food"], action: "eat", durationSeconds: [7, 10], weight: 0.8, cooldownSeconds: 150 },
  // Out through the door for more food, then back to put it on the bar. Only offered when the bar
  // has been empty long enough and nobody is already out for it.
  "buy-food": { stations: ["door"], action: "out", durationSeconds: [25, 40], weight: 3, cooldownSeconds: 0 },
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
  twob: { plants: 1.5, coffee: 1.2, meeting: 1.6, arcade: 0.6, console: 0.7, treadmill: 1.3 },
  chizuru: { beanbag: 2, chat: 1.6, tv: 1.2, pingpong: 1.4, arcade: 0.7, aquarium: 1.5 },
  rias: { read: 2, coffee: 1.4, chat: 1.2, meeting: 1.5, arcade: 0.5, aquarium: 1.3, boxing: 0.5 },
  asuna: { coffee: 1.6, console: 1.3, pingpong: 1.5, plants: 0.8, treadmill: 1.5 },
  kobayashi: { arcade: 1.8, console: 1.5, rack: 0.6 },
  yor: { rack: 2, plants: 1.3, snack: 1.2, pingpong: 1.3, arcade: 0.6, boxing: 1.6, treadmill: 1.3 },
  erza: { snack: 1.8, read: 1.2, meeting: 1.3, console: 0.7, boxing: 1.8, treadmill: 1.2 },
  ruby: { chat: 1.5, tv: 1.2, read: 0.6, aquarium: 1.2, boxing: 0.5 },
  // Arisu keeps people in sync, so she is drawn to meetings and the bar.
  arisu: { meeting: 1.8, chat: 1.3, coffee: 1.2, arcade: 0.6 },
  // Komachi reads up between reviews and likes a game of ping-pong.
  komachi: { read: 1.6, pingpong: 1.3, coffee: 1.3, beanbag: 0.7 },
  // Miruku is on watch: short breaks, coffee, and a round of arcade.
  miruku: { coffee: 1.5, arcade: 1.4, plants: 0.7, beanbag: 0.7 },
  // Huagua looks for ideas away from the screen: plants, the fish, the lounge and the TV.
  huagua: { plants: 1.6, beanbag: 1.4, tv: 1.2, meeting: 0.8, aquarium: 1.8 },
};

/**
 * What people feel like doing at each time of day: coffee to start the morning, food around
 * lunch, winding down in the afternoon, a quieter evening. Multiplies the personal preferences.
 */
const byTimeOfDay: Record<DayPart, Partial<Record<ActivityId, number>>> = {
  pagi: { coffee: 2, plants: 1.4, snack: 0.6, heat: 0.4, console: 0.6, arcade: 0.6, "grab-food": 0.7, treadmill: 1.6 },
  siang: { heat: 2.5, snack: 2, chat: 1.5, coffee: 0.8, "grab-food": 2 },
  sore: {
    tv: 1.5,
    console: 1.5,
    pingpong: 1.5,
    arcade: 1.5,
    beanbag: 1.3,
    coffee: 1.2,
    "grab-food": 1.3,
    treadmill: 1.3,
    boxing: 1.3,
  },
  malam: { tv: 1.3, read: 1.4, beanbag: 1.3, coffee: 0.6, pingpong: 0.7, plants: 0.5 },
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
  arisu: { station: homeStations.arisu, action: "desk-idle" },
  komachi: { station: homeStations.komachi, action: "desk-idle" },
  miruku: { station: homeStations.miruku, action: "desk-idle" },
  huagua: { station: homeStations.huagua, action: "desk-idle" },
};

/**
 * A step that moves something along the way: a mug, a laptop, or the shared food and its box.
 * The stage reads it to know when things change hands.
 */
export type Errand =
  | "get-mug"
  | "rack-mug"
  | "wash-mug"
  | "fetch-laptop"
  | "meeting-laptop"
  | "stow-laptop"
  | "go-out"
  | "set-food"
  | "take-box"
  | "bin-box";

export interface LifeChoice {
  activity: ActivityId;
  station: StationId;
  action: OfficeAction;
  durationMs: number;
  /** Set once the member reaches the station; the duration counts from here, not from leaving. */
  arrivedAt: number | null;
  chosenAt: number;
  errand: Errand | null;
  /** 0 for the step that was chosen; later steps of the same activity count up from there. */
  step: number;
}

/** Where a member's mug is and how much coffee is left in it, which decides the coffee and wash runs. */
export interface MugInfo {
  place: "desk" | "hand" | "rack";
  /** 0 empty to 1 full. */
  level: number;
}

/** The shared food as the choices need it. */
export interface FoodInfo {
  /** Pieces left in the box on the bar. */
  pieces: number;
  /** The bar has been empty long enough that someone may go out for more. */
  canBuy: boolean;
}

/** Errand steps are short: reach, take or put down, go. */
const errandMs = {
  "get-mug": 1600,
  "rack-mug": 1600,
  "fetch-laptop": 2400,
  "stow-laptop": 2400,
  "set-food": 2000,
  "take-box": 1400,
  "bin-box": 1600,
} as const;
type TimedErrand = keyof typeof errandMs;

/** A step the stage adds in front of what a member does next, such as binning an empty box. */
export interface ExtraStep {
  station: StationId;
  action: OfficeAction;
  errand: TimedErrand;
}
/** An empty mug makes coffee or washing up this much more likely than a casual break. */
const emptyMugBoost = 2.5;

/** A walk that never arrives (blocked or interrupted) is given up after this long. */
const arrivalTimeoutMs = 60_000;
/** Social activities are much more likely when someone is already there to join. */
const companyBoost = 4;

export class OfficeLife {
  private readonly choices = new Map<MemberId, LifeChoice>();
  /** The rest of a multi-step activity, such as walking the coffee back to the desk. */
  private readonly queued = new Map<MemberId, LifeChoice[]>();
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
    private readonly mugOf: (memberId: MemberId) => MugInfo = () => ({ place: "desk", level: 0 }),
    private readonly dayPart: () => DayPart | null = () => null,
    private readonly food: () => FoodInfo = () => ({ pieces: 0, canBuy: false }),
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
    const queue = this.queued.get(memberId);
    const following = queue?.shift();
    if (following !== undefined) {
      const next = { ...following, chosenAt: now };
      this.choices.set(memberId, next);
      return next;
    }
    const [next, ...rest] = this.choose(memberId, now, current?.activity ?? null);
    if (next === undefined) {
      throw new Error(`no idle choice for ${memberId}`);
    }
    this.choices.set(memberId, next);
    this.queued.set(memberId, rest);
    // Every shared spot along the way is held from the start, so nobody takes the sink or a seat
    // while the member is still on an earlier step.
    for (const step of [next, ...rest]) {
      if (step.activity !== "desk" && step.station !== idleHome[memberId].station) {
        this.reserved.set(step.station, memberId);
      }
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

  /**
   * Puts steps in front of whatever the member does next, holding their stations from now. The
   * steps run as part of the current activity, so the cooldowns and history stay as they were.
   */
  insertNext(memberId: MemberId, steps: readonly ExtraStep[], now: number): void {
    const current = this.choices.get(memberId);
    if (current === undefined) {
      return;
    }
    const added = steps.map(
      (step, index): LifeChoice => ({
        ...current,
        station: step.station,
        action: step.action,
        errand: step.errand,
        durationMs: errandMs[step.errand],
        arrivedAt: null,
        chosenAt: now,
        step: current.step + 1 + index,
      }),
    );
    for (const step of added) {
      this.reserved.set(step.station, memberId);
    }
    const rest = (this.queued.get(memberId) ?? []).map((step) => ({ ...step, step: step.step + added.length }));
    this.queued.set(memberId, [...added, ...rest]);
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
    this.dropQueue(memberId);
    this.cameFromWork.add(memberId);
  }

  private dropQueue(memberId: MemberId): void {
    for (const step of this.queued.get(memberId) ?? []) {
      if (this.reserved.get(step.station) === memberId) {
        this.reserved.delete(step.station);
      }
    }
    this.queued.delete(memberId);
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
    const mug = this.mugOf(memberId);
    const emptyOnDesk = mug.place === "desk" && mug.level <= 0;
    if (id === "coffee") {
      // Nobody makes a new one with coffee still in the mug.
      if (mug.place === "desk" && mug.level > 0) {
        return 0;
      }
      // The clean mug is on the drying rack by the sink, so the sink has to be free to get it.
      if (mug.place === "rack" && (this.reserved.has("sink") || this.crowded("sink"))) {
        return 0;
      }
    }
    if (id === "wash-mug" && !emptyOnDesk) {
      return 0;
    }
    if (id === "grab-food" && this.food().pieces <= 0) {
      return 0;
    }
    if (id === "buy-food" && (!this.food().canBuy || this.someoneBuying())) {
      return 0;
    }
    if (
      id === "pingpong" &&
      (this.freeStations(activity, memberId).length < 2 || this.idlePartner(memberId) === null)
    ) {
      return 0;
    }
    const part = this.dayPart();
    let weight =
      activity.weight * (preferences[memberId][id] ?? 1) * (part === null ? 1 : (byTimeOfDay[part][id] ?? 1));
    if ((id === "coffee" || id === "wash-mug") && emptyOnDesk) {
      weight *= emptyMugBoost;
    }
    if (activity.social === true && activity.stations?.some((station) => this.reserved.has(station))) {
      weight *= companyBoost;
    }
    return weight;
  }

  /** Someone is already out for food, or on the way back with it. */
  private someoneBuying(): boolean {
    const buying = (step: LifeChoice): boolean => step.errand === "go-out" || step.errand === "set-food";
    for (const [id, choice] of this.choices) {
      if (buying(choice) || (this.queued.get(id) ?? []).some(buying)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Someone to play against: a teammate on a break (has an idle choice, so not working) who is
   * not already playing and can still play. The one idle the longest goes, so it is fair and
   * does not spend a random draw.
   */
  private idlePartner(memberId: MemberId): MemberId | null {
    let best: { id: MemberId; since: number } | null = null;
    for (const [id, choice] of this.choices) {
      // Someone carrying a mug or a laptop finishes that first.
      if (id === memberId || choice.activity === "pingpong" || choice.errand !== null) {
        continue;
      }
      if ((this.queued.get(id)?.length ?? 0) > 0) {
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
    this.dropQueue(partner);
    this.choices.set(partner, { ...game, station: otherSide, arrivedAt: null, chosenAt: now });
    this.reserved.set(otherSide, partner);
    this.partners.set(memberId, partner);
    this.partners.set(partner, memberId);
  }

  /** The chosen activity as its steps, the first one to do now. */
  private choose(memberId: MemberId, now: number, previous: ActivityId | null): LifeChoice[] {
    const weights = activityIds.map((id) => [id, this.weightOf(memberId, id, previous, now)] as const);
    const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
    let picked: ActivityId = "desk";
    let roll = this.random() * total;
    if (total > 0) {
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
    const durationMs = (shortest + this.random() * (longest - shortest)) * 1000;
    const main: LifeChoice = {
      activity: picked,
      station,
      action,
      durationMs,
      arrivedAt: null,
      chosenAt: now,
      errand: null,
      step: 0,
    };
    return this.withErrands(memberId, main, now);
  }

  /**
   * Adds the fetching and carrying an activity needs: the mug from the desk or the drying rack
   * before a coffee and the walk back to the desk after it, the mug before washing it up, and the
   * laptop from the desk before a meeting and back after.
   */
  private withErrands(memberId: MemberId, main: LifeChoice, now: number): LifeChoice[] {
    const home = idleHome[memberId];
    const errand = (station: StationId, action: OfficeAction, kind: TimedErrand): LifeChoice => ({
      ...main,
      station,
      action,
      durationMs: errandMs[kind],
      errand: kind,
    });
    const mug = this.mugOf(memberId);
    const getMug =
      mug.place === "rack"
        ? [errand("sink", "pick", "rack-mug")]
        : mug.place === "desk"
          ? [errand(home.station, "fetch", "get-mug")]
          : [];
    let steps: LifeChoice[];
    switch (main.activity) {
      case "coffee": {
        const [shortest, longest] = activities.desk.durationSeconds;
        const backToDesk: LifeChoice = {
          ...main,
          activity: "desk",
          station: home.station,
          action: home.action,
          durationMs: (shortest + this.random() * (longest - shortest)) * 1000,
        };
        steps = [...getMug, main, backToDesk];
        break;
      }
      case "wash-mug":
        steps = [...getMug, { ...main, errand: "wash-mug" }];
        break;
      case "meeting":
        steps = [
          errand(home.station, "fetch", "fetch-laptop"),
          { ...main, errand: "meeting-laptop" },
          errand(home.station, "fetch", "stow-laptop"),
        ];
        break;
      case "buy-food":
        steps = [{ ...main, errand: "go-out" }, errand("bar-food", "fetch", "set-food")];
        break;
      default:
        steps = [main];
    }
    return steps.map((step, index) => ({ ...step, step: index, chosenAt: now }));
  }
}
