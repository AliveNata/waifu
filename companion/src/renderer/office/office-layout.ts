import type { MemberId } from "../../shared/team.js";
import type { StationId } from "./office-plan.js";

export { planPath } from "./office-nav.js";
export {
  distance,
  facingCamera,
  type Point,
  room,
  type Station,
  type StationId,
  stations,
} from "./office-plan.js";

/** Where each member works when Claude Code calls them. 2B moves with her mood instead. */
export const homeStations: Record<Exclude<MemberId, "twob">, StationId> = {
  chizuru: "idea-board",
  rias: "board-rias",
  asuna: "desk-asuna",
  kobayashi: "desk-kobayashi",
  yor: "desk-yor",
  erza: "desk-erza",
  ruby: "desk-ruby",
  arisu: "desk-arisu",
  komachi: "desk-komachi",
  miruku: "desk-miruku",
  huagua: "desk-huagua",
};
