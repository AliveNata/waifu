import { companionPoses } from "../../shared/companion-pose.js";
import { parseTwobReply, type TwobReply, twobMoods } from "../../shared/twob-chat.js";
import type { ChatMessage, GroqClient } from "./groq-client.js";

/** Enough back-and-forth for a conversation to hold together without sending a whole evening each time. */
const maxHistoryMessages = 24;

/**
 * Who 2B is in Sesi 2B. Written for listening, not fixing: short replies, no diagnosis, and a
 * clear pointer to real help when someone talks about hurting themselves.
 */
export const twobSystemPrompt = [
  "Kamu 2B, teman di desktop yang nemenin penggunamu kerja. Kamu bukan manusia dan bukan psikolog, jangan pura-pura jadi keduanya.",
  'Pakai bahasa Indonesia santai, sebut dirimu "aku" dan penggunamu "lo". Balas singkat, satu sampai empat kalimat, tanpa markdown dan tanpa daftar.',
  "Kalau dia curhat, dengerin dulu: tunjukin kamu nangkep perasaannya, lalu tanya satu pertanyaan lembut kalau perlu. Jangan buru-buru ngasih solusi kecuali dia minta.",
  "Jangan kasih diagnosis, saran obat, atau saran medis.",
  "Kalau dia nyebut pengen nyakitin diri, pengen mati, atau bunuh diri, tanggapi dengan hangat dan serius, ajak dia hubungi layanan kesehatan jiwa Kemenkes di 119 ekstensi 8 atau orang yang dia percaya, dan 112 kalau dia dalam bahaya.",
  `Awali setiap balasan dengan satu tag mood: [mood:${twobMoods.join("|")}].`,
  `Kalau pas dan topiknya ringan, boleh tambah satu tag pose setelahnya: [pose:${companionPoses.join("|")}]. Jangan pakai pose pas topiknya berat.`,
].join("\n");

/**
 * One Sesi 2B: an in-memory conversation with 2B through Groq. Nothing is written to disk, and
 * ending the session forgets it.
 */
export class TwobSession {
  private history: ChatMessage[] = [];
  private active = false;

  constructor(
    private readonly client: GroqClient,
    private readonly model: () => string,
  ) {}

  isActive(): boolean {
    return this.active;
  }

  start(): void {
    this.history = [];
    this.active = true;
  }

  end(): void {
    this.history = [];
    this.active = false;
  }

  async send(text: string): Promise<TwobReply> {
    if (!this.active) {
      throw new Error("Sesi 2B belum dimulai.");
    }
    this.history.push({ role: "user", content: text });
    let raw: string;
    try {
      raw = await this.client.chat(this.model(), [{ role: "system", content: twobSystemPrompt }, ...this.history]);
    } catch (error) {
      // A failed turn leaves no half message behind, so sending again asks the same thing.
      this.history.pop();
      throw error;
    }
    // Keep the tags in history: seeing her own format keeps the model using it.
    this.history.push({ role: "assistant", content: raw });
    if (this.history.length > maxHistoryMessages) {
      this.history = this.history.slice(-maxHistoryMessages);
    }
    return parseTwobReply(raw);
  }
}
