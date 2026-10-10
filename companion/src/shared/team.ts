/**
 * Team roster shared by the hook server and both pages. `agentType` must match
 * the `name` in team/agents/*.md, because hooks report subagents by that name.
 */
export const memberIds = ["konan", "chizuru", "rias", "asuna", "kobayashi", "yor", "erza"] as const;

export type MemberId = (typeof memberIds)[number];

export interface MemberProfile {
  id: MemberId;
  displayName: string;
  role: string;
  /** Subagent name, or null for Konan who is the main session. */
  agentType: string | null;
}

export const roster: Record<MemberId, MemberProfile> = {
  konan: { id: "konan", displayName: "Konan", role: "PA + PM", agentType: null },
  chizuru: { id: "chizuru", displayName: "Chizuru", role: "Brainstormer", agentType: "brainstormer" },
  rias: { id: "rias", displayName: "Rias", role: "Architect", agentType: "architect" },
  asuna: { id: "asuna", displayName: "Asuna", role: "Data Engineer", agentType: "data-engineer" },
  kobayashi: { id: "kobayashi", displayName: "Kobayashi", role: "Full Stack", agentType: "fullstack-engineer" },
  yor: { id: "yor", displayName: "Yor", role: "Platform/SRE", agentType: "platform-sre" },
  erza: { id: "erza", displayName: "Erza", role: "Reviewer", agentType: "reviewer" },
};

export function isMemberId(value: unknown): value is MemberId {
  return typeof value === "string" && (memberIds as readonly string[]).includes(value);
}

export function memberForAgentType(agentType: string): MemberId | null {
  for (const profile of Object.values(roster)) {
    if (profile.agentType === agentType) {
      return profile.id;
    }
  }
  return null;
}
