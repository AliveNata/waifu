import { join } from "node:path";
import { app, ipcMain, safeStorage } from "electron";
import { isCompanionFace, isCompanionPose } from "../../shared/companion-pose.js";
import { ipcChannels } from "../../shared/protocol.js";
import {
  bubbleLine,
  type CompanionCommand,
  faceForMood,
  type TwobReply,
  type TwobStatus,
} from "../../shared/twob-chat.js";
import { defaultGroqBaseUrl, defaultGroqModel, GroqClient } from "./groq-client.js";
import { KeyStore } from "./key-store.js";
import { TwobSession } from "./twob-session.js";

/** Longest message Sesi 2B accepts: a long curhat, not a pasted document. */
const maxMessageChars = 4000;
const modelIdPattern = /^[\w./:-]{1,200}$/;

export interface TwobHost {
  currentModel(): string | null;
  saveModel(model: string): Promise<void>;
  /** Sends to 2B's desktop window, if it is open. */
  sendToCompanion(channel: string, value: unknown): void;
}

function companionCommand(value: unknown): CompanionCommand | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const pose = record.pose === null || isCompanionPose(record.pose) ? record.pose : undefined;
  const face = record.face === null || isCompanionFace(record.face) ? record.face : undefined;
  const line = record.line === null || typeof record.line === "string" ? record.line : undefined;
  if (pose === undefined || face === undefined || line === undefined) {
    return null;
  }
  return { pose, face, line: line === null ? null : line.slice(0, 200) };
}

/**
 * Sesi 2B in the main process: the encrypted Groq key, the in-memory conversation, and passing
 * 2B's mood and poses on to her desktop window. Nothing here starts Claude Code.
 */
export class TwobService {
  private readonly keyStore = new KeyStore(join(app.getPath("userData"), "groq-key.bin"), safeStorage);
  private savedKey: string | null = null;
  private readonly client = new GroqClient(
    () => this.savedKey ?? process.env.GROQ_API_KEY ?? null,
    process.env.WAIFU_GROQ_BASE_URL ?? defaultGroqBaseUrl,
  );
  private readonly session = new TwobSession(this.client, () => this.host.currentModel() ?? defaultGroqModel);

  constructor(private readonly host: TwobHost) {}

  async loadKey(): Promise<void> {
    this.savedKey = await this.keyStore.load();
  }

  /** The office closed: nobody can see the conversation any more, so it is forgotten. */
  endSession(): void {
    this.session.end();
  }

  status(): TwobStatus {
    const envKey = process.env.GROQ_API_KEY;
    return {
      keySource: this.savedKey !== null ? "saved" : envKey !== undefined && envKey !== "" ? "env" : null,
      model: this.host.currentModel() ?? defaultGroqModel,
    };
  }

  register(): void {
    ipcMain.handle(ipcChannels.getTwobStatus, () => this.status());
    ipcMain.handle(ipcChannels.saveTwobKey, async (_event, key: unknown) => {
      if (typeof key !== "string") {
        throw new Error("Itu kelihatannya bukan API key Groq.");
      }
      await this.keyStore.save(key);
      this.savedKey = key.trim();
      return this.status();
    });
    ipcMain.handle(ipcChannels.clearTwobKey, async () => {
      await this.keyStore.clear();
      this.savedKey = null;
      return this.status();
    });
    ipcMain.handle(ipcChannels.listTwobModels, () => this.client.listModels());
    ipcMain.handle(ipcChannels.setTwobModel, async (_event, model: unknown) => {
      if (typeof model !== "string" || !modelIdPattern.test(model)) {
        throw new Error("Nama model nggak valid.");
      }
      await this.host.saveModel(model);
      return this.status();
    });
    ipcMain.handle(ipcChannels.startTwob, () => this.session.start());
    ipcMain.handle(ipcChannels.sendTwob, async (_event, text: unknown): Promise<TwobReply> => {
      if (typeof text !== "string" || text.trim() === "") {
        throw new Error("Pesannya kosong.");
      }
      const reply = await this.session.send(text.slice(0, maxMessageChars));
      this.host.sendToCompanion(ipcChannels.companionCommand, {
        pose: reply.pose,
        face: faceForMood(reply.mood),
        line: reply.text === "" ? null : bubbleLine(reply.text),
      } satisfies CompanionCommand);
      return reply;
    });
    ipcMain.on(ipcChannels.endTwob, () => this.session.end());
    ipcMain.on(ipcChannels.performCompanionCommand, (_event, value: unknown) => {
      const command = companionCommand(value);
      if (command === null) {
        console.error("[twob] ignoring a malformed companion command");
        return;
      }
      this.host.sendToCompanion(ipcChannels.companionCommand, command);
    });
  }
}
