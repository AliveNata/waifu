import type { ExpressionWeights } from "./expressions.js";

/**
 * Turns a member's final report into lines they read out one by one, each with a
 * tone guessed from its words, so the face follows what is being said.
 */

export type Tone = "positive" | "concern" | "suggestion" | "question" | "neutral";

/** Enough to cover a typical short report without the overlay talking for minutes. */
export const maxSpokenSentences = 6;
/** About three lines in the dialog box; longer sentences are split at a comma or a space. */
const maxSentenceChars = 150;

/** Strips the markdown marks a report tends to use, keeping the words. */
export function cleanMarkdownLine(line: string): string {
  let text = line.trim();
  if (/^\|?\s*:?-{3,}/.test(text)) {
    // A table's separator row has nothing to say.
    return "";
  }
  if (text.startsWith("|")) {
    text = text
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell) => cell !== "")
      .join(", ");
  }
  return text
    .replace(/^(#{1,6}|>)\s*/, "")
    .replace(/^([-*+]|\d+[.)])\s+/, "")
    .replace(/^\[[ xX]\]\s+/, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[\s(])\*(\S(?:.*?\S)?)\*(?=[\s).,!?:]|$)/g, "$1$2")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function splitLong(sentence: string): string[] {
  const parts: string[] = [];
  let rest = sentence;
  while (rest.length > maxSentenceChars) {
    const window = rest.slice(0, maxSentenceChars);
    const comma = Math.max(window.lastIndexOf(", "), window.lastIndexOf("; "));
    const space = window.lastIndexOf(" ");
    // A comma reads as a natural pause; fall back to a word break so no word gets cut in half.
    const at = comma > maxSentenceChars * 0.4 ? comma + 1 : space > 0 ? space : maxSentenceChars;
    parts.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest !== "") {
    parts.push(rest);
  }
  return parts;
}

export interface ReportSentences {
  sentences: string[];
  /** True when there was more than fits, so the speaker should point to the full report. */
  truncated: boolean;
}

/**
 * Splits a report into spoken sentences: code blocks are skipped, each bullet or
 * paragraph line is its own start, and a line splits again after `.`, `!` or `?`.
 */
export function reportSentences(report: string, limit = maxSpokenSentences): ReportSentences {
  const withoutCode = report.replace(/```[\s\S]*?(```|$)/g, "\n");
  const sentences = withoutCode
    .split("\n")
    .map(cleanMarkdownLine)
    .filter((line) => line !== "")
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=\S)/))
    .map((sentence) => sentence.trim())
    // A lone "1." or "-" left over from odd formatting is not a sentence.
    .filter((sentence) => /[\p{L}\p{N}]{2,}/u.test(sentence))
    .flatMap(splitLong);
  // The hook cuts very long reports and marks the cut with an ellipsis.
  const cutByHook = report.trimEnd().endsWith("…");
  return { sentences: sentences.slice(0, limit), truncated: cutByHook || sentences.length > limit };
}

const negatedConcern =
  /\b(tidak ada|nggak ada|gak ada|ga ada|tanpa|no|zero|0)\s+(\w+\s+)?(gagal|error|eror|bug|bugs|masalah|issues?|warnings?|blockers?|risiko|regresi|regressions?|failures?|temuan)\b/i;
const negatedPositive =
  /\b(tidak|nggak|gak|belum|not|never)\s+(\w+\s+)?(lulus|berhasil|aman|pass|passed|jalan|works?|sukses)\b/i;
const concernWords =
  /\b(gagal|error|errors|eror|bug|bugs|masalah|risiko|resiko|bahaya|rusak|bocor|belum|kurang|hilang|salah|crash|fail|failed|fails|failing|broken|issues?|warnings?|critical|kritis|blockers?|blocking|vulnerab\w*|celah|leak|regresi|regressions?|timeout|ditolak|denied)\b/i;
const positiveWords =
  /\b(lulus|berhasil|sukses|aman|beres|selesai|rapi|bagus|lancar|hijau|pass|passed|passes|green|done|fixed|diperbaiki|oke|ok|okay|approved?|works|clean|lgtm)\b/i;
const suggestionWords =
  /^(saran|usul|rekomendasi|sebaiknya|mungkin|coba|pertimbangkan|next|langkah berikut\w*|consider|suggest\w*|recommend\w*|todo|perlu)\b|\b(sebaiknya|disarankan|saranku|saran aku|aku sarankan|should)\b/i;

/** A best guess from keywords in Indonesian and English. Wrong guesses only change a facial expression. */
export function sentenceTone(sentence: string): Tone {
  const text = sentence.trim();
  if (text.endsWith("?")) {
    return "question";
  }
  if (negatedConcern.test(text)) {
    return "positive";
  }
  if (negatedPositive.test(text) || concernWords.test(text)) {
    return "concern";
  }
  if (suggestionWords.test(text)) {
    return "suggestion";
  }
  if (positiveWords.test(text)) {
    return "positive";
  }
  return "neutral";
}

/**
 * Light weights on purpose: a full "happy" closes VRoid eyes and a full "sad" looks
 * tearful, both odd for someone in the middle of a sentence.
 */
export const toneExpressions: Record<Tone, ExpressionWeights> = {
  positive: { happy: 0.5 },
  concern: { sad: 0.5, surprised: 0.08 },
  suggestion: { relaxed: 0.2, happy: 0.12 },
  question: { surprised: 0.3 },
  neutral: { relaxed: 0.15 },
};
