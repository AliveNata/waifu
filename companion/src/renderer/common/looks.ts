import type { MemberId } from "../../shared/team.js";

export type HairStyle = "short" | "bob" | "long" | "ponytail";

export interface MemberLook {
  hair: string;
  hairStyle: HairStyle;
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
  /** Short cape over the shoulders (2B's capelet). */
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
  twob: {
    // White bob and pale blue eyes, in the black YoRHa dress and thigh-high boots.
    hair: "#e6e4df",
    hairStyle: "bob",
    eyes: "#7f9fbf",
    skin,
    top: "#1b1b22",
    sleeves: "#1b1b22",
    skirt: "#1b1b22",
    legs: skin,
    socks: "#1b1b22",
    shoes: "#1b1b22",
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
  rias: {
    // Crimson hair and blue-green eyes, in the Kuoh Academy uniform.
    hair: "#b51f2e",
    hairStyle: "long",
    eyes: "#3f8f86",
    skin,
    top: "#2b3150",
    sleeves: "#f2f2f2",
    skirt: "#7a2335",
    legs: skin,
    socks: "#2a2a2e",
    shoes: "#6b4a32",
    cape: "#3c4560",
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
  yor: {
    // Black hair and red eyes, in her black Thorn Princess dress.
    hair: "#17171d",
    hairStyle: "long",
    eyes: "#b3262f",
    skin,
    top: "#1c1a22",
    sleeves: "#1c1a22",
    skirt: "#1c1a22",
    legs: "#141418",
    socks: "#141418",
    shoes: "#141418",
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
  ruby: {
    // Golden hair and pink-red eyes, in her pink and white B-Komachi idol outfit.
    hair: "#f2cf63",
    hairStyle: "long",
    eyes: "#d8436f",
    skin,
    top: "#f4a9c4",
    sleeves: "#fbf3f6",
    skirt: "#e46f9b",
    legs: skin,
    socks: "#f7f2f4",
    shoes: "#d9577f",
  },
  /*
   * The four below are placeholders picked per role, not taken from the characters: their models'
   * own pictures could not be looked at yet. Once a member's .vrm is in models/, the real model
   * shows and these only tint the fallback.
   */
  arisu: {
    // PM: a neat office look in calm blue.
    hair: "#4b6a96",
    hairStyle: "long",
    eyes: "#3f7fb0",
    skin,
    top: "#f2f4f8",
    sleeves: "#f2f4f8",
    skirt: "#2e3b5a",
    legs: skin,
    socks: "#2a2a30",
    shoes: "#2a2a30",
  },
  komachi: {
    // Tech lead: dark hair, glasses, a hoodie and trousers.
    hair: "#2b2d3a",
    hairStyle: "bob",
    eyes: "#5b6fd6",
    skin,
    top: "#3a4466",
    sleeves: "#3a4466",
    skirt: null,
    legs: "#262a36",
    socks: "#262a36",
    shoes: "#1f1f24",
    glasses: true,
  },
  miruku: {
    // Security: pale hair and a dark jacket.
    hair: "#ece6f4",
    hairStyle: "ponytail",
    eyes: "#8a5fd0",
    skin,
    top: "#22222c",
    sleeves: "#22222c",
    skirt: "#22222c",
    legs: skin,
    socks: "#1a1a20",
    shoes: "#1a1a20",
  },
  huagua: {
    // Designer: soft green with a cream cardigan.
    hair: "#5f9f7a",
    hairStyle: "bob",
    eyes: "#4f8f6a",
    skin,
    top: "#f1e9d8",
    sleeves: "#f1e9d8",
    skirt: "#6f8f6a",
    legs: skin,
    socks: "#f4efe6",
    shoes: "#8a6a4a",
  },
};
