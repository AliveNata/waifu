import { type MemberId, memberIds } from "../../shared/team.js";

/**
 * Small talk between teammates on a break. Lines are written per character, in their own voice,
 * and per topic; replies are general enough to answer anyone's opener on the same topic.
 */
export type ChatTopic = "kerjaan" | "makan" | "santai" | "kantor";

interface Line {
  text: string;
  /** Funny enough that whoever is listening laughs instead of nodding. */
  laugh?: boolean;
}

interface Voice {
  greetings: readonly string[];
  openers: Record<ChatTopic, readonly Line[]>;
  replies: Record<ChatTopic, readonly Line[]>;
}

const voices: Record<MemberId, Voice> = {
  twob: {
    greetings: ["Halo.", "Lanjut kerja, ya.", "Hai."],
    openers: {
      kerjaan: [{ text: "Sprint ini tinggal dua task lagi." }, { text: "Review jam tiga, jangan lupa." }],
      makan: [{ text: "Udah makan siang belum?" }],
      santai: [{ text: "Weekend kemarin ngapain?" }],
      kantor: [{ text: "Kanban udah aku rapihin tadi pagi." }],
    },
    replies: {
      kerjaan: [{ text: "Oke, aku catat di board." }, { text: "Nanti aku sesuaikan prioritasnya." }],
      makan: [{ text: "Belum sempat, nanti saja." }, { text: "Asal jangan telat makan." }],
      santai: [{ text: "Aku baca buku seharian." }, { text: "Istirahat itu bagian dari kerja." }],
      kantor: [{ text: "Noted." }, { text: "Bagus, biar semua kebagian info." }],
    },
  },
  chizuru: {
    greetings: ["Haii!", "Eh, halo!", "Pagi pagi!"],
    openers: {
      kerjaan: [{ text: "Aku ada ide gila buat fitur baru!" }, { text: "Gimana kalau onboarding-nya pakai kuis?" }],
      makan: [{ text: "Bikin hari croissant di kantor yuk!", laugh: true }],
      santai: [{ text: "Aku nemu kafe lucu banget kemarin." }],
      kantor: [{ text: "Papan ide udah penuh sticky note lagi." }],
    },
    replies: {
      kerjaan: [{ text: "Wah, bisa jadi bahan brainstorm!" }, { text: "Aku tulis di papan ide ya." }],
      makan: [{ text: "Aku ikut! Aku ikut!", laugh: true }, { text: "Yang manis manis dong." }],
      santai: [{ text: "Seru! Ajak aku lain kali." }, { text: "Aku malah ketiduran seharian.", laugh: true }],
      kantor: [{ text: "Hehe, aku yang bikin rame." }, { text: "Nanti aku warnain biar cakep." }],
    },
  },
  rias: {
    greetings: ["Halo, sayang.", "Selamat siang.", "Hai."],
    openers: {
      kerjaan: [{ text: "Skema data kita perlu dirapikan." }, { text: "Opsi streaming masih aku timbang." }],
      makan: [{ text: "Teh siang ini enak sekali." }],
      santai: [{ text: "Aku baru selesai baca soal desain sistem." }],
      kantor: [{ text: "Whiteboard-nya kurang besar untukku.", laugh: true }],
    },
    replies: {
      kerjaan: [{ text: "Tradeoff-nya harus jelas dulu." }, { text: "Kita bahas di depan papan nanti." }],
      makan: [{ text: "Asal tidak berantakan di meja." }, { text: "Pilihan yang elegan." }],
      santai: [{ text: "Menarik. Ceritakan lagi nanti." }, { text: "Aku lebih suka sore yang tenang." }],
      kantor: [{ text: "Setuju, perlu sedikit sentuhan." }, { text: "Itu bisa diatur." }],
    },
  },
  asuna: {
    greetings: ["Halo!", "Hai, semangat ya!", "Yo!"],
    openers: {
      kerjaan: [{ text: "Pipeline semalam jalan mulus." }, { text: "Query-nya aku bikin lebih hemat scan." }],
      makan: [{ text: "Aku bawa bekal kebanyakan, mau?" }],
      santai: [{ text: "Aku nyoba resep baru kemarin." }],
      kantor: [{ text: "Kopi di pantry habis lagi." }],
    },
    replies: {
      kerjaan: [{ text: "Nanti aku cek di dashboard." }, { text: "Data-nya aman kok." }],
      makan: [{ text: "Mau dong, aku laper.", laugh: true }, { text: "Aku masakin lain kali." }],
      santai: [{ text: "Asik, kirim fotonya!" }, { text: "Aku juga pengen libur." }],
      kantor: [{ text: "Aku isi ulang nanti." }, { text: "Masuk daftar belanja." }],
    },
  },
  kobayashi: {
    greetings: ["Yo.", "Pagi.", "Hai hai."],
    openers: {
      kerjaan: [{ text: "Bug kemarin ternyata cuma typo.", laugh: true }, { text: "Endpoint baru udah aku deploy." }],
      makan: [{ text: "Hari ini makan mi lagi aja." }],
      santai: [{ text: "Semalam main game sampai jam dua.", laugh: true }],
      kantor: [{ text: "Kursiku bunyi terus tiap nyender." }],
    },
    replies: {
      kerjaan: [{ text: "Nanti aku bikin PR-nya." }, { text: "Asal test-nya hijau." }],
      makan: [{ text: "Gas, aku nitip.", laugh: true }, { text: "Yang penting kenyang." }],
      santai: [{ text: "Sama, mata panda nih.", laugh: true }, { text: "Hidup programmer." }],
      kantor: [{ text: "Klasik.", laugh: true }, { text: "Nanti aku lapor ke 2B." }],
    },
  },
  yor: {
    greetings: ["Ah, halo.", "Selamat siang.", "Hai, permisi."],
    openers: {
      kerjaan: [{ text: "Server semalam aman, tidak ada alert." }, { text: "Minggu ini giliranku on-call." }],
      makan: [{ text: "Aku coba bikin bekal sendiri." }],
      santai: [{ text: "Aku sempat jalan sore kemarin." }],
      kantor: [{ text: "Rak server-nya sudah aku rapikan." }],
    },
    replies: {
      kerjaan: [{ text: "Aku pantau dari dashboard." }, { text: "Semoga tidak ada insiden." }],
      makan: [{ text: "Wah, kelihatannya enak." }, { text: "Aku malah gosong kemarin.", laugh: true }],
      santai: [{ text: "Terdengar menyenangkan." }, { text: "Aku juga perlu istirahat." }],
      kantor: [{ text: "Terima kasih infonya." }, { text: "Biar aku yang urus." }],
    },
  },
  erza: {
    greetings: ["Halo.", "Selamat bekerja.", "Hai."],
    openers: {
      kerjaan: [{ text: "PR tadi butuh satu test lagi." }, { text: "Review hari ini lumayan banyak." }],
      makan: [{ text: "Kue stroberi di kulkas punyaku." }],
      santai: [{ text: "Aku latihan pagi ini." }],
      kantor: [{ text: "Meja meeting harus tetap rapi." }],
    },
    replies: {
      kerjaan: [{ text: "Standarnya tidak boleh turun." }, { text: "Aku cek lagi setelah ini." }],
      makan: [{ text: "Asal jangan sentuh kue stroberiku.", laugh: true }, { text: "Boleh juga." }],
      santai: [{ text: "Disiplin itu penting." }, { text: "Bagus, jaga staminamu." }],
      kantor: [{ text: "Setuju." }, { text: "Aku akan ingatkan yang lain." }],
    },
  },
  ruby: {
    greetings: ["Haii! Senyum dong!", "Halo halo!", "Hai!"],
    openers: {
      kerjaan: [{ text: "Konten minggu ini udah aku jadwalin." }, { text: "Thumbnail baru udah jadi!" }],
      makan: [{ text: "Foto makanan dulu sebelum dimakan!", laugh: true }],
      santai: [{ text: "Aku bikin video dance kemarin." }],
      kantor: [{ text: "Ring light-ku pas banget sekarang." }],
    },
    replies: {
      kerjaan: [{ text: "Bisa jadi konten tuh!" }, { text: "Nanti aku posting ya." }],
      makan: [{ text: "Aku fotoin dulu!", laugh: true }, { text: "Bagi dikit dong." }],
      santai: [{ text: "Ih, seru banget!" }, { text: "Ajak aku bikin video!" }],
      kantor: [{ text: "Cocok buat background konten." }, { text: "Mantap!" }],
    },
  },
};

export const chatTopics: readonly ChatTopic[] = ["kerjaan", "makan", "santai", "kantor"];

export type ChatReaction = "talk" | "nod" | "laugh";

export interface ChatTurn {
  speaker: MemberId;
  text: string;
  /** How whoever is listening reacts while this line is up. */
  listener: Exclude<ChatReaction, "talk">;
  seconds: number;
}

function pick<T>(items: readonly T[], random: () => number): T {
  const item = items[Math.floor(random() * items.length) % items.length];
  if (item === undefined) {
    throw new Error("cannot pick from an empty list");
  }
  return item;
}

/** Long enough to read: a short base plus time per character. */
export function lineSeconds(text: string): number {
  return Math.min(5, 1.6 + text.length * 0.06);
}

function turn(speaker: MemberId, line: Line): ChatTurn {
  return { speaker, text: line.text, listener: line.laugh === true ? "laugh" : "nod", seconds: lineSeconds(line.text) };
}

/** A short exchange on one topic: an opener, a reply, the opener's answer, and a last reply. */
export function planConversation(first: MemberId, second: MemberId, random: () => number = Math.random): ChatTurn[] {
  const topic = pick(chatTopics, random);
  const a = voices[first];
  const b = voices[second];
  const [bFirst, bSecond] = random() < 0.5 ? [0, 1] : [1, 0];
  return [
    turn(first, pick(a.openers[topic], random)),
    turn(second, b.replies[topic][bFirst] ?? pick(b.replies[topic], random)),
    turn(first, pick(a.replies[topic], random)),
    turn(second, b.replies[topic][bSecond] ?? pick(b.replies[topic], random)),
  ];
}

export function greetingFor(memberId: MemberId, random: () => number = Math.random): string {
  return pick(voices[memberId].greetings, random);
}

/** Every member has lines for every topic, so any pair can talk. Used by tests. */
export function voiceCoverage(): { memberId: MemberId; topic: ChatTopic; openers: number; replies: number }[] {
  return memberIds.flatMap((memberId) =>
    chatTopics.map((topic) => ({
      memberId,
      topic,
      openers: voices[memberId].openers[topic].length,
      replies: voices[memberId].replies[topic].length,
    })),
  );
}

interface Talk {
  members: readonly [MemberId, MemberId];
  turns: ChatTurn[];
  index: number;
  /** Seconds into the current turn; negative while pausing between lines or conversations. */
  elapsed: number;
}

export interface Speech {
  text: string;
  /** Seconds the bubble has been up, for a short fade in. */
  shownFor: number;
}

const gapSeconds = 0.5;
const greetingSeconds = 1.8;
/** The same two people greet each other once, not every time they cross paths in the room. */
const greetCooldownSeconds = 60;
/** Nobody says hello to everyone they pass: one greeting per person per half minute. */
const personalGreetCooldownSeconds = 30;

/**
 * Runs the conversations: which pairs are talking, whose line is up, and how each listener
 * reacts. Greetings in passing are one-line bubbles on top of that.
 */
export class ChatterDirector {
  private readonly talks = new Map<string, Talk>();
  private readonly greetings = new Map<MemberId, { text: string; until: number; startedAt: number }>();
  private readonly lastGreeted = new Map<string, number>();
  private readonly lastGreetedAnyone = new Map<MemberId, number>();
  private now = 0;

  constructor(private readonly random: () => number = Math.random) {}

  /** `pairs` are the teammates together at the bar or the pantry right now. */
  update(now: number, deltaSeconds: number, pairs: readonly (readonly [MemberId, MemberId])[]): void {
    this.now = now;
    const live = new Set<string>();
    for (const [first, second] of pairs) {
      const key = pairKey(first, second);
      live.add(key);
      if (!this.talks.has(key)) {
        // Whoever got there first does not always start: either may open.
        const [opener, other] = this.random() < 0.5 ? [first, second] : [second, first];
        this.talks.set(key, {
          members: [opener, other],
          turns: planConversation(opener, other, this.random),
          index: 0,
          elapsed: -1,
        });
      }
    }
    for (const [key, talk] of this.talks) {
      if (!live.has(key)) {
        this.talks.delete(key);
        continue;
      }
      this.advance(talk, deltaSeconds);
    }
    for (const [memberId, greeting] of this.greetings) {
      if (now >= greeting.until) {
        this.greetings.delete(memberId);
      }
    }
  }

  /** Two teammates passing each other. Returns false while that pair is still on cooldown. */
  greet(first: MemberId, second: MemberId, now: number): boolean {
    const key = pairKey(first, second);
    const last = this.lastGreeted.get(key);
    if (last !== undefined && now - last < greetCooldownSeconds) {
      return false;
    }
    const recently = (memberId: MemberId): boolean => {
      const at = this.lastGreetedAnyone.get(memberId);
      return at !== undefined && now - at < personalGreetCooldownSeconds;
    };
    // Mid-conversation, people do not break off to greet someone walking by.
    if (recently(first) || recently(second) || this.partnerOf(first) !== null || this.partnerOf(second) !== null) {
      return false;
    }
    this.lastGreeted.set(key, now);
    this.lastGreetedAnyone.set(first, now);
    this.lastGreetedAnyone.set(second, now);
    this.greetings.set(first, { text: greetingFor(first, this.random), until: now + greetingSeconds, startedAt: now });
    // The other answers a beat later, the way a greeting gets returned.
    this.greetings.set(second, {
      text: greetingFor(second, this.random),
      until: now + greetingSeconds + 0.6,
      startedAt: now + 0.6,
    });
    return true;
  }

  speechOf(memberId: MemberId): Speech | null {
    const greeting = this.greetings.get(memberId);
    if (greeting !== undefined && this.now >= greeting.startedAt) {
      return { text: greeting.text, shownFor: this.now - greeting.startedAt };
    }
    for (const talk of this.talks.values()) {
      const current = talk.turns[talk.index];
      if (current !== undefined && talk.elapsed >= 0 && current.speaker === memberId) {
        return { text: current.text, shownFor: talk.elapsed };
      }
    }
    return null;
  }

  reactionOf(memberId: MemberId): ChatReaction | null {
    for (const talk of this.talks.values()) {
      if (!talk.members.includes(memberId)) {
        continue;
      }
      const current = talk.turns[talk.index];
      if (current === undefined || talk.elapsed < 0) {
        return null;
      }
      return current.speaker === memberId ? "talk" : current.listener;
    }
    return null;
  }

  /** The teammate this member is talking with, to turn the head toward them. */
  partnerOf(memberId: MemberId): MemberId | null {
    for (const talk of this.talks.values()) {
      const [first, second] = talk.members;
      if (first === memberId) {
        return second;
      }
      if (second === memberId) {
        return first;
      }
    }
    return null;
  }

  private advance(talk: Talk, deltaSeconds: number): void {
    talk.elapsed += deltaSeconds;
    const current = talk.turns[talk.index];
    if (current === undefined) {
      return;
    }
    if (talk.elapsed < current.seconds) {
      return;
    }
    talk.index += 1;
    talk.elapsed = -gapSeconds;
    if (talk.index >= talk.turns.length) {
      // A quiet stretch, then another topic while they are still together.
      const [first, second] = talk.members;
      talk.turns = planConversation(first, second, this.random);
      talk.index = 0;
      talk.elapsed = -(4 + this.random() * 5);
    }
  }
}

function pairKey(first: MemberId, second: MemberId): string {
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}
