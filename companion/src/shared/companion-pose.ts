/** Poses 2B holds on the desktop when asked from the office chat. */
export const companionPoses = [
  "raise-hand",
  "ponder",
  "wave",
  "peace",
  "thumbs-up",
  "cross-arms",
  "clap",
  "scratch-head",
  "stretch",
  "tongue",
] as const;
export type CompanionPose = (typeof companionPoses)[number];

export const companionFaces = ["smile", "pout", "surprised", "sad", "angry", "sleepy"] as const;
export type CompanionFace = (typeof companionFaces)[number];

export interface PoseCommand {
  pose: CompanionPose | null;
  face: CompanionFace | null;
}

/** Indonesian and English words for each pose and face, as people would type them. */
const aliases: readonly { words: readonly string[]; command: PoseCommand }[] = [
  { words: ["angkat tangan", "raise hand", "raise your hand"], command: { pose: "raise-hand", face: null } },
  { words: ["merenung", "mikir", "berpikir", "ponder", "think"], command: { pose: "ponder", face: null } },
  { words: ["dadah", "lambai", "lambaikan tangan", "wave", "say hi"], command: { pose: "wave", face: "smile" } },
  { words: ["peace", "v", "pis", "salam peace"], command: { pose: "peace", face: "smile" } },
  { words: ["jempol", "thumbs up", "mantap"], command: { pose: "thumbs-up", face: "smile" } },
  { words: ["silang tangan", "lipat tangan", "cross arms"], command: { pose: "cross-arms", face: "pout" } },
  { words: ["tepuk tangan", "clap"], command: { pose: "clap", face: "smile" } },
  { words: ["garuk kepala", "scratch head", "bingung"], command: { pose: "scratch-head", face: null } },
  { words: ["ngulet", "peregangan", "stretch"], command: { pose: "stretch", face: "sleepy" } },
  {
    words: ["melet", "julurin lidah", "tongue", "bleh", "wlee"],
    command: { pose: "tongue", face: null },
  },
  { words: ["senyum", "smile"], command: { pose: null, face: "smile" } },
  { words: ["cemberut", "manyun", "pout"], command: { pose: null, face: "pout" } },
  { words: ["kaget", "surprised"], command: { pose: null, face: "surprised" } },
  { words: ["sedih", "sad"], command: { pose: null, face: "sad" } },
  { words: ["marah", "angry"], command: { pose: null, face: "angry" } },
  { words: ["ngantuk", "sleepy"], command: { pose: null, face: "sleepy" } },
];

/** Polite or filler words around a command: "@2B coba angkat tangan dong" is still a command. */
const fillers = new Set(["@2b", "2b", "coba", "tolong", "dong", "ya", "yuk", "please", "pls", "deh", "sih", "lagi"]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word !== "" && !fillers.has(word));
}

/**
 * The pose a short message asks for, or null when the message is anything else. Only a message
 * that is a pose and nothing more counts, so "aku lagi mikir soal kerjaan" stays a chat message.
 */
export function parsePoseCommand(text: string): PoseCommand | null {
  const rest = words(text).join(" ");
  if (rest === "") {
    return null;
  }
  return aliases.find((alias) => alias.words.includes(rest))?.command ?? null;
}

export function isCompanionPose(value: unknown): value is CompanionPose {
  return typeof value === "string" && (companionPoses as readonly string[]).includes(value);
}

export function isCompanionFace(value: unknown): value is CompanionFace {
  return typeof value === "string" && (companionFaces as readonly string[]).includes(value);
}
