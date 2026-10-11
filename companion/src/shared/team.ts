/**
 * Team roster shared by the hook server and both pages. `agentType` must match
 * the `name` in team/agents/*.md, because hooks report subagents by that name.
 * Agents are named after the cast, so `@erza` in Claude Code reads like a person.
 */
export const memberIds = ["twob", "chizuru", "rias", "asuna", "kobayashi", "yor", "erza", "ruby"] as const;

export type MemberId = (typeof memberIds)[number];

export interface MemberProfile {
  id: MemberId;
  displayName: string;
  role: string;
  /** Subagent name, or null for 2B who is the main session. */
  agentType: string | null;
  /** The role-based name agents had before they were named after the cast, still recognized in hooks. */
  legacyAgentType: string | null;
}

export const roster: Record<MemberId, MemberProfile> = {
  twob: { id: "twob", displayName: "2B", role: "PA + PM", agentType: null, legacyAgentType: null },
  chizuru: {
    id: "chizuru",
    displayName: "Chizuru",
    role: "Brainstormer",
    agentType: "chizuru",
    legacyAgentType: "brainstormer",
  },
  rias: { id: "rias", displayName: "Rias", role: "Architect", agentType: "rias", legacyAgentType: "architect" },
  asuna: {
    id: "asuna",
    displayName: "Asuna",
    role: "Data Engineer",
    agentType: "asuna",
    legacyAgentType: "data-engineer",
  },
  kobayashi: {
    id: "kobayashi",
    displayName: "Kobayashi",
    role: "Full Stack",
    agentType: "kobayashi",
    legacyAgentType: "fullstack-engineer",
  },
  yor: { id: "yor", displayName: "Yor", role: "Platform/SRE", agentType: "yor", legacyAgentType: "platform-sre" },
  erza: { id: "erza", displayName: "Erza", role: "Reviewer", agentType: "erza", legacyAgentType: "reviewer" },
  ruby: {
    id: "ruby",
    displayName: "Ruby",
    role: "Content + Portfolio",
    agentType: "ruby",
    legacyAgentType: "content-creator",
  },
};

export function isMemberId(value: unknown): value is MemberId {
  return typeof value === "string" && (memberIds as readonly string[]).includes(value);
}

export function memberForAgentType(agentType: string): MemberId | null {
  for (const profile of Object.values(roster)) {
    if (profile.agentType === agentType || profile.legacyAgentType === agentType) {
      return profile.id;
    }
  }
  return null;
}
