import type { ConversationMode } from "../../shared/protocol.js";
import type { CompanionSignal, Delegation, MemberSignal, Mood } from "../../shared/reaction.js";
import { type MemberId, roster } from "../../shared/team.js";

export type Gesture = "none" | "nod" | "point" | "think" | "cheer";

export interface DialogLine {
  id: number;
  memberId: MemberId;
  text: string;
  /** True when the text is a role-flavored placeholder, false when it is real task or report content. */
  simulated: boolean;
  gesture: Gesture;
  mood: Mood;
}

/*
 * Simulated lines describe what a member is doing, never what came out of it.
 * A made-up "tests are green" would mislead the user about real work.
 */
const startLines: Record<Exclude<MemberId, "xenovia">, readonly string[]> = {
  chizuru: ["Oke! Aku lempar ide sebanyak-banyaknya ya.", "Siap, aku cari sudut pandang lain dulu."],
  robin: ["Menarik. Aku bandingin opsinya dulu.", "Aku baca konteksnya dulu sebelum milih."],
  asuna: ["Oke, aku cek pipeline datanya.", "Serahin ke aku, aku rapihin modelnya."],
  kobayashi: ["Siap, aku kerjain bagian aplikasinya.", "Oke, waktunya ngoding."],
  fubuki: ["Aku cek cluster dulu, read-only.", "Tenang, nggak ada yang aku apply tanpa izin."],
  erza: ["Serahkan review-nya padaku.", "Aku periksa satu per satu."],
};

const stopLines: Record<Exclude<MemberId, "xenovia">, string> = {
  chizuru: "Idenya udah aku tempel semua, tinggal dipilih.",
  robin: "Opsi dan risikonya udah aku tulis. Keputusannya di kalian.",
  asuna: "Bagianku selesai, laporannya ke Xenovia ya.",
  kobayashi: "Bagian aplikasinya selesai, cek laporannya ya.",
  fubuki: "Selesai. Usulan perubahannya ada di laporan.",
  erza: "Review selesai. Hasilnya ada di laporan.",
};

const stopGestures: Record<Exclude<MemberId, "xenovia">, Gesture> = {
  chizuru: "cheer",
  robin: "nod",
  asuna: "cheer",
  kobayashi: "nod",
  fubuki: "nod",
  erza: "nod",
};

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
      return {
        text: memberId === "fubuki" ? "Jalanin command read-only dulu." : "Aku jalanin command-nya.",
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
const maxQueue = 8;

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
  private readonly pendingTasks = new Map<MemberId, string>();
  private nextId = 1;

  constructor(private readonly random: () => number = Math.random) {}

  handle(signal: CompanionSignal, mode: ConversationMode): void {
    if (signal.kind === "delegation") {
      this.handleDelegation(signal.delegation, mode);
    } else if (signal.kind === "member") {
      this.handleMember(signal.member, mode);
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

  private push(line: Omit<DialogLine, "id">): void {
    this.queue.push({ ...line, id: this.nextId++ });
    // Keep the newest lines if the team talks faster than the dialog can show.
    while (this.queue.length > maxQueue) {
      this.queue.shift();
    }
  }

  private pick(options: readonly string[]): string {
    return options[Math.floor(this.random() * options.length) % options.length] as string;
  }

  private handleDelegation(delegation: Delegation, mode: ConversationMode): void {
    if (delegation.memberId === null || delegation.memberId === "xenovia") {
      return;
    }
    const name = roster[delegation.memberId].displayName;
    if (delegation.description !== null) {
      this.pendingTasks.set(delegation.memberId, delegation.description);
    }
    const real = mode === "real" && delegation.description !== null;
    this.push({
      memberId: "xenovia",
      text: real ? `${name}, tolong: ${delegation.description}` : `${name}, tolong bantu ya.`,
      simulated: !real,
      gesture: "point",
      mood: "greeting",
    });
  }

  private handleMember(signal: MemberSignal, mode: ConversationMode): void {
    if (signal.memberId === "xenovia") {
      return;
    }
    const memberId = signal.memberId;
    switch (signal.activity) {
      case "start": {
        const task = this.pendingTasks.get(memberId);
        this.pendingTasks.delete(memberId);
        const real = mode === "real" && task !== undefined;
        this.push({
          memberId,
          text: real ? `Siap. ${task}` : this.pick(startLines[memberId]),
          simulated: !real,
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
        const real = mode === "real" && signal.summary !== null;
        this.push({
          memberId,
          text: real ? (signal.summary as string) : stopLines[memberId],
          simulated: !real,
          gesture: stopGestures[memberId],
          mood: "done",
        });
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
