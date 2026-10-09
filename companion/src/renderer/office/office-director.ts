import type { Mood } from "../../shared/reaction.js";
import type { MemberId } from "../../shared/team.js";
import { homeStations, type StationId } from "./office-layout.js";
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
  | "relax";

export interface MemberPlan {
  station: StationId;
  /** What to do once at the station. While walking the pose is always "walk". */
  action: OfficeAction;
  /** Drives facial expressions, reusing Xenovia's mood vocabulary. */
  mood: Mood;
}

const xenoviaPlans: Record<Mood, MemberPlan> = {
  idle: { station: "sofa", action: "relax", mood: "idle" },
  greeting: { station: "front", action: "wave", mood: "greeting" },
  thinking: { station: "board-xenovia", action: "draw", mood: "thinking" },
  working: { station: "desk-xenovia", action: "type", mood: "working" },
  waiting: { station: "front", action: "wave", mood: "waiting" },
  done: { station: "front", action: "cheer", mood: "done" },
};

export function xenoviaPlan(mood: Mood): MemberPlan {
  return xenoviaPlans[mood];
}

const behaviorMood: Record<MemberBehavior, Mood> = { idle: "idle", working: "working", done: "done" };

const actionsByMember: Record<Exclude<MemberId, "xenovia">, Record<MemberBehavior, OfficeAction>> = {
  chizuru: { working: "stick", idle: "ponder", done: "cheer" },
  robin: { working: "draw", idle: "read", done: "cheer" },
  asuna: { working: "type", idle: "desk-idle", done: "stretch" },
  kobayashi: { working: "type", idle: "desk-idle", done: "stretch" },
  fubuki: { working: "type", idle: "desk-idle", done: "stretch" },
  erza: { working: "type", idle: "desk-idle", done: "stretch" },
};

export function memberPlan(memberId: Exclude<MemberId, "xenovia">, behavior: MemberBehavior): MemberPlan {
  return { station: homeStations[memberId], action: actionsByMember[memberId][behavior], mood: behaviorMood[behavior] };
}

/** Actions where the right hand is placed by IK onto a board instead of by the pose. */
export function usesHandIk(action: OfficeAction): boolean {
  return action === "draw" || action === "stick";
}
