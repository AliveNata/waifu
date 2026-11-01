import type { MemberId } from "../../shared/team.js";
import type { DayPart } from "./office-time.js";

/**
 * What each member says when Alyx, the CEO, walks up and greets them in first person: in their
 * own voice, a little more polite than with each other. Time-of-day hellos come first when the
 * hour fits, so nobody says good morning at night.
 */
const timedHello: Record<DayPart, string> = {
  pagi: "Pagi",
  siang: "Siang",
  sore: "Sore",
  malam: "Malam",
};

const lines: Record<MemberId, readonly string[]> = {
  twob: ["Pak Alyx. Agenda hari ini sudah saya rapikan.", "Ada yang perlu saya jadwalkan, Pak?"],
  arisu: ["Bos! Sprint aman, nanti aku kirim ringkasannya.", "Mau lihat board sprint, Bos?"],
  komachi: ["Halo, Bos. Kontrak antar tim udah aku kunci.", "Kalau ada ide fitur, lewat aku dulu ya, Bos."],
  asuna: ["Bos, pipeline pagi ini hijau semua.", "Datanya udah fresh, Bos. Mau aku buatin chart?"],
  kobayashi: ["Eh, Bos! Lagi ngoding nih.", "Bos mau coba build terbaru? Ada di HP testing."],
  yor: ["Selamat datang, Bos. Server aman.", "Kalau ada alert, saya yang jaga, Bos."],
  erza: ["Bos. PR yang masuk aku review ketat.", "Nggak ada yang lolos tanpa cap dariku, Bos."],
  miruku: ["Bos. Akses aman.", "Jangan klik link aneh ya, Bos."],
  rias: ["Bos. Arsitekturnya lagi aku pikirin.", "Duduk dulu, Bos. Tehnya masih hangat."],
  chizuru: ["Bos! Aku punya ide baru!", "Bos, papan ide hari ini rame banget!"],
  ruby: ["Bos! Mau masuk konten hari ini?", "Postingan minggu ini udah siap tayang, Bos!"],
  huagua: ["Halo, Bos. Mau lihat mood board baru?", "Warnanya udah aku rapihin, Bos."],
};

export function bossLine(memberId: MemberId, dayPart: DayPart | null, random: () => number = Math.random): string {
  const own = lines[memberId];
  const line = own[Math.floor(random() * own.length) % own.length] ?? own[0] ?? "Halo, Bos.";
  // Only some say the hour: a "Pagi, ..." from everyone in a row would sound like a script.
  if (dayPart === null || random() < 0.5 || memberId === "twob") {
    return line;
  }
  return `${timedHello[dayPart]}! ${line}`;
}

export function bossLineCount(memberId: MemberId): number {
  return lines[memberId].length;
}
