import type { CompanionFace, CompanionPose, PoseCommand } from "./companion-pose.js";
import { isCompanionPose } from "./companion-pose.js";

/**
 * Sesi 2B: a chat with 2B herself through the user's own Groq key, never through Claude Code.
 * Nothing here touches the Claude CLI, so it does not count against the user's Claude usage.
 */

/** How 2B feels about her reply. She tags it, and the desktop overlay shows it on her face. */
export const twobMoods = ["happy", "warm", "sad", "concern", "thinking", "surprised", "playful", "calm"] as const;
export type TwobMood = (typeof twobMoods)[number];

export interface TwobReply {
  text: string;
  mood: TwobMood;
  pose: CompanionPose | null;
}

export interface TwobStatus {
  /** Where the key comes from: saved encrypted by the app, the GROQ_API_KEY variable, or nowhere yet. */
  keySource: "saved" | "env" | null;
  model: string;
}

/** What the desktop overlay does for a Sesi 2B moment: a pose or face, and optionally a short line. */
export interface CompanionCommand extends PoseCommand {
  line: string | null;
}

const moodFaces: Record<TwobMood, CompanionFace | null> = {
  happy: "smile",
  warm: "smile",
  sad: "sad",
  concern: "sad",
  thinking: null,
  surprised: "surprised",
  playful: "smile",
  calm: null,
};

export function faceForMood(mood: TwobMood): CompanionFace | null {
  return moodFaces[mood];
}

function isMood(value: string): value is TwobMood {
  return (twobMoods as readonly string[]).includes(value);
}

/**
 * Splits 2B's raw reply into what she says and the tags she put in front, like
 * `[mood:warm] [pose:wave] Hai.` Unknown or missing tags fall back to a calm, still reply.
 */
export function parseTwobReply(raw: string): TwobReply {
  let mood: TwobMood = "calm";
  let pose: CompanionPose | null = null;
  const text = raw
    .replace(/\[(mood|pose):\s*([a-z-]+)\s*\]/gi, (_whole, kind: string, value: string) => {
      const lower = value.toLowerCase();
      if (kind.toLowerCase() === "mood" && isMood(lower)) {
        mood = lower;
      } else if (kind.toLowerCase() === "pose" && isCompanionPose(lower)) {
        pose = lower;
      }
      return "";
    })
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  return { text, mood, pose };
}

/** The first sentence, short enough for the bubble next to 2B on the desktop. */
export function bubbleLine(text: string, maxChars = 90): string {
  const first = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  const flat = first.replace(/\s+/g, " ").trim();
  return flat.length <= maxChars ? flat : `${flat.slice(0, maxChars - 1).trimEnd()}…`;
}

const crisisPatterns: readonly RegExp[] = [
  /bunuh\s+diri/i,
  /\b(pengen|pingin|ingin|mau)\s+mati\b/i,
  /\b(nggak|gak|ga|tidak|enggak)\s+(mau|pengen|ingin|kuat)\s+hidup\b/i,
  /\bmengakhiri\s+hidup\b|\bakhiri\s+hidup(ku| gua| gue| aku)?\b/i,
  /\b(nyakitin|menyakiti|melukai|ngelukain)\s+diri\b/i,
  /\bself[\s-]?harm\b|\bsuicid/i,
  /\bkill\s+myself\b|\bend\s+my\s+life\b|\bwant\s+to\s+die\b/i,
];

/** True when a message talks about ending one's life or self-harm. The chat then shows where to get help. */
export function looksLikeCrisis(text: string): boolean {
  return crisisPatterns.some((pattern) => pattern.test(text));
}

/**
 * Shown by the app itself, not written by the model, whenever a message looks like a crisis.
 * 119 ext 8 is the Ministry of Health line still referred to in 2026 (Healing119.id).
 */
export const crisisNote =
  "Kalau lo lagi kepikiran nyakitin diri atau ngerasa nggak kuat, lo nggak harus nanggung sendirian. Hubungi layanan kesehatan jiwa Kemenkes di 119 ekstensi 8 (Healing119.id), atau ngobrol sama orang yang lo percaya sekarang. Kalau dalam bahaya, telepon 112.";
