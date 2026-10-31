import { type MemberId, memberIds } from "../../shared/team.js";
import type { DayPart } from "./office-time.js";

/**
 * Small talk between teammates on a break. Lines are written per character, in their own voice,
 * and per topic; replies are general enough to answer anyone's opener on the same topic.
 */
export type ChatTopic = "kerjaan" | "makan" | "santai" | "kantor";

interface Line {
  text: string;
  /** Funny enough that whoever is listening laughs instead of nodding. */
  laugh?: boolean;
  /** Only said at these times of day, for lines that name one ("tadi pagi", "makan siang"). */
  when?: readonly DayPart[];
}

interface Voice {
  /** Hellos that fit any hour. */
  greetings: readonly string[];
  /** Hellos for one part of the day, so nobody says good morning at night. */
  timedGreetings: Record<DayPart, readonly string[]>;
  openers: Record<ChatTopic, readonly Line[]>;
  replies: Record<ChatTopic, readonly Line[]>;
}

const voices: Record<MemberId, Voice> = {
  twob: {
    greetings: ["Halo.", "Lanjut kerja, ya.", "Hai."],
    timedGreetings: {
      pagi: ["Selamat pagi."],
      siang: ["Selamat siang."],
      sore: ["Sore. Masih semangat?"],
      malam: ["Jangan lembur kelamaan, ya."],
    },
    openers: {
      kerjaan: [
        { text: "Agenda hari ini tinggal dua lagi." },
        { text: "Review jam tiga, jangan lupa.", when: ["pagi", "siang"] },
      ],
      makan: [{ text: "Udah makan siang belum?", when: ["siang"] }, { text: "Jangan lupa makan, ya." }],
      santai: [{ text: "Weekend kemarin ngapain?" }],
      kantor: [
        { text: "Jadwal hari ini udah aku rapihin tadi pagi.", when: ["siang", "sore", "malam"] },
        { text: "Board tim udah aku update." },
      ],
    },
    replies: {
      kerjaan: [{ text: "Oke, aku catat di board." }, { text: "Nanti aku sesuaikan prioritasnya." }],
      makan: [{ text: "Belum sempat, nanti saja." }, { text: "Asal jangan telat makan." }],
      santai: [{ text: "Aku baca buku seharian." }, { text: "Istirahat itu bagian dari kerja." }],
      kantor: [{ text: "Noted." }, { text: "Bagus, biar semua kebagian info." }],
    },
  },
  chizuru: {
    greetings: ["Haii!", "Eh, halo!"],
    timedGreetings: {
      pagi: ["Pagi pagi!"],
      siang: ["Siang siang!"],
      sore: ["Soreee!"],
      malam: ["Malem malem masih di sini?"],
    },
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
    greetings: ["Halo, sayang.", "Hai."],
    timedGreetings: {
      pagi: ["Selamat pagi, sayang."],
      siang: ["Selamat siang."],
      sore: ["Selamat sore."],
      malam: ["Malam yang tenang, ya."],
    },
    openers: {
      kerjaan: [{ text: "Skema data kita perlu dirapikan." }, { text: "Opsi streaming masih aku timbang." }],
      makan: [
        { text: "Teh siang ini enak sekali.", when: ["siang", "sore"] },
        { text: "Aku bawa kue kering hari ini." },
      ],
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
    timedGreetings: {
      pagi: ["Pagi! Semangat!"],
      siang: ["Siang! Udah makan?"],
      sore: ["Sore!"],
      malam: ["Malem! Masih lembur?"],
    },
    openers: {
      kerjaan: [
        { text: "Pipeline semalam jalan mulus.", when: ["pagi", "siang"] },
        { text: "Query-nya aku bikin lebih hemat scan." },
      ],
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
    greetings: ["Yo.", "Hai hai."],
    timedGreetings: { pagi: ["Pagi."], siang: ["Siang."], sore: ["Sore."], malam: ["Malem. Ngoding lagi?"] },
    openers: {
      kerjaan: [{ text: "Bug kemarin ternyata cuma typo.", laugh: true }, { text: "Endpoint baru udah aku deploy." }],
      makan: [{ text: "Hari ini makan mi lagi aja." }],
      santai: [
        { text: "Semalam main game sampai jam dua.", laugh: true, when: ["pagi", "siang"] },
        { text: "Aku nemu game indie bagus." },
      ],
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
    greetings: ["Ah, halo.", "Hai, permisi."],
    timedGreetings: {
      pagi: ["Selamat pagi."],
      siang: ["Selamat siang."],
      sore: ["Selamat sore."],
      malam: ["Selamat malam."],
    },
    openers: {
      kerjaan: [
        { text: "Server semalam aman, tidak ada alert.", when: ["pagi", "siang"] },
        { text: "Minggu ini giliranku on-call." },
      ],
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
    timedGreetings: {
      pagi: ["Pagi. Disiplin dari awal."],
      siang: ["Siang."],
      sore: ["Sore."],
      malam: ["Malam. Jangan begadang."],
    },
    openers: {
      kerjaan: [{ text: "PR tadi butuh satu test lagi." }, { text: "Review hari ini lumayan banyak." }],
      makan: [{ text: "Kue stroberi di kulkas punyaku." }],
      santai: [
        { text: "Aku latihan pagi ini.", when: ["pagi", "siang", "sore"] },
        { text: "Aku baru ganti armor latihan." },
      ],
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
    timedGreetings: {
      pagi: ["Pagi! Senyum dong!"],
      siang: ["Siang siang!"],
      sore: ["Sore! Golden hour nih!"],
      malam: ["Malem! Mau live bareng?"],
    },
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
  arisu: {
    greetings: ["Halo! Ada update?", "Hai, semua lancar?", "Halo."],
    timedGreetings: {
      pagi: ["Pagi! Cek rencana hari ini dulu, yuk."],
      siang: ["Siang! Udah istirahat?"],
      sore: ["Sore! Gimana progresnya?"],
      malam: ["Malem. Jangan lembur kelamaan ya."],
    },
    openers: {
      kerjaan: [{ text: "Task-nya udah aku urutin, tinggal jalan." }, { text: "Ada yang nge-block nggak?" }],
      makan: [{ text: "Makan dulu, rencana bisa nunggu.", laugh: true }],
      santai: [{ text: "Aku baru beres nyusun jadwal minggu depan." }],
      kantor: [{ text: "Papan task-ku makin rapi nih." }],
    },
    replies: {
      kerjaan: [{ text: "Oke, aku catet di rencana." }, { text: "Nanti aku update statusnya." }],
      makan: [{ text: "Setuju, istirahat dulu.", laugh: true }, { text: "Aku ikut!" }],
      santai: [{ text: "Asik juga tuh." }, { text: "Boleh, abis ini ya." }],
      kantor: [{ text: "Rapi itu penting." }, { text: "Mantap." }],
    },
  },
  komachi: {
    greetings: ["Hai.", "Halo, lagi ngoding?", "Yo."],
    timedGreetings: {
      pagi: ["Pagi. Kopi dulu baru review."],
      siang: ["Siang. Build-nya aman?"],
      sore: ["Sore. Tinggal dikit lagi nih."],
      malam: ["Malem. Commit dulu sebelum pulang."],
    },
    openers: {
      kerjaan: [{ text: "Kontrak API-nya udah aku tulis." }, { text: "Bagian ini mending dipecah dua." }],
      makan: [{ text: "Aku makan sambil baca dokumentasi.", laugh: true }],
      santai: [{ text: "Aku lagi baca soal arsitektur event." }],
      kantor: [{ text: "Monitor kedua bikin review lebih enak." }],
    },
    replies: {
      kerjaan: [{ text: "Masuk akal, lanjut." }, { text: "Cek dulu edge case-nya." }],
      makan: [{ text: "Itu kebiasaan buruk.", laugh: true }, { text: "Boleh juga." }],
      santai: [{ text: "Menarik." }, { text: "Kirim link-nya dong." }],
      kantor: [{ text: "Setuju." }, { text: "Nanti aku coba." }],
    },
  },
  miruku: {
    greetings: ["Hai.", "Halo, aman?", "Hm, halo."],
    timedGreetings: {
      pagi: ["Pagi. Cek log dulu, ya."],
      siang: ["Siang. Sejauh ini aman."],
      sore: ["Sore. Jangan lupa kunci layar."],
      malam: ["Malem. Aku masih jaga."],
    },
    openers: {
      kerjaan: [{ text: "Jangan taruh secret di kode, ya." }, { text: "Dependency-nya udah aku cek." }],
      makan: [{ text: "Makanan juga harus lolos pemeriksaan.", laugh: true }],
      santai: [{ text: "Aku lagi main game teka-teki." }],
      kantor: [{ text: "Pintu kaca itu harusnya pakai kartu." }],
    },
    replies: {
      kerjaan: [{ text: "Aku cek bagian itu." }, { text: "Sip, catat di laporan." }],
      makan: [{ text: "Hehe, lolos kok.", laugh: true }, { text: "Boleh juga." }],
      santai: [{ text: "Seru tuh." }, { text: "Nanti aku coba." }],
      kantor: [{ text: "Aman." }, { text: "Setuju." }],
    },
  },
  huagua: {
    greetings: ["Haii.", "Halo!", "Hai, lagi apa?"],
    timedGreetings: {
      pagi: ["Pagi! Cahayanya cantik."],
      siang: ["Siang! Aku butuh camilan."],
      sore: ["Sore! Warna langitnya bagus."],
      malam: ["Malem. Masih ngulik warna nih."],
    },
    openers: {
      kerjaan: [{ text: "Aku coba dua arah warna buat dashboard." }, { text: "Tombol ini kekecilan buat dipencet." }],
      makan: [{ text: "Platingnya rapi, aku suka.", laugh: true }],
      santai: [{ text: "Aku lagi sketsa tanaman di lounge." }],
      kantor: [{ text: "Neon ungunya pas sama mood kantor." }],
    },
    replies: {
      kerjaan: [{ text: "Nanti aku bikinin mock-nya." }, { text: "Coba kita sederhanain." }],
      makan: [{ text: "Fotoin dulu!", laugh: true }, { text: "Mau dong." }],
      santai: [{ text: "Lucu banget." }, { text: "Aku mau lihat!" }],
      kantor: [{ text: "Setuju, bagus." }, { text: "Hmm, bisa lebih rapi." }],
    },
  },
};

export const chatTopics: readonly ChatTopic[] = ["kerjaan", "makan", "santai", "kantor"];

/** Head motion while chatting; "acknowledge" is the small nod and smile when eyes first meet. */
export type ChatReaction = "talk" | "nod" | "laugh" | "acknowledge";

/** What the speaker's hands do while a line is up. */
export type SpeakerGesture = "explain" | "point" | "count" | "chin" | "shrug" | "hips" | "clasp" | "wave-off";
/** How the listener holds themselves while hearing a line. */
export type ListenerPosture = "relaxed" | "arms-crossed" | "head-tilt" | "chin" | "cover-laugh";

/** The body language a member shows right now, and for how long, so it can ease in. */
export interface ChatGesture {
  kind: SpeakerGesture | ListenerPosture;
  elapsed: number;
}

export interface ChatTurn {
  speaker: MemberId;
  text: string;
  /** How whoever is listening reacts while this line is up. */
  listener: "nod" | "laugh";
  gesture: SpeakerGesture;
  posture: ListenerPosture;
  seconds: number;
}

/** Hands follow what is being said: plans get counted and pointed at, jokes get hands clasped. */
const gesturesByTopic: Record<ChatTopic, readonly SpeakerGesture[]> = {
  kerjaan: ["explain", "point", "count", "chin", "explain"],
  makan: ["explain", "clasp", "hips", "shrug"],
  santai: ["explain", "shrug", "clasp", "hips"],
  kantor: ["point", "shrug", "hips", "explain"],
};
const jokingGestures: readonly SpeakerGesture[] = ["clasp", "wave-off", "shrug"];
const listeningPostures: readonly ListenerPosture[] = ["relaxed", "relaxed", "arms-crossed", "head-tilt", "chin"];
const laughingPostures: readonly ListenerPosture[] = ["relaxed", "cover-laugh"];

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

function turn(speaker: MemberId, line: Line, topic: ChatTopic, random: () => number): ChatTurn {
  const funny = line.laugh === true;
  return {
    speaker,
    text: line.text,
    listener: funny ? "laugh" : "nod",
    gesture: pick(funny ? jokingGestures : gesturesByTopic[topic], random),
    posture: pick(funny ? laughingPostures : listeningPostures, random),
    seconds: lineSeconds(line.text),
  };
}

/** Lines that fit the time of day: those without a `when`, and those whose `when` includes it. */
function fitting(lines: readonly Line[], part: DayPart | null): readonly Line[] {
  return part === null ? lines : lines.filter((line) => line.when === undefined || line.when.includes(part));
}

/**
 * A short exchange on one topic: an opener, a reply, the opener's answer, and a last reply.
 * `part` keeps out openers that name another time of day; null allows them all.
 */
export function planConversation(
  first: MemberId,
  second: MemberId,
  random: () => number = Math.random,
  part: DayPart | null = null,
): ChatTurn[] {
  const a = voices[first];
  const b = voices[second];
  const topics = chatTopics.filter((candidate) => fitting(a.openers[candidate], part).length > 0);
  const topic = pick(topics, random);
  const [bFirst, bSecond] = random() < 0.5 ? [0, 1] : [1, 0];
  return [
    turn(first, pick(fitting(a.openers[topic], part), random), topic, random),
    turn(second, b.replies[topic][bFirst] ?? pick(b.replies[topic], random), topic, random),
    turn(first, pick(a.replies[topic], random), topic, random),
    turn(second, b.replies[topic][bSecond] ?? pick(b.replies[topic], random), topic, random),
  ];
}

/** Half the time a hello for the hour ("Selamat pagi."), otherwise one that fits any time. */
export function greetingFor(
  memberId: MemberId,
  random: () => number = Math.random,
  part: DayPart | null = null,
): string {
  const voice = voices[memberId];
  const timed = random() < 0.5;
  return part !== null && timed ? pick(voice.timedGreetings[part], random) : pick(voice.greetings, random);
}

const dayParts: readonly DayPart[] = ["pagi", "siang", "sore", "malam"];

/** Every member has lines for every topic, so any pair can talk. Used by tests. */
export function voiceCoverage(): { memberId: MemberId; topic: ChatTopic; openers: number; replies: number }[] {
  return memberIds.flatMap((memberId) =>
    chatTopics.map((topic) => ({
      memberId,
      topic,
      // The fewest openers at any hour, so a topic never runs dry at night.
      openers: Math.min(...dayParts.map((part) => fitting(voices[memberId].openers[topic], part).length)),
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
  /** Seconds into catching each other's eye; the first line waits until it is over. */
  opening: number;
}

/*
 * Before the first word: the opener looks over, the other notices and looks back, and they share
 * a small nod and a smile. Times in seconds from when the two end up together.
 */
const openerTurnsBy = 0.45;
const otherNoticesAt = 0.6;
const otherTurnsBy = 1.05;
const acknowledgeFrom = 1.1;
const openingSeconds = 2;
/** Between topics they still face each other, just less squarely. */
const quietGaze = 0.6;

function ramp(value: number, from: number, to: number): number {
  return Math.min(1, Math.max(0, (value - from) / (to - from)));
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

  /** `dayPart` says the time of day in the office, so hellos and topics fit the hour. */
  constructor(
    private readonly random: () => number = Math.random,
    private readonly dayPart: () => DayPart | null = () => null,
  ) {}

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
          turns: planConversation(opener, other, this.random, this.dayPart()),
          index: 0,
          elapsed: 0,
          opening: 0,
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
    this.greetings.set(first, {
      text: greetingFor(first, this.random, this.dayPart()),
      until: now + greetingSeconds,
      startedAt: now,
    });
    // The other answers a beat later, the way a greeting gets returned.
    this.greetings.set(second, {
      text: greetingFor(second, this.random, this.dayPart()),
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
      if (
        current !== undefined &&
        talk.opening >= openingSeconds &&
        talk.elapsed >= 0 &&
        current.speaker === memberId
      ) {
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
      if (talk.opening < openingSeconds) {
        return talk.opening >= acknowledgeFrom ? "acknowledge" : null;
      }
      const current = talk.turns[talk.index];
      if (current === undefined || talk.elapsed < 0) {
        return null;
      }
      return current.speaker === memberId ? "talk" : current.listener;
    }
    return null;
  }

  /** Hands and posture for the line that is up: the speaker gestures, the listener holds a posture. */
  gestureOf(memberId: MemberId): ChatGesture | null {
    for (const talk of this.talks.values()) {
      if (!talk.members.includes(memberId)) {
        continue;
      }
      const current = talk.turns[talk.index];
      // Catching each other's eye, or between lines: hands at rest.
      if (current === undefined || talk.opening < openingSeconds || talk.elapsed < 0) {
        return { kind: "relaxed", elapsed: 0 };
      }
      return {
        kind: current.speaker === memberId ? current.gesture : current.posture,
        elapsed: talk.elapsed,
      };
    }
    return null;
  }

  /**
   * How squarely this member faces their partner, 0..1. The opener turns first; the other turns
   * once they notice; between topics both ease off a little.
   */
  gazeOf(memberId: MemberId): number {
    for (const talk of this.talks.values()) {
      const [opener, other] = talk.members;
      if (memberId !== opener && memberId !== other) {
        continue;
      }
      if (talk.opening < openingSeconds) {
        return memberId === opener
          ? ramp(talk.opening, 0, openerTurnsBy)
          : ramp(talk.opening, otherNoticesAt, otherTurnsBy);
      }
      return talk.elapsed < 0 ? quietGaze : 1;
    }
    return 0;
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
    if (talk.opening < openingSeconds) {
      talk.opening += deltaSeconds;
      return;
    }
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
      talk.turns = planConversation(first, second, this.random, this.dayPart());
      talk.index = 0;
      talk.elapsed = -(4 + this.random() * 5);
    }
  }
}

function pairKey(first: MemberId, second: MemberId): string {
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}
