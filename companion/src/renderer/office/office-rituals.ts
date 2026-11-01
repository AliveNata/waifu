import type { MemberId } from "../../shared/team.js";
import { jakartaHours } from "./office-time.js";

/**
 * The fixed points of an office day, on Jakarta time: a short standup at the glass board in the
 * morning, lunch together at the meeting table, and going home in the evening. Only members on
 * a break take part; someone Claude Code is running keeps working, and someone called in while
 * at home comes back through the door.
 */
export type RitualId = "standup" | "lunch" | "home";

export interface RitualNow {
  id: RitualId;
  /** Until the ritual's window closes: the end of standup or lunch, or the member's arrival. */
  remainingMs: number;
  /** The office's calendar day, so standup and lunch happen once a day each. */
  day: string;
}

/** 09:30 to 09:36: standups are short. */
export const standupWindow = { from: 9.5, to: 9.6 } as const;
/** Lunch can start any time from 12:00 until 13:00. */
export const lunchWindow = { from: 12, to: 13 } as const;
/** The first one leaves at 19:00 and the rest follow a few minutes apart. */
export const leaveFrom = 19;
/** The first one is in at 07:30 and the rest follow a few minutes apart. */
export const arriveFrom = 7.5;
const leaveGapMinutes = 5;
const arriveGapMinutes = 4;

/** 2B is first in, the PM and the tech lead right after her. */
const arrivalOrder: readonly MemberId[] = [
  "twob",
  "arisu",
  "komachi",
  "asuna",
  "yor",
  "miruku",
  "erza",
  "kobayashi",
  "rias",
  "huagua",
  "chizuru",
  "ruby",
];
/** 2B is last out, after the on-call SRE and the PM. */
const leavingOrder: readonly MemberId[] = [
  "ruby",
  "chizuru",
  "huagua",
  "kobayashi",
  "rias",
  "asuna",
  "erza",
  "komachi",
  "miruku",
  "yor",
  "arisu",
  "twob",
];

const hourMs = 60 * 60 * 1000;
const jakartaOffsetMs = 7 * hourMs;

function slot(order: readonly MemberId[], memberId: MemberId): number {
  const index = order.indexOf(memberId);
  if (index < 0) {
    throw new Error(`${memberId} has no place in the office's daily order`);
  }
  return index;
}

/** When this member leaves in the evening, in Jakarta hours. */
export function leavesAt(memberId: MemberId): number {
  return leaveFrom + (slot(leavingOrder, memberId) * leaveGapMinutes) / 60;
}

/** When this member comes in in the morning, in Jakarta hours. */
export function arrivesAt(memberId: MemberId): number {
  return arriveFrom + (slot(arrivalOrder, memberId) * arriveGapMinutes) / 60;
}

/** The Jakarta calendar day as "2026-11-01". */
export function officeDay(date: Date): string {
  return new Date(date.getTime() + jakartaOffsetMs).toISOString().slice(0, 10);
}

/** The ritual this member should be at right now, if any. */
export function ritualFor(memberId: MemberId, date: Date): RitualNow | null {
  const hours = jakartaHours(date);
  const day = officeDay(date);
  const leave = leavesAt(memberId);
  const arrive = arrivesAt(memberId);
  if (hours >= leave || hours < arrive) {
    const untilArrival = hours >= leave ? 24 - hours + arrive : arrive - hours;
    return { id: "home", remainingMs: untilArrival * hourMs, day };
  }
  if (hours >= standupWindow.from && hours < standupWindow.to) {
    return { id: "standup", remainingMs: (standupWindow.to - hours) * hourMs, day };
  }
  if (hours >= lunchWindow.from && hours < lunchWindow.to) {
    return { id: "lunch", remainingMs: (lunchWindow.to - hours) * hourMs, day };
  }
  return null;
}

/**
 * What each member says when it is their turn at standup: what they finished, what is next.
 * Two takes each, picked by the day, so the same morning sounds the same if the app restarts.
 */
const standupLines: Record<MemberId, readonly [string, string]> = {
  twob: ["Agenda hari ini udah aku taruh di board.", "Aku pegang koordinasi, kabarin kalau ada yang nyangkut."],
  arisu: ["Sprint masih on track, dua tiket lagi.", "Hari ini aku pecah tiket besar jadi tiga."],
  komachi: ["Kontrak API kemarin udah final.", "Hari ini aku tulis langkah migrasinya."],
  asuna: ["Pipeline orders kemarin hijau semua.", "Hari ini aku beresin model mart yang telat."],
  yor: ["Semalam aman, nggak ada alert.", "Hari ini aku rapihin dashboard monitoring."],
  miruku: ["Scan dependency kemarin bersih.", "Hari ini aku cek ulang izin akses bucket."],
  erza: ["Tiga PR kemarin udah aku review.", "Hari ini fokus review fitur checkout."],
  kobayashi: ["Form checkout kemarin udah jalan.", "Hari ini aku benerin validasi di mobile."],
  rias: ["Diagram arsitektur udah aku update.", "Hari ini aku bahas opsi caching sama Komachi."],
  chizuru: ["Ide onboarding baru udah aku tempel di papan.", "Hari ini aku kumpulin masukan dari tim."],
  ruby: ["Draft post minggu ini udah jadi.", "Hari ini aku rekam voice-over."],
  huagua: ["Mockup halaman profil udah aku kirim.", "Hari ini aku rapihin token warna."],
};

export const standupOpening = "Oke, standup. Gantian, ya.";
export const standupClosing = "Makasih semua. Gas lanjut.";

export function standupLine(memberId: MemberId, day: string): string {
  // The day's digits as a small number: stable within a day, different from one day to the next.
  const pick = Number(day.slice(-2)) % 2;
  return standupLines[memberId][pick === 0 ? 0 : 1];
}

/** Seconds each turn at standup stays up, opening and closing included. */
export const standupTurnSeconds = 4.5;

export interface StandupTurn {
  speaker: MemberId;
  text: string;
  /** Seconds into this turn. */
  elapsed: number;
}

/**
 * Who is talking at standup `seconds` after it started: the lead opens, everyone else in the
 * order they stand, the lead closes, and then the round is over (null) and people chat quietly.
 */
export function standupTurn(
  lead: MemberId,
  attendees: readonly MemberId[],
  seconds: number,
  day: string,
): StandupTurn | null {
  const others = attendees.filter((memberId) => memberId !== lead);
  const turns: { speaker: MemberId; text: string }[] = [
    { speaker: lead, text: standupOpening },
    ...others.map((memberId) => ({ speaker: memberId, text: standupLine(memberId, day) })),
    { speaker: lead, text: `${standupLine(lead, day)} ${standupClosing}` },
  ];
  const index = Math.floor(seconds / standupTurnSeconds);
  const turn = turns[index];
  if (seconds < 0 || turn === undefined) {
    return null;
  }
  return { ...turn, elapsed: seconds - index * standupTurnSeconds };
}
