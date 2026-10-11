import type { ConversationMode } from "../../shared/protocol.js";
import type { CompanionSignal, Delegation, MemberSignal, Mood, Reaction } from "../../shared/reaction.js";
import { type MemberId, roster } from "../../shared/team.js";
import { reportSentences, sentenceTone, type Tone } from "./report-lines.js";

export type Gesture = "none" | "nod" | "shake" | "point" | "think" | "cheer";

export interface DialogLine {
  id: number;
  memberId: MemberId;
  text: string;
  /** True when the text is a role-flavored placeholder, false when it is real task or report content. */
  simulated: boolean;
  gesture: Gesture;
  mood: Mood;
  /** Set on report sentences: the face follows the sentence instead of the general mood. */
  tone: Tone | null;
}

/*
 * Simulated lines describe what a member is doing, never what came out of it.
 * A made-up "tests are green" would mislead the user about real work.
 */
const startLines: Record<Exclude<MemberId, "twob">, readonly string[]> = {
  chizuru: ["Oke! Aku lempar ide sebanyak-banyaknya ya.", "Siap, aku cari sudut pandang lain dulu."],
  rias: ["Serahkan strateginya padaku.", "Aku susun opsinya dulu, lalu kita pilih."],
  asuna: ["Oke, aku cek pipeline datanya.", "Serahin ke aku, aku rapihin modelnya."],
  kobayashi: ["Siap, aku kerjain bagian aplikasinya.", "Oke, waktunya ngoding."],
  yor: ["Aku cek cluster dulu ya, read-only.", "Tenang, nggak ada yang aku ubah tanpa izin."],
  erza: ["Oke, aku cek dulu ya.", "Serahkan review-nya padaku.", "Aku periksa satu per satu."],
  ruby: ["Siap! Kerjaan lo aku bikin bersinar ya.", "Oke! Aku cari sudut cerita yang paling menarik."],
};

const stopLines: Record<Exclude<MemberId, "twob">, string> = {
  chizuru: "Idenya udah aku tempel semua, tinggal dipilih.",
  rias: "Opsi dan risikonya udah aku tulis. Keputusannya di kalian.",
  asuna: "Bagianku selesai, laporannya ke 2B ya.",
  kobayashi: "Bagian aplikasinya selesai, cek laporannya ya.",
  yor: "Selesai. Usulan perubahannya ada di laporan.",
  erza: "Review selesai. Hasilnya ada di laporan.",
  ruby: "Draft-nya udah aku taruh di folder portfolio, tinggal lo cek.",
};

const stopGestures: Record<Exclude<MemberId, "twob">, Gesture> = {
  chizuru: "cheer",
  rias: "nod",
  asuna: "cheer",
  kobayashi: "nod",
  yor: "nod",
  erza: "nod",
  ruby: "cheer",
};

/** Head and hands that go with each tone, so a worried sentence does not get a cheer. */
const toneGestures: Record<Tone, Gesture> = {
  positive: "nod",
  concern: "shake",
  suggestion: "point",
  question: "think",
  neutral: "none",
};
const moreInReportLine = "Sisanya lengkap di laporan ke 2B ya.";

/** 2B working on her own, without the team: she says what she starts and when she is done. */
const twobStartLines: readonly string[] = ["Siap, aku cek dulu.", "Oke, aku kerjain sekarang."];
const twobDoneLine = "Udah, hasilnya ada di terminal ya.";
const twobWaitingLine = "Aku nunggu jawaban lo di terminal.";

export function toolLine(memberId: MemberId, tool: string): { text: string; gesture: Gesture } {
  switch (tool) {
    case "Read":
    case "Grep":
    case "Glob":
      return { text: "Aku baca kodenya dulu.", gesture: "think" };
    case "Edit":
    case "Write":
    case "NotebookEdit":
      return { text: "Aku ubah file-nya sekarang.", gesture: "none" };
    case "Bash":
    case "PowerShell":
      return {
        text: memberId === "yor" ? "Jalanin command read-only dulu." : "Aku jalanin command-nya.",
        gesture: "none",
      };
    case "WebSearch":
    case "WebFetch":
      return { text: "Aku cari referensinya dulu.", gesture: "think" };
    default:
      return { text: `Pakai ${tool} dulu.`, gesture: "none" };
  }
}

/** A member says at most one tool line in this window, so busy runs do not flood the dialog. */
const toolLineGapMs = 8000;
/** Tool lines are dropped when this many lines are already waiting. */
const maxQueuedBeforeToolLines = 2;
/** Room for a delegation, the answer, and a whole spoken report. */
const maxQueue = 24;

export const revealCharsPerSecond = 22;
const holdAfterRevealMs = 2600;

export function lineDurationMs(line: DialogLine): number {
  return (line.text.length / revealCharsPerSecond) * 1000 + holdAfterRevealMs;
}

/** Queue of lines spoken one after another. `random` is injectable for tests. */
export class Conversation {
  private readonly queue: DialogLine[] = [];
  private active: { line: DialogLine; startedAt: number } | null = null;
  private readonly lastToolLineAt = new Map<MemberId, number>();
  /** Set from a prompt to its Stop, so 2B says "done" once per task and not on a stray Stop. */
  private twobOnTask = false;
  private nextId = 1;

  constructor(private readonly random: () => number = Math.random) {}

  handle(signal: CompanionSignal, mode: ConversationMode): void {
    if (signal.kind === "delegation") {
      this.handleDelegation(signal.delegation, mode);
    } else if (signal.kind === "member") {
      this.handleMember(signal.member, mode);
    } else {
      this.handleReaction(signal.reaction);
    }
  }

  /** The line being spoken now, or null when everyone is quiet. */
  current(now: number): { line: DialogLine; startedAt: number } | null {
    if (this.active !== null && now - this.active.startedAt >= lineDurationMs(this.active.line)) {
      this.active = null;
    }
    if (this.active === null) {
      const next = this.queue.shift();
      if (next !== undefined) {
        this.active = { line: next, startedAt: now };
      }
    }
    return this.active;
  }

  pendingCount(): number {
    return this.queue.length;
  }

  private push(line: Omit<DialogLine, "id" | "tone"> & { tone?: Tone }): void {
    this.queue.push({ ...line, tone: line.tone ?? null, id: this.nextId++ });
    // Keep the newest lines if the team talks faster than the dialog can show.
    while (this.queue.length > maxQueue) {
      this.queue.shift();
    }
  }

  private pick(options: readonly string[]): string {
    return options[Math.floor(this.random() * options.length) % options.length] as string;
  }

  private handleDelegation(delegation: Delegation, mode: ConversationMode): void {
    if (delegation.memberId === null || delegation.memberId === "twob") {
      return;
    }
    const name = roster[delegation.memberId].displayName;
    const real = mode === "real" && delegation.description !== null;
    this.push({
      memberId: "twob",
      text: real ? `${name}, tolong: ${delegation.description}` : `${name}, tolong bantu ya.`,
      simulated: !real,
      gesture: "point",
      mood: "greeting",
    });
  }

  /**
   * 2B's own main-session work. Without this the dialog stays silent whenever she handles a task
   * herself instead of delegating, which looks like the office ignored the request.
   */
  private handleReaction(reaction: Reaction): void {
    switch (reaction.mood) {
      case "thinking":
        // A null detail is a new prompt; "Merapikan konteks" (compaction) is not a new task.
        if (reaction.detail === null && !this.twobOnTask) {
          this.twobOnTask = true;
          this.push({
            memberId: "twob",
            text: this.pick(twobStartLines),
            simulated: true,
            gesture: "nod",
            mood: "thinking",
          });
        }
        break;
      case "working": {
        const tool = reaction.detail;
        const last = this.lastToolLineAt.get("twob") ?? Number.NEGATIVE_INFINITY;
        // Delegation already has its own line ("Asuna, tolong bantu ya").
        if (
          tool === null ||
          tool === "Delegasi ke tim" ||
          reaction.receivedAt - last < toolLineGapMs ||
          this.queue.length >= maxQueuedBeforeToolLines
        ) {
          return;
        }
        this.lastToolLineAt.set("twob", reaction.receivedAt);
        const { text, gesture } = toolLine("twob", tool);
        this.push({ memberId: "twob", text, simulated: false, gesture, mood: "working" });
        break;
      }
      case "waiting":
        this.push({ memberId: "twob", text: twobWaitingLine, simulated: false, gesture: "point", mood: "waiting" });
        break;
      case "done":
        if (this.twobOnTask) {
          this.twobOnTask = false;
          this.push({ memberId: "twob", text: twobDoneLine, simulated: false, gesture: "cheer", mood: "done" });
        }
        break;
      default:
        break;
    }
  }

  /** One line per sentence, so the member explains the result step by step with a face to match. */
  private speakReport(memberId: MemberId, sentences: readonly string[], truncated: boolean): void {
    sentences.forEach((sentence, index) => {
      const tone = sentenceTone(sentence);
      this.push({
        memberId,
        text: sentence,
        simulated: false,
        // A plain opening sentence still gets a nod: it marks that the report starts here.
        gesture: index === 0 && tone === "neutral" ? "nod" : toneGestures[tone],
        mood: "done",
        tone,
      });
    });
    if (truncated) {
      this.push({
        memberId,
        text: moreInReportLine,
        simulated: false,
        gesture: "point",
        mood: "done",
        tone: "neutral",
      });
    }
  }

  private handleMember(signal: MemberSignal, mode: ConversationMode): void {
    if (signal.memberId === "twob") {
      return;
    }
    const memberId = signal.memberId;
    switch (signal.activity) {
      case "start": {
        // 2B just read the task out, so the member only acknowledges it instead of repeating it.
        this.push({
          memberId,
          text: this.pick(startLines[memberId]),
          simulated: mode !== "real",
          gesture: "nod",
          mood: "greeting",
        });
        break;
      }
      case "tool": {
        const last = this.lastToolLineAt.get(memberId) ?? Number.NEGATIVE_INFINITY;
        if (
          signal.tool === null ||
          signal.receivedAt - last < toolLineGapMs ||
          this.queue.length >= maxQueuedBeforeToolLines
        ) {
          return;
        }
        this.lastToolLineAt.set(memberId, signal.receivedAt);
        const { text, gesture } = toolLine(memberId, signal.tool);
        // Tool names are real metadata either way, so these lines never count as simulated content.
        this.push({ memberId, text, simulated: false, gesture, mood: "working" });
        break;
      }
      case "stop": {
        const report = mode === "real" && signal.summary !== null ? reportSentences(signal.summary) : null;
        if (report === null || report.sentences.length === 0) {
          this.push({
            memberId,
            text: stopLines[memberId],
            simulated: true,
            gesture: stopGestures[memberId],
            mood: "done",
          });
          break;
        }
        this.speakReport(memberId, report.sentences, report.truncated);
        break;
      }
    }
  }
}

export type Viseme = "aa" | "ih" | "ou" | "ee" | "oh";
const visemes: readonly Viseme[] = ["aa", "ih", "ou", "ee", "oh"];

const vowelVisemes: Record<string, Viseme> = { a: "aa", i: "ih", u: "ou", e: "ee", o: "oh" };

/**
 * Mouth shape for the character just revealed: vowels open fully into their
 * shape, consonants keep a small "aa", spaces and punctuation close the mouth.
 */
export function visemeWeights(text: string, revealed: number): Record<Viseme, number> {
  const weights: Record<Viseme, number> = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
  if (revealed <= 0 || revealed > text.length) {
    return weights;
  }
  const character = (text[revealed - 1] ?? "").toLowerCase();
  const vowel = vowelVisemes[character];
  if (vowel !== undefined) {
    weights[vowel] = 0.9;
  } else if (/[a-z0-9]/.test(character)) {
    weights.aa = 0.3;
  }
  return weights;
}

export function allVisemes(): readonly Viseme[] {
  return visemes;
}
