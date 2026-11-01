import type { Mood } from "../../shared/reaction.js";
import type { MemberId } from "../../shared/team.js";
import { homeStations, type StationId } from "./office-layout.js";
import type { LifeChoice } from "./office-life.js";
import type { MemberBehavior } from "./team-state.js";

export type OfficeAction =
  | "type"
  | "desk-idle"
  | "stretch"
  | "draw"
  | "read"
  | "stick"
  | "ponder"
  | "cheer"
  | "wave"
  | "relax"
  | "watch"
  | "game"
  | "brew"
  | "snack"
  | "arcade"
  | "water"
  | "lounge"
  | "selfie"
  | "rack"
  | "chat"
  | "meeting"
  | "pingpong"
  | "pingpong-wait"
  | "wash"
  | "oven"
  | "fetch"
  | "pick"
  | "eat"
  | "out"
  | "run"
  | "box"
  | "gaze";

export interface MemberPlan {
  station: StationId;
  /** What to do once at the station. While walking the pose is always "walk". */
  action: OfficeAction;
  /** Drives facial expressions, reusing 2B's mood vocabulary. */
  mood: Mood;
}

/** 2B's plan for every mood except idle, where she joins the team's break routine. */
const twobPlans: Record<Exclude<Mood, "idle">, MemberPlan> = {
  greeting: { station: "front", action: "wave", mood: "greeting" },
  thinking: { station: "board-twob", action: "draw", mood: "thinking" },
  working: { station: "desk-twob", action: "type", mood: "working" },
  waiting: { station: "front", action: "wave", mood: "waiting" },
  done: { station: "front", action: "cheer", mood: "done" },
};

export function twobPlan(mood: Mood, idle: LifeChoice): MemberPlan {
  return mood === "idle" ? { station: idle.station, action: idle.action, mood: "idle" } : twobPlans[mood];
}

const workActions: Record<Exclude<MemberId, "twob">, { working: OfficeAction; done: OfficeAction }> = {
  chizuru: { working: "stick", done: "cheer" },
  rias: { working: "draw", done: "cheer" },
  asuna: { working: "type", done: "stretch" },
  kobayashi: { working: "type", done: "stretch" },
  yor: { working: "type", done: "stretch" },
  erza: { working: "type", done: "stretch" },
  ruby: { working: "type", done: "cheer" },
  arisu: { working: "type", done: "cheer" },
  komachi: { working: "type", done: "stretch" },
  miruku: { working: "type", done: "stretch" },
  huagua: { working: "type", done: "cheer" },
};

/** Work happens at the member's home station; between tasks they follow their own routine. */
export function memberPlan(
  memberId: Exclude<MemberId, "twob">,
  behavior: MemberBehavior,
  idle: LifeChoice | null,
): MemberPlan {
  if (behavior === "idle" && idle !== null) {
    return { station: idle.station, action: idle.action, mood: "idle" };
  }
  const action = behavior === "done" ? workActions[memberId].done : workActions[memberId].working;
  return { station: homeStations[memberId], action, mood: behavior === "done" ? "done" : "working" };
}

/** Actions where the right hand is placed by IK onto a board instead of by the pose. */
export function usesHandIk(action: OfficeAction): boolean {
  return action === "draw" || action === "stick";
}

export type HandPropKind =
  | "mug"
  | "paddle"
  | "phone"
  | "book"
  | "can"
  | "controller"
  | "plate"
  | "duck"
  | "console"
  | "plush"
  | "fork"
  | "rose"
  | "teacup"
  | "marker"
  | "laptop"
  | "pizza-slice"
  | "platter-bite"
  | "donut"
  | "sushi"
  | "food-box"
  | "food-bag";

/** The prop an action puts in the right hand, or null for empty-handed actions. */
export function propForAction(action: OfficeAction | null): HandPropKind | null {
  switch (action) {
    case "brew":
      return "mug";
    case "read":
      return "book";
    case "lounge":
    case "selfie":
      return "phone";
    case "water":
      return "can";
    case "game":
      return "controller";
    case "pingpong":
    case "pingpong-wait":
      return "paddle";
    default:
      return null;
  }
}

/** Where someone heating food is in the job, from how long they have been at the oven. */
export interface OvenStep {
  /** Door open, inside lit and cooking, or off. */
  oven: "off" | "open" | "cooking";
  foodInside: boolean;
  plateInHand: boolean;
  /** Bending down to the oven door rather than standing and waiting. */
  reaching: boolean;
}

/** Seconds: putting the plate in, then cooking, then taking it out again. */
const ovenLoadedAt = 1.1;
const ovenDoneAt = 6;
const ovenEmptiedAt = 7.2;

export function ovenStep(elapsed: number): OvenStep {
  if (elapsed < ovenLoadedAt) {
    // Door down, plate going in.
    return { oven: "open", foodInside: elapsed > ovenLoadedAt * 0.6, plateInHand: false, reaching: true };
  }
  if (elapsed < ovenDoneAt) {
    return { oven: "cooking", foodInside: true, plateInHand: false, reaching: false };
  }
  if (elapsed < ovenEmptiedAt) {
    const out = elapsed > ovenDoneAt + (ovenEmptiedAt - ovenDoneAt) * 0.6;
    return { oven: "open", foodInside: !out, plateInHand: out, reaching: true };
  }
  return { oven: "off", foodInside: false, plateInHand: true, reaching: false };
}
