import type { MemberId } from "../../shared/team.js";

export type HairStyle = "short" | "bob" | "long" | "ponytail";

export interface MemberLook {
  hair: string;
  hairStyle: HairStyle;
  /** Xenovia's green streak in the bangs. */
  streak?: string;
  ahoge?: boolean;
  eyes: string;
  skin: string;
  top: string;
  sleeves: string;
  /** Null for trousers: the legs use `legs` all the way down. */
  skirt: string | null;
  legs: string;
  socks: string;
  shoes: string;
  glasses?: boolean;
  /** Short cape over the shoulders (Xenovia's capelet). */
  cape?: string;
  /** Breastplate color (Erza's armor). */
  armor?: string;
}

const skin = "#f3d9c6";

/**
 * Each member's colors, from their canon outfit. Used to tint the anime base
 * model and to build the low-poly fallback when no base model is available.
 */
export const memberLooks: Record<MemberId, MemberLook> = {
  xenovia: {
    hair: "#2f6fd6",
    hairStyle: "short",
    streak: "#3fa66a",
    ahoge: true,
    eyes: "#b9862f",
    skin,
    top: "#2b3150",
    sleeves: "#f2f2f2",
    skirt: "#7a2335",
    legs: skin,
    socks: "#2a2a2e",
    shoes: "#6b4a32",
    cape: "#3c4560",
  },
  chizuru: {
    hair: "#a6713f",
    hairStyle: "long",
    eyes: "#8a5a33",
    skin,
    top: "#efe3cf",
    sleeves: "#efe3cf",
    skirt: "#2c3a5a",
    legs: skin,
    socks: skin,
    shoes: "#7a5234",
  },
  robin: {
    hair: "#1d1d24",
    hairStyle: "long",
    eyes: "#3d6fb6",
    skin: "#e8c7ad",
    top: "#5b3a6e",
    sleeves: "#5b3a6e",
    skirt: "#3a2b44",
    legs: "#3a2b44",
    socks: "#1f1a24",
    shoes: "#1a1a1e",
  },
  asuna: {
    hair: "#d9894a",
    hairStyle: "long",
    eyes: "#b07a45",
    skin,
    top: "#f4f1ea",
    sleeves: "#f4f1ea",
    skirt: "#b8323a",
    legs: skin,
    socks: "#e9e6df",
    shoes: "#7a2a2a",
  },
  kobayashi: {
    hair: "#b8452f",
    hairStyle: "ponytail",
    eyes: "#7a4a2a",
    skin,
    top: "#3b3b44",
    sleeves: "#f2f2f2",
    skirt: null,
    legs: "#2e3140",
    socks: "#2e3140",
    shoes: "#2a2a2a",
    glasses: true,
  },
  fubuki: {
    hair: "#15161c",
    hairStyle: "bob",
    eyes: "#3e9a5a",
    skin,
    top: "#1f4d35",
    sleeves: "#1f4d35",
    skirt: "#1f4d35",
    legs: "#1e1e22",
    socks: "#1e1e22",
    shoes: "#141416",
  },
  erza: {
    hair: "#c72a2a",
    hairStyle: "long",
    eyes: "#6b4226",
    skin,
    top: "#2f4c8f",
    sleeves: "#c8ccd4",
    skirt: "#2f4c8f",
    legs: skin,
    socks: "#26262c",
    shoes: "#26262c",
    armor: "#c8ccd4",
  },
};
